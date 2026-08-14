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

"""SAP BDC Data Product generator module for building Dataform outputs."""

import json
import logging
import pathlib
from typing import Any

import yaml

from common.builders.base import ProductBuilder, Source
from common.errors import CortexConfigError
from common.registry import builder_registry
from common.schemas import annotation_schema, config_schema, manifest_schema, table_settings_schema

logger = logging.getLogger(__name__)


@builder_registry.register("sap_bdc_product")
class SapBdcProductBuilder(ProductBuilder[config_schema.DataProductModuleConfig]):
    """Builder plugin for SAP BDC data products using flat definition folders.

    Supports non-versioned definitions and external catalog dependencies.
    """

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
                        "Unsupported timeGrain '%r' for DATE partitionType for table %r. "
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
        **kwargs: Any,
    ) -> None:
        """Main entry point for the SAP BDC Data Product generator plugin.

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

        logger.info("Generating BDC data product %s", module_id)

        for dep_key in manifest.dependencies:
            configured_dep_id = module_config.dependency_bindings.get(dep_key)
            if not configured_dep_id:
                logger.error(
                    "Module %s is missing required dependency '%s' defined in manifest.",
                    module_id,
                    dep_key,
                )
                return

        table_settings = None
        if table_settings_file and table_settings_file.exists():
            with open(table_settings_file, encoding="utf-8") as f:
                table_settings = yaml.safe_load(f)

        if not table_settings:
            logger.warning("Skipping %s: No table settings provided.", module_id)
            return

        try:
            validated_settings = table_settings_schema.SapBdcProductTableSettings.model_validate(
                table_settings
            )
        except Exception as e:
            logger.error("Failed to validate table settings for %s: %s", module_id, e)
            raise CortexConfigError(
                f"Invalid table settings format for module '{module_id}'",
                hint=(
                    "Check the format and structure of your table settings YAML file. "
                    "Ensure it conforms to the expected schema for SAP BDC product table settings, "
                    "with all required fields present and correctly typed."
                ),
            ) from e

        table_configs = validated_settings.root

        logger.info(
            "Loaded %d table configurations for BDC data product %s",
            len(table_configs),
            module_id,
        )

        module_src_dir = annotations_dir.parent
        definitions_dir = module_src_dir / "definitions"

        files_to_process = {}

        if definitions_dir.exists():
            for ext in ("*.js", "*.sqlx"):
                for source_file in definitions_dir.glob(ext):
                    if source_file.is_file():
                        files_to_process[source_file.name] = source_file

        if not files_to_process:
            logger.error("No definition files found in %s", definitions_dir)
            return

        for file_path in files_to_process.values():
            table_name = file_path.stem

            t_config = None
            for config_table_name, tc in table_configs.items():
                if config_table_name.lower() == table_name.lower():
                    t_config = tc
                    break

            if t_config and not t_config.enabled:
                logger.info("Table %s is disabled in settings. Skipping.", table_name)
                continue

            content = file_path.read_text(encoding="utf-8")
            table_config: dict[str, Any] = {"tableName": table_name}

            if t_config:
                if t_config.dataform_tags:
                    table_config["tags"] = t_config.dataform_tags
                if t_config.materialization_type:
                    table_config["materializationType"] = t_config.materialization_type

                if t_config.model_extra:
                    for k_extra, v_extra in t_config.model_extra.items():
                        table_config[k_extra] = v_extra

                bigquery_config = self._get_partition_config(t_config, table_name)
                bigquery_config.update(self._get_cluster_config(t_config))
                if t_config.big_query_labels:
                    # Convert list of BigQueryLabel objects to a dictionary for Dataform
                    labels_dict = {label.key: label.value for label in t_config.big_query_labels}
                    bigquery_config["labels"] = labels_dict

                if bigquery_config:
                    table_config["bigquery"] = bigquery_config

            module_context = {"moduleId": module_id}

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

        logger.info("Successfully built BDC Data Product %s.", module_id)
