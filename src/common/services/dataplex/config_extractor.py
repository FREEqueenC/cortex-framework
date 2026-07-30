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
from collections.abc import Mapping
from typing import Final, cast

import common.services.dataplex.model as service_model
from common.clients.bq import bigquery
from common.schemas import config_schema
from common.services.dataplex import bq_table_extractor
from common.services.unified_module_provider import UnifiedModuleProvider

logger = logging.getLogger(__name__)


class DataProductHandler:
    """Extracts deployed data product configuration."""

    def __init__(
        self,
        global_config,
        module_provider: UnifiedModuleProvider,
        bigquery_client: bigquery.BigQueryManager,
    ):
        """
        Initialize the DataProductConfigExtractor.

        Args:
            global_config: The global configuration object.
            module_provider: The unified module provider.
            bigquery_client: The bigquery client.
        """
        if not global_config or not isinstance(global_config, config_schema.GlobalConfig):
            raise ValueError("Invalid or empty global config.")
        if not module_provider or not isinstance(module_provider, UnifiedModuleProvider):
            raise ValueError("Invalid or empty module provider.")
        if not bigquery_client or not isinstance(bigquery_client, bigquery.BigQueryManager):
            raise ValueError("Invalid or empty bigquery client.")

        self._global_config: Final[config_schema.GlobalConfig] = global_config
        self._module_provider: Final[UnifiedModuleProvider] = module_provider
        self._data_product_table_resolver: Final[bq_table_extractor.DataProductTableResolver] = (
            bq_table_extractor.DataProductTableResolver(bigquery_client=bigquery_client)
        )

    def extract_deployed_data_products(self) -> list[service_model.data_product.DeploymentInfo]:
        """Extracts deployed data products from the global configuration.

        Returns:
            List of unique deployed data products sorted alphabetically by their data product id.
        """

        location: Final[str] = self._global_config.data.big_query_location.lower()

        deployed_data_products: set[service_model.data_product.DeploymentInfo] = set()
        data_targets = self._map_target_datasets_configuration(
            tuple(self._global_config.data.datasets)
        )

        for module in self._global_config.data.modules.product:
            logger.debug("Processing module: %s", module.module_id)
            if not (module.enabled and module.sync_to_kc):
                logger.debug(
                    "Skipping module: %s as it's either not enabled %s or not enabled for sync %s.",
                    module.module_id,
                    module.enabled,
                    module.sync_to_kc,
                )
                continue

            deployed_data_products.add(
                self._extract_data_product_config(
                    location=location,
                    module=module,
                    data_targets=data_targets,
                )
            )

        return sorted(list(deployed_data_products), key=lambda x: x.id)

    def _extract_data_product_config(
        self,
        *,
        location: str,
        module: config_schema.DataProductModuleConfig,
        data_targets: Mapping[str, config_schema.DatasetConfig],
    ) -> service_model.data_product.DeploymentInfo:
        """Extracts deployment information of Data Product configuration.

        Args:
            location: The location of the data product.
            module: The module configuration.
            data_targets: The dictionary that maps data product id to target dataset
                    configuration.

        Returns:
            The deployed data product configuration.
        """

        if module.data_target_id not in data_targets:
            raise service_model.exception.DataProductConfigurationError(
                f"Data target {module.data_target_id} not found in the data targets."
            )

        # Relying on the Pydantic schema validation as the project_id and dataset_id
        # are not expected to be empty strings, so no need to check for empty strings.
        project_id: str = data_targets[module.data_target_id].project_id
        dataset_id: str = data_targets[module.data_target_id].dataset_id

        # Loading the data product manifest details
        manifest_config = self._module_provider.get_manifest(cast(str, module.module_path))
        if not manifest_config:
            raise service_model.exception.DataProductConfigurationError(
                f"Data product manifest not found for module path: {module.module_path}"
            )

        manifest_info = service_model.data_product.ManifestInfo(
            module_type=manifest_config.type or "",
            category=manifest_config.category or "",
            display_name=manifest_config.display_name or "",
            description=manifest_config.description or "",
            documentation=manifest_config.documentation or "",
        )

        # Resolve data product tables from the deployed bigquery tables
        data_products_table_ids = self._data_product_table_resolver.resolve_data_product_tables(
            project_id=project_id,
            dataset_id=dataset_id,
            data_product_type_fqn=module.module_path,
        )

        return service_model.data_product.DeploymentInfo(
            id=module.module_id,
            project_id=project_id,
            location=location,
            bigquery_dataset_id=dataset_id,
            bigquery_table_ids=tuple(data_products_table_ids),
            manifest_info=manifest_info,
        )

    def _map_target_datasets_configuration(
        self, datasets_config: tuple[config_schema.DatasetConfig, ...]
    ) -> dict[str, config_schema.DatasetConfig]:
        """Map target datasets configuration to a dictionary."""

        return {config.id: config for config in datasets_config}
