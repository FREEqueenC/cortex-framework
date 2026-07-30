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

"""Lakehouse Catalog builder module for generating external Dataform sources."""

import logging
import pathlib
from typing import Any

from common.builders.base import BaseBuilder, Source
from common.registry import builder_registry
from common.schemas import config_schema, manifest_schema
from common.services.external_module_provider import ExternalModuleProvider

logger = logging.getLogger(__name__)


@builder_registry.register("lakehouse_delta_share")
class LakehouseCatalogBuilder(BaseBuilder[config_schema.CatalogConfig]):
    """Builder plugin for generating Dataform source declarations from external BigLake catalogs."""

    def build(
        self,
        *,
        module_id: str,
        module_config: config_schema.CatalogConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
        **kwargs: Any,
    ) -> None:
        """Discovers external table metadata and emits centralized Dataform declare() statements.

        Args:
            module_id: Unique identifier for the catalog module.
            module_config: Configuration object for the catalog module.
            global_config: Global configuration object.
            manifest: Manifest configuration object.
            base_dir: Root directory of the repository.
            annotations_dir: Directory containing SQL annotations.
            output_dir: Target output directory for Dataform build artifacts.
            module_dir_name: Directory name of the module.
            sources_registry: Global set of registered Dataform sources.
            **kwargs: Additional keyword arguments passed by the build orchestrator.
        """
        logger.info("Building external catalog sources for module '%s'", module_id)
        provider = ExternalModuleProvider([module_config])
        metadata_records = provider.fetch_all_metadata()

        if not metadata_records:
            logger.warning("No external table metadata found for catalog '%s'", module_id)
            return

        # Delegate source JS file generation to the main DataformBuilder orchestrator
        for record in metadata_records:
            schema_str = f"{record.share_catalog_name}.{record.share_name}.{record.schema_name}"
            sources_registry.add(
                Source(
                    project=record.catalog_project,
                    dataset=schema_str,
                    table=record.table_name,
                )
            )
