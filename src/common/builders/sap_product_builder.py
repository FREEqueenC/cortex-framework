# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""SAP Data Product generator module for building Dataform outputs."""

import json
import logging
import pathlib
from typing import Any

import yaml

from common.builders.base import ProductBuilder, Source
from common.registry import builder_registry
from common.schemas import annotation_schema, config_schema, manifest_schema, table_settings_schema

logger = logging.getLogger(__name__)


@builder_registry.register("sap_product")
class SapProductBuilder(ProductBuilder[config_schema.DataProductModuleConfig]):
    @staticmethod
    def _get_partition_config(
        table_config: table_settings_schema.ProductTableItem,
        table_name: str,
    ) -> dict[str, Any]:
        """Returns the partition configuration for a table.

        Args:
            table_config: The configuration for the specific table.
            table_name: The name of the table.

        Returns:
            A dictionary containing the 'partitionBy' configuration if applicable.
        """
        config: dict[str, Any] = {}
        details = table_config.partition_details
        if details:
            column = details.column
            time_grain = details.time_grain.upper() if details.time_grain else ""
            partition_type = details.partition_type.upper()

            partition_expression: str | None = None
            match partition_type, time_grain:
                case "DATE", "DAY":
                    partition_expression = f"DATE({column})"
                case "DATE", ("MONTH" | "YEAR"):
                    partition_expression = f"DATE_TRUNC({column}, {time_grain})"
                case "DATE", _:
                    partition_expression = None
                    logger.warning(
                        "Unsupported timeGrain '%r' for DATE partitionType for table %r."
                        "'partitionBy' will not be set.",
                        time_grain,
                        table_name,
                    )
                case "DATETIME", _:
                    partition_expression = f"DATETIME_TRUNC({column}, {time_grain})"
                case "TIMESTAMP", _:
                    partition_expression = f"TIMESTAMP_TRUNC({column}, {time_grain})"
                case "INTEGER", _:
                    range_start = details.range_start
                    range_end = details.range_end
                    range_interval = details.range_interval
                    is_valid = all(
                        isinstance(val, int) for val in [range_start, range_end, range_interval]
                    )
                    if is_valid:
                        partition_expression = (
                            f"RANGE_BUCKET(CAST({column} AS INT64), "
                            f"GENERATE_ARRAY({range_start}, {range_end}, {range_interval}))"
                        )
                    else:
                        logger.warning(
                            "Invalid INTEGER partition config for table %r. "
                            "'rangeStart', 'rangeEnd', and 'rangeInterval' must be integers.",
                            table_name,
                        )
                case _, _:
                    partition_expression = None
                    logger.warning(
                        "Unsupported partitionType '%r' for table %r. "
                        "'partitionBy' will not be set.",
                        details.partition_type,
                        table_name,
                    )
            if partition_expression:
                config["partitionBy"] = partition_expression
        return config

    @staticmethod
    def _get_cluster_config(
        table_config: table_settings_schema.ProductTableItem,
    ) -> dict[str, Any]:
        """Returns the cluster configuration for a table.

        Args:
            table_config: The configuration for the specific table.

        Returns:
            A dictionary containing the 'clusterBy' configuration if applicable.
        """
        config: dict[str, Any] = {}
        cluster_details = table_config.cluster_details
        if cluster_details:
            config["clusterBy"] = cluster_details.columns
        return config

    def build(
        self,
        *,
        module_id: str,
        module_config: config_schema.DataProductModuleConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
        table_settings_file: pathlib.Path | None = None,
    ):
        """Main entry point for the SAP Data Product generator plugin.

        Responsible for reading the dependent SAP version, loading table settings, and
        injecting tags/types into the target SQLX files.

        Args:
            module_id: The ID of the module being built.
            module_config: The configuration of the module.
            global_config: The global configuration spanning all modules.
            manifest: The explicit layout constraints evaluated from manifest.yaml.
            base_dir: The base directory of the configuration.
            annotations_dir: The directory containing annotation files.
            output_dir: The output directory for generated files.
            module_dir_name: The physical directory name for the product type.
            sources_registry: The set to register global sources.
            table_settings_file: The path to the table settings YAML file.
        """

        del sources_registry

        logger.info("Generating data product %s", module_id)

        sap_version = None

        for dep_key, dep_info in manifest.dependencies.items():
            # Get the actual module ID the user configured for this dependency
            configured_dep_id = module_config.depends_on.get(dep_key)

            if not configured_dep_id:
                logger.error(
                    "Module %s is missing required dependency '%s' defined in manifest.",
                    module_id,
                    dep_key,
                )
                return

            # Locate the dependency in the global registry (both foundation and product)
            dep_config = next(
                (
                    m
                    for m in (
                        global_config.data.modules.foundation + global_config.data.modules.product
                    )
                    if m.module_id == configured_dep_id
                ),
                None,
            )

            if not dep_config:
                logger.error(
                    "Module %s depends on '%s' (for '%s'), but it was not "
                    "found in the global foundation configuration.",
                    module_id,
                    configured_dep_id,
                    dep_key,
                )
                return

            # Validate that the configured module's type matches what the manifest expects
            configured_type = dep_config.type
            if configured_type != dep_info.type:
                logger.warning(
                    "Module %s configured dependency '%s' to point to '%s' "
                    "(type: %s), but manifest expects type '%s'.",
                    module_id,
                    dep_key,
                    configured_dep_id,
                    configured_type,
                    dep_info.type,
                )

            # Extract the sap_version from the configuration if available
            settings = (
                dep_config.module_settings
                if isinstance(dep_config, config_schema.SAPModuleConfig)
                else None
            )
            if dep_config.enabled and isinstance(settings, config_schema.SAPModuleSettings):
                resolved_version = settings.sap_version
                if sap_version and sap_version != resolved_version:
                    logger.error(
                        "Module %s has conflicting SAP version dependencies: %s vs %s.",
                        module_id,
                        sap_version,
                        resolved_version,
                    )
                    return
                sap_version = resolved_version

            # We continue validating other dependencies

        if not sap_version:
            logger.error(
                "Module %s depends on SAP, but SAP module is not enabled or version not found.",
                module_id,
            )
            return

        logger.info(
            "Resolved dependent SAP version to '%s' for %s",
            sap_version.value,
            module_id,
        )

        table_settings = None
        if table_settings_file and table_settings_file.exists():
            with open(table_settings_file, encoding="utf-8") as f:
                table_settings = yaml.safe_load(f)

        if not table_settings:
            logger.warning("Skipping %s: No table settings provided.", module_id)
            return

        try:
            validated_settings = table_settings_schema.ProductTableSettings(**table_settings)
        except Exception as e:
            logger.error("Failed to validate table settings for %s: %s", module_id, e)
            raise ValueError(f"Invalid table settings format for {module_id}") from e

        # Clean dictionary merging for table configs
        common_cfg = validated_settings.common or {}
        sap_version_cfg = getattr(validated_settings, sap_version, {}) or {}
        table_configs = {**common_cfg, **sap_version_cfg}

        logger.info(
            "Loaded %d table configurations for %s",
            len(table_configs),
            module_id,
        )

        # Dynamically resolve definitions directory relative to annotations_dir
        module_src_dir = annotations_dir.parent
        parent_definitions_dir = module_src_dir / "definitions"
        definitions_dir = parent_definitions_dir / sap_version

        files_to_process = {}

        if parent_definitions_dir.exists():
            for ext in ("*.js", "*.sqlx"):
                for source_file in parent_definitions_dir.glob(ext):
                    if source_file.is_file():
                        files_to_process[source_file.name] = source_file

        if definitions_dir.exists():
            for ext in ("*.js", "*.sqlx"):
                for source_file in definitions_dir.glob(ext):
                    if source_file.is_file():
                        files_to_process[source_file.name] = source_file

        if not files_to_process:
            logger.error(
                "No definition files found for sap_version %s in %s or %s",
                sap_version,
                definitions_dir,
                parent_definitions_dir,
            )
            return

        for file_path in files_to_process.values():
            table_name = file_path.stem
            content = file_path.read_text(encoding="utf-8")

            table_config: dict[str, Any] = {"tableName": table_name}

            # Look for a config specific to this table
            for config_table_name, t_config in table_configs.items():
                if config_table_name.lower() == table_name.lower():
                    if t_config.tags:
                        table_config["tags"] = t_config.tags
                    if t_config.materialization_type:
                        table_config["materializationType"] = t_config.materialization_type

                    if t_config.model_extra:
                        for k_extra, v_extra in t_config.model_extra.items():
                            table_config[k_extra] = v_extra

                    bigquery_config = self._get_partition_config(t_config, table_name)
                    bigquery_config.update(self._get_cluster_config(t_config))

                    if bigquery_config:
                        table_config["bigquery"] = bigquery_config
                    break

            module_context = {"moduleId": module_id}

            # Attempt to load annotations
            yaml_path = annotations_dir / sap_version / f"{table_name}.yaml"
            if not yaml_path.exists():
                yaml_path = annotations_dir / f"{table_name}.yaml"

            if yaml_path.exists():
                with open(yaml_path, encoding="utf-8") as f:
                    try:
                        yaml_content = yaml.safe_load(f) or {}
                        if isinstance(yaml_content, dict):
                            annotations = annotation_schema.TableAnnotation(**yaml_content)
                            if annotations.description:
                                table_config["description"] = annotations.description
                            if annotations.fields:
                                columns_dict = {
                                    field.name: field.description
                                    for field in annotations.fields
                                    if field.description
                                }
                                if columns_dict:
                                    table_config["columns"] = columns_dict
                        else:
                            logger.warning("Invalid annotation format in %s", yaml_path)
                    except Exception as e:
                        logger.warning("Failed to validate annotations for %s: %s", table_name, e)

            context_str = f"const moduleContext = {json.dumps(module_context, indent=2)};"
            config_str = f"const tableConfig = {json.dumps(table_config, indent=2)};"
            content = content.replace("// ___MODULE_CONTEXT___", context_str)
            content = content.replace("// ___TABLE_CONFIG___", config_str)

            out_file = output_dir / file_path.name
            out_file.write_text(content, encoding="utf-8")
            logger.info("Processed and copied %s to %s", file_path.name, output_dir)

        logger.info(
            "Successfully built Data Product %s for SAP version %s.",
            module_id,
            sap_version.value,
        )
