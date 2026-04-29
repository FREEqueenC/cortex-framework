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

import logging

from common.clients.bigquery import BigQueryManager
from common.schemas.config_schema import GlobalConfig, SAPModuleConfig

logger = logging.getLogger(__name__)


class SampleDataSeeder:
    """Provides sample data seeding from public sources."""

    _SOURCE_PROJECT = "kittycorn-public"
    _DATASET_PREFIX_MAPPING = {
        ("sap", "ecc"): "sap__rawecc__6_3__",
        ("sap", "s4"): "sap__raws4__6_3__",
    }

    def __init__(self, global_config: GlobalConfig):
        self.global_config = global_config
        self.bq_client = BigQueryManager()

    def _get_source_dataset(
        self,
        *,  # Enforce keyword arguments
        module_type: str,
        module_version: str,
        location: str,
    ) -> str | None:
        """Returns the source dataset in kittycorn-public based on target config."""
        prefix = self._DATASET_PREFIX_MAPPING.get((module_type, module_version))
        if not prefix:
            return None
        return f"{prefix}{location.lower().replace('-', '_')}"

    def seed_sample_data(self) -> bool:
        """Seeds sample data to all applicable target datasets defined in config."""
        default_location = self.global_config.data.big_query_location
        all_modules = list(self.global_config.data.modules.foundation)
        all_successful = True

        for module in all_modules:
            if module.enabled:
                # For the copy operation, the bigQuery source is the kittycorn-public dataset
                # and the bigQuery destination is the source dataset in the foundation module.
                source_config = self.global_config.get_data_source(module.data_source_id)
                if not source_config:
                    logger.error("Failed to resolve data source %s", module.data_source_id)
                    all_successful = False
                    continue

                dest_project = source_config.project_id
                dest_dataset = source_config.dataset_id
                module_type = module.type
                module_version = ""
                if isinstance(module, SAPModuleConfig):
                    module_version = module.module_settings.sap_version
                if dest_project and dest_dataset:
                    source_dataset = self._get_source_dataset(
                        module_type=module_type,
                        module_version=module_version,
                        location=default_location,
                    )
                    if source_dataset:
                        logger.info(
                            "Copying tables from %s:%s to %s:%s...",
                            self._SOURCE_PROJECT,
                            source_dataset,
                            dest_project,
                            dest_dataset,
                        )
                        success = self.bq_client.copy_tables(
                            source_project=self._SOURCE_PROJECT,
                            source_dataset=source_dataset,
                            source_location=default_location,
                            dest_project=dest_project,
                            dest_dataset=dest_dataset,
                            dest_location=default_location,
                        )
                        if not success:
                            logger.error("Failed to copy tables for dataset %s", dest_dataset)
                            all_successful = False
                    else:
                        logger.warning(
                            "No sample data mapping found for dataset %s in location %s",
                            dest_dataset,
                            default_location,
                        )

        return all_successful
