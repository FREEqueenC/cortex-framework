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
import threading
from typing import Final

import common.services.dataplex.model as service_model
from common.clients.bq import bigquery
from common.clients.dataplex import data_product as dp_client
from common.clients.dataplex import model as dp_client_model
from common.clients.model import exception as common_client_exception
from common.schemas import config_schema
from common.services.dataplex import config_extractor
from common.services.telemetry import constants, telemetry_logger
from common.services.unified_module_provider import UnifiedModuleProvider
from common.utils import id_utils

logger = logging.getLogger(__name__)


class DataProductsSyncer:
    def __init__(
        self,
        *,
        kc_project_id: str | None = None,
        global_config: config_schema.GlobalConfig,
        module_provider: UnifiedModuleProvider,
        owner_email: str,
    ) -> None:
        """Initializes the DataProductsSyncer.

        Args:
            kc_project_id: The Knowledge Catalog project id. If it's not
              provided, it will infer the project id from the deployed data
              product dataset.
            global_config: The GlobalConfig object
            module_provider: The UnifiedModuleProvider object
            owner_email: The email address of the owner of the data products.
        """

        if not global_config:
            raise ValueError("Global config is required")
        if not owner_email:
            raise ValueError("Owner email is required")
        if not module_provider:
            raise ValueError("Module provider is required")

        self._dp_client_cache_lock: Final[threading.Lock] = threading.Lock()
        self._owner_email: Final[str] = owner_email
        self._kc_project_id: Final[str | None] = kc_project_id
        self._bigquery_client: Final[bigquery.BigQueryManager] = bigquery.BigQueryManager()
        self._dataplex_clients_cache: Final[dict[str, dp_client.DataProductClient]] = {}
        self._extractor: Final[config_extractor.DataProductHandler] = (
            config_extractor.DataProductHandler(
                global_config=global_config,
                module_provider=module_provider,
                bigquery_client=self._bigquery_client,
            )
        )

    def close(self) -> None:
        """Closes all cached Dataplex clients."""
        with self._dp_client_cache_lock:
            for client in self._dataplex_clients_cache.values():
                client.close()
            self._dataplex_clients_cache.clear()

    def __enter__(self) -> "DataProductsSyncer":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def sync_data_products(self) -> None:
        """Syncs the data products to the Knowledge Catalog.

        For each data product, it will:
            - Check if the data product exists.
            - If the data product exists, it will update it.
            - If the data product does not exist, it will create it.
        """

        logger.info("Reading the data products configurations...")
        deployed_data_products: list[service_model.data_product.DeploymentInfo] = (
            self._extractor.extract_deployed_data_products()
        )

        if not deployed_data_products:
            logger.info(
                "No data products are either found or enabled for sync to the Knowledge Catalog."
            )
            return

        formatted_ids = "\n".join(f"- {data_product.id}" for data_product in deployed_data_products)
        logger.info(
            "Syncing data products:\n\n%s",
            formatted_ids,
        )

        failed_syncs: list[str] = []
        for deployed_data_product in deployed_data_products:
            telemetry_logger_instance: telemetry_logger.EventLogger | None = (
                telemetry_logger.EventLogger.for_bq_datasets(
                    project_id=self._kc_project_id or deployed_data_product.project_id,
                    location=deployed_data_product.location,
                    target_bq_dataset=deployed_data_product.bigquery_dataset_id,
                    component=constants.TelemetryComponent.PLATFORM,
                    type=constants.TelemetryPlatformTool.KNOWLEDGE_CATALOG,
                    # to distinguish between the different data products
                    variant=deployed_data_product.id,
                )
            )
            result = self._sync_data_product(deployed_data_product, telemetry_logger_instance)
            if result == service_model.status.DataplexSyncStatus.ERROR:
                failed_syncs.append(deployed_data_product.id)

        if failed_syncs:
            formatted_ids = "\n".join(f"- {data_product_id}" for data_product_id in failed_syncs)
            raise RuntimeError(
                f"Failed to sync {len(failed_syncs)} data product(s)\n\n{formatted_ids}"
            )

    def _sync_data_product(
        self,
        deployed_data_product: service_model.data_product.DeploymentInfo,
        telemetry_logger_instance: telemetry_logger.EventLogger | None,
    ) -> service_model.status.DataplexSyncStatus:
        """Syncs a single data product to the Knowledge Catalog.
        This helper method does not propagate exceptions, it logs them and returns
        to prevent failure to the upstream callers.

        Args:
            deployed_data_product: The deployed data product to sync.
        """
        try:
            data_product_client: dp_client.DataProductClient = (
                self._get_dataplex_data_product_client(deployed_data_product)
            )

            sync_action: service_model.status.DataplexSyncAction = (
                self._check_data_product_sync_status(
                    deployed_data_product=deployed_data_product,
                    data_product_client=data_product_client,
                )
            )

            if sync_action == service_model.status.DataplexSyncAction.NOT_MANAGED:
                logger.warning(
                    "Data product %s already exists, but it is not managed. Skipping sync.",
                    deployed_data_product.id,
                )
                return service_model.status.DataplexSyncStatus.PRECONDITION_NOT_MET
            elif sync_action == service_model.status.DataplexSyncAction.NEEDS_UPDATE:
                logger.info(
                    "Data product %s needs to be updated.",
                    deployed_data_product.id,
                )

                # Update the existing data product
                updated_data_product: dp_client_model.DataProduct = self._update_data_product(
                    data_product_client=data_product_client,
                    deployed_data_product=deployed_data_product,
                )
                if telemetry_logger_instance:
                    telemetry_logger_instance.log_updated_status()
                logger.info(
                    "Successfully updated data product %s with id %s.",
                    updated_data_product.data_product_info.display_name,
                    updated_data_product.data_product_info.id,
                )
                return service_model.status.DataplexSyncStatus.SUCCESS
            elif sync_action == service_model.status.DataplexSyncAction.NEEDS_CREATION:
                logger.info(
                    "Data product %s needs to be created.",
                    deployed_data_product.id,
                )

                # Create the data product
                created_data_product: dp_client_model.DataProduct = self._create_new_data_product(
                    data_product_client=data_product_client,
                    deployed_data_product=deployed_data_product,
                )
                if telemetry_logger_instance:
                    telemetry_logger_instance.log_registered_status()
                logger.info(
                    "Successfully created data product %s with id %s.",
                    created_data_product.data_product_info.display_name,
                    created_data_product.data_product_info.id,
                )
                return service_model.status.DataplexSyncStatus.SUCCESS
            elif sync_action == service_model.status.DataplexSyncAction.NO_CHANGE:
                if telemetry_logger_instance:
                    telemetry_logger_instance.log_updated_status()
                logger.info(
                    "Data product %s is up to date.",
                    deployed_data_product.id,
                )
                return service_model.status.DataplexSyncStatus.SUCCESS
            elif sync_action == service_model.status.DataplexSyncAction.ERROR:
                logger.error(
                    "An error occurred while syncing data product %s.",
                    deployed_data_product.id,
                )
                return service_model.status.DataplexSyncStatus.ERROR
        except common_client_exception.ClientError as e:
            logger.error(
                "An error occurred while syncing data product %s: %s",
                deployed_data_product.id,
                e,
            )
            return service_model.status.DataplexSyncStatus.ERROR
        except Exception:
            logger.exception(
                "An unexpected error occurred while syncing data product %s.",
                deployed_data_product.id,
            )
            return service_model.status.DataplexSyncStatus.ERROR

    def _create_new_data_product(
        self,
        *,
        data_product_client: dp_client.DataProductClient,
        deployed_data_product: service_model.data_product.DeploymentInfo,
    ) -> dp_client_model.DataProduct:
        """Creates a new data product in the Knowledge Catalog.

        Args:
            data_product_client: The DataProductClient instance.
            deployed_data_product: The deployed data product to create.

        Returns:
            The created data product.
        """

        created_data_product: dp_client_model.DataProduct = data_product_client.create_data_product(
            data_product_info=self._build_data_product_info(deployed_data_product),
            bigquery_asset_links=self._build_bigquery_asset_links(deployed_data_product),
        )

        return created_data_product

    def _update_data_product(
        self,
        *,
        data_product_client: dp_client.DataProductClient,
        deployed_data_product: service_model.data_product.DeploymentInfo,
    ) -> dp_client_model.DataProduct:
        """Updates an existing data product in the Knowledge Catalog.

        Args:
            data_product_client: The DataProductClient instance.
            deployed_data_product: The deployed data product to update.

        Returns:
            The updated data product.
        """

        updated_data_product: dp_client_model.DataProduct = data_product_client.update_data_product(
            data_product_info=self._build_data_product_info(deployed_data_product),
            bigquery_asset_links=self._build_bigquery_asset_links(deployed_data_product),
        )

        return updated_data_product

    def _check_data_product_sync_status(
        self,
        deployed_data_product: service_model.data_product.DeploymentInfo,
        data_product_client: dp_client.DataProductClient,
    ) -> service_model.status.DataplexSyncAction:
        """Check the sync status of a data product.

        Args:
            deployed_data_product: The deployed data product.
            data_product_client: The DataProductClient instance.

        Returns:
            The sync action of the data product.
        """

        data_product_info: dp_client_model.DataProductInfo = self._build_data_product_info(
            deployed_data_product
        )

        # Check if there is an existing data product with a need to update
        try:
            existing_data_product: dp_client_model.DataProduct = (
                data_product_client.get_data_product(
                    location=deployed_data_product.location,
                    data_product_id=data_product_info.id,
                )
            )

            # If the existing data product is not managed by this tool, skip the sync.
            if not data_product_client.is_managed_data_product(existing_data_product):
                return service_model.status.DataplexSyncAction.NOT_MANAGED

            # Check if there is a need to update the existing data product
            existing_data_product_linked_resources: set[str] = {
                asset.linked_resource for asset in existing_data_product.data_assets
            }

            data_product_linked_resources: set[str] = {
                dp_client_model.DataAssetInfo.build_bigquery_linked_resource_name(
                    project_id=deployed_data_product.project_id,
                    dataset_id=deployed_data_product.bigquery_dataset_id,
                    table_id=table_id,
                )
                for table_id in deployed_data_product.bigquery_table_ids
            }

            if (
                data_product_info == existing_data_product.data_product_info
                and existing_data_product_linked_resources == data_product_linked_resources
            ):
                return service_model.status.DataplexSyncAction.NO_CHANGE

            return service_model.status.DataplexSyncAction.NEEDS_UPDATE

        except common_client_exception.NotFoundError:
            return service_model.status.DataplexSyncAction.NEEDS_CREATION

    def _build_data_product_info(
        self,
        deployed_data_product: service_model.data_product.DeploymentInfo,
    ) -> dp_client_model.DataProductInfo:
        """Build DataProductInfo from DeployedDataProduct.

        Args:
            deployed_data_product: The deployed data product.

        Returns:
            The DataProductInfo.
        """

        project_id = self._kc_project_id or deployed_data_product.project_id

        return dp_client_model.DataProductInfo(
            id=id_utils.normalize_id(deployed_data_product.id),
            project_id=project_id,
            location=deployed_data_product.location,
            display_name=deployed_data_product.manifest_info.display_name or "",
            description=deployed_data_product.manifest_info.description or "",
            owner_emails=(self._owner_email,),
            documentation=deployed_data_product.manifest_info.documentation or "",
        )

    def _build_bigquery_asset_links(
        self, deployed_data_product: service_model.data_product.DeploymentInfo
    ) -> dp_client_model.BigQueryAssetLinks:
        """Build BigQueryAssetLinks from DeployedDataProduct.

        Args:
            deployed_data_product: The deployed data product.

        Returns:
            The BigQueryAssetLinks.
        """

        table_infos: list[dp_client_model.BigQueryTableInfo] = [
            dp_client_model.BigQueryTableInfo(
                dataset_id=deployed_data_product.bigquery_dataset_id, table_id=tid
            )
            for tid in deployed_data_product.bigquery_table_ids
        ]

        return dp_client_model.BigQueryAssetLinks(
            bigquery_project_id=deployed_data_product.project_id,
            table_infos=tuple(table_infos),
        )

    def _get_dataplex_data_product_client(
        self,
        deployed_data_product: service_model.data_product.DeploymentInfo,
    ) -> dp_client.DataProductClient:
        """Get DataProductClient for a data product based on the data product project id.

        Args:
            deployed_data_product: The deployed data product.

        Returns:
            The DataProductClient for the data product project.
        """
        project_id = self._kc_project_id or deployed_data_product.project_id
        with self._dp_client_cache_lock:
            if project_id not in self._dataplex_clients_cache:
                self._dataplex_clients_cache[project_id] = dp_client.DataProductClient(
                    project_id=project_id
                )

        return self._dataplex_clients_cache[project_id]
