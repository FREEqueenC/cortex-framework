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

"""SAP Data Foundation Dataform generator plugin."""

import logging
import pathlib
from typing import Any

import jinja2
import yaml

from common.builders.base import FoundationBuilder, Source
from common.errors import CortexConfigError
from common.registry import builder_registry
from common.schemas import annotation_schema, config_schema, manifest_schema, table_settings_schema
from common.utils import labels as labels_util
from data_modules.cortex.sap.foundations.sap import metadata_provider

logger = logging.getLogger(__name__)


@builder_registry.register("sap_foundation")
class SapDataFoundationBuilder(FoundationBuilder[config_schema.SAPModuleConfig]):
    """SAP Data Foundation Dataform generator plugin."""

    def build(
        self,
        *,
        module_id: str,
        module_config: config_schema.SAPModuleConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
        provider: metadata_provider.MetadataProvider | None = None,
        table_settings_file: pathlib.Path | None = None,
        required_tables: set[str] | None = None,
        **kwargs: Any,
    ) -> None:
        """Main entry point for the SAP generator plugin."""

        # 1. Load and Validate Table Settings
        table_settings = None
        if table_settings_file and table_settings_file.exists():
            try:
                with open(table_settings_file, encoding="utf-8") as f:
                    table_settings = yaml.safe_load(f) or {}
            except Exception as e:
                logger.error("Failed to load table settings from %s: %s", table_settings_file, e)
                raise CortexConfigError(
                    f"Invalid table settings file for module '{module_id}'",
                    hint=(
                        "Verify that the table settings file exists, is valid YAML, "
                        "and can be read by the system."
                    ),
                ) from e
        else:
            logger.warning("Skipping %s: No table settings provided or file not found.", module_id)
            return

        try:
            validated_settings = table_settings_schema.FoundationTableSettings(**table_settings)
        except Exception as e:
            logger.error("Failed to validate table settings for %s: %s", module_id, e)
            raise CortexConfigError(
                f"Invalid table settings format for module '{module_id}'",
                hint=(
                    "Check the format and structure of your table settings YAML file. "
                    "Ensure it conforms to the expected schema for foundation table settings, "
                    "with all required fields present and correctly typed."
                ),
            ) from e

        sap_version = module_config.module_settings.sap_version

        # 2. Extract and Filter Tables Safely
        raw_tables = (validated_settings.common or []) + getattr(
            validated_settings, sap_version, []
        )

        if not required_tables:
            tables_to_process = list(raw_tables)
        else:
            tables_to_process = [
                item
                for item in raw_tables
                if item.deploy_always or item.source.table_name in required_tables
            ]

        if not tables_to_process:
            logger.info(
                "No tables to process for %s based on required_tables filtering.", module_id
            )
            return

        source_config = global_config.get_dataset(module_config.data_source_id)
        if not source_config:
            raise CortexConfigError(
                f"Dataset '{module_config.data_source_id}' not found in config."
            )

        source_project_id = source_config.project_id
        source_dataset_id = source_config.dataset_id

        # 3. Register Sources & Gather Base Tables
        base_tables = []
        for table in tables_to_process:
            base_table = table.source.table_name
            if base_table:
                base_tables.append(base_table)
                sources_registry.add(
                    Source(
                        project=source_project_id,
                        dataset=source_dataset_id,
                        table=base_table,
                    )
                )

        if module_config.external:
            logger.info(
                "Skipping metadata fetch and SQLX generation for external SAP data foundation %s.",
                module_id,
            )
            return

        # 4. Initialize Metadata Provider
        build_project_id = (
            global_config.build_environment.build_project_id
            if global_config.build_environment
            else None
        )

        if provider is None:
            bq_client = None
            if build_project_id:
                from google.cloud import bigquery

                bq_client = bigquery.Client(project=build_project_id)

            bq_provider = metadata_provider.BigQueryMetadataProvider(
                source_project_id, source_dataset_id, base_tables, client=bq_client
            )
            bq_provider.fetch()
            provider = bq_provider

        # 5. Generate SQLX
        for table_config in tables_to_process:
            base_table = table_config.source.table_name
            if not base_table:
                continue

            columns, keys, column_types = provider.get_schema_and_keys(
                source_project_id,
                source_dataset_id,
                base_table,
                is_cdc=table_config.source.is_cdc,
            )

            # Read descriptions from YAML annotations (Mirroring Product Builder logic)
            yaml_path = annotations_dir / sap_version / f"{base_table.lower()}.yaml"
            if not yaml_path.exists():
                yaml_path = annotations_dir / f"{base_table.lower()}.yaml"

            annotations = annotation_schema.TableAnnotation()
            if yaml_path.exists():
                with open(yaml_path, encoding="utf-8") as f:
                    try:
                        yaml_content = yaml.safe_load(f) or {}
                        if isinstance(yaml_content, dict):
                            annotations = annotation_schema.TableAnnotation(**yaml_content)
                        else:
                            logger.warning("Invalid annotation format in %s", yaml_path)
                    except Exception as e:
                        logger.warning("Failed to validate annotations in %s: %s", yaml_path, e)

            sqlx_content = _render_data_foundation_sqlx(
                module_id,
                table_config,
                columns,
                keys,
                column_types,
                annotations,
                manifest,
                module_config.namespaced_type,
            )

            target_obj = table_config.target
            target_name = (target_obj.table_name or base_table).lower()

            if sqlx_content:
                out_file = output_dir / f"{target_name}.sqlx"
                with open(out_file, "w", encoding="utf-8") as f:
                    f.write(sqlx_content)

        logger.info(
            "Successfully built %d data foundation tables for %s.",
            len(tables_to_process),
            module_id,
        )


_SQLX_TEMPLATE = jinja2.Template(
    """config {
  type: "operations",
  hasOutput: true,
  database: config.foundation[{{ module_id | tojson }}].targetProjectId,
  schema: config.foundation[{{ module_id | tojson }}].targetDatasetId,
  name: "{{ target_name }}",
  tags: {{ tags | tojson }}
}

js {
  const sap_cdc = require("includes/sap_cdc.js");
}

{{ merger_macro }}(ctx, {
  keys: {{ keys | tojson(indent=2) }},
  columns: {{ columns | tojson(indent=2) }},
  is_cdc: {{ is_cdc | tojson }},
  table_description: {{ table_description | tojson }},
  column_descriptions: {{ column_descriptions | tojson(indent=2) }},
  target_ref: self(),
  source_ref: ref(config.foundation[{{ module_id | tojson }}].sourceDatasetId, "{{ base_table }}")
  {% if partition %}
  , partition: {{ partition | tojson(indent=2) }}
  {% endif %}
  {% if cluster %}
  , cluster: {{ cluster | tojson(indent=2) }}
  {% endif %}
  {% if labels %}
  , labels: {{ labels | tojson(indent=2) }}
  {% endif %}
})}
""",
    trim_blocks=True,
    lstrip_blocks=True,
)


def _render_data_foundation_sqlx(
    module_id: str,
    table_config: table_settings_schema.FoundationTableItem,
    columns: list[str],
    keys: list[str],
    column_types: dict[str, str],
    annotations: annotation_schema.TableAnnotation,
    manifest: manifest_schema.ManifestConfig | None = None,
    namespaced_type: str | None = None,
) -> str:
    """Pure function to render the SQLX content for a Data Foundation table."""
    base_table = table_config.source.table_name
    if not base_table:
        return ""

    target_obj = table_config.target
    tags = target_obj.dataform_tags or []

    target_name = (target_obj.table_name or base_table).lower()

    partition_details = (
        target_obj.partition_details.model_dump(by_alias=True, exclude_none=True)
        if target_obj.partition_details
        else None
    )
    if partition_details and "column" in partition_details:
        col_name = partition_details["column"]
        safe_column_types = column_types or {}

        col_type = safe_column_types.get(col_name)

        if not col_type:
            col_type = next(
                (v for k, v in safe_column_types.items() if k.lower() == col_name.lower()), None
            )

        if col_type:
            partition_details["data_type"] = col_type
        else:
            logger.warning(
                "Partition column '%s' defined for target '%s', but not found in schema.",
                col_name,
                target_name,
            )

    cluster_details = (
        target_obj.cluster_details.model_dump(by_alias=True, exclude_none=True)
        if target_obj.cluster_details
        else None
    )

    table_desc = annotations.description or ""
    lower_to_original = {c.lower(): c for c in columns}
    col_desc_dict = {
        lower_to_original[f.name.lower()]: f.description
        for f in (annotations.fields or [])
        if f.name and f.description and f.name.lower() in lower_to_original
    }

    labels = {}
    if target_obj.big_query_labels:
        for label in target_obj.big_query_labels:
            labels[label.key] = label.value

    module_labels = labels_util.get_module_labels(
        module_id=module_id,
        namespaced_type=namespaced_type,
        module_category=manifest.category.value if manifest and manifest.category else None,
        module_type=manifest.type if manifest else None,
    )
    labels.update(module_labels)

    return _SQLX_TEMPLATE.render(
        module_id=module_id,
        target_name=target_name,
        tags=tags,
        merger_macro="${sap_cdc.generateIncrementalMergeScript",
        keys=keys,
        columns=columns,
        is_cdc=table_config.source.is_cdc,
        table_description=table_desc,
        column_descriptions=col_desc_dict,
        base_table=base_table,
        partition=partition_details,
        cluster=cluster_details,
        labels=labels,
    )
