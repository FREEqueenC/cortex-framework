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

import concurrent.futures
import logging
from typing import Final

from google.api_core import exceptions as api_exceptions
from google.api_core import retry
from google.api_core.future import polling as future_polling
from google.cloud import dataplex_v1 as dataplex

from common.clients.dataplex import model as dp_client_model
from common.clients.model import exception as exceptions

logger = logging.getLogger(__name__)


class DataProductClient:
    """Manages operations for Dataplex."""

    # Constants for labeling data products created by this client.
    CORTEX_FRAMEWORK_CREATED_LABEL: Final[str] = "cortex-framework-created"
    CORTEX_FRAMEWORK_VERSION_LABEL: Final[str] = "cortex-framework-version"
    CORTEX_FRAMEWORK_VERSION: Final[str] = "7-0-0"
    _THREAD_POOL_SIZE: Final[int] = 10

    _dataplex_write_retry = retry.Retry(
        predicate=retry.if_exception_type(
            api_exceptions.ResourceExhausted,
            api_exceptions.ServiceUnavailable,
            api_exceptions.DeadlineExceeded,
        ),
        initial=3.0,
        maximum=60.0,
        multiplier=2.0,
        deadline=300.0,
    )

    _dataplex_lro_polling = retry.Retry(
        predicate=future_polling.DEFAULT_POLLING._predicate,
        initial=5.0,
        maximum=60.0,
        multiplier=1.5,
        timeout=900.0,
    )

    def __init__(
        self,
        project_id: str,
        dataplex_client: dataplex.DataProductServiceClient | None = None,
    ):
        """Initializes the Dataplex client.

        Args:
          project_id: The project ID for the Dataplex client.
          dataplex_client: The Dataplex client.
        """
        self._project_id = project_id
        self._client = dataplex_client or dataplex.DataProductServiceClient()
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=self._THREAD_POOL_SIZE)

    def close(self, wait: bool = True) -> None:
        """Closes the client and shuts down the executor."""
        self._executor.shutdown(wait=wait)

    def __enter__(self) -> "DataProductClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def list_data_product_infos(self, location: str) -> list[dp_client_model.DataProductInfo]:
        """Lists all Data Products infos in the specified location.

        Args:
            location: The location of the Data Products infos to list.

        Returns:
            list[DataProductInfo]: A list of Data Products infos.
        """

        try:
            request = dataplex.ListDataProductsRequest(
                parent=f"projects/{self._project_id}/locations/{location}",
            )
            results_pager = self._client.list_data_products(request=request)
            return [self._map_data_product_to_info(data_product) for data_product in results_pager]
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded while listing data products.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded while listing data products."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to list data products in the requested location.")
            raise exceptions.FailedOperationError(
                "Failed to list data products in the requested location."
            ) from e

    def get_data_product(self, location: str, data_product_id: str) -> dp_client_model.DataProduct:
        """Gets a Data Product by ID.

        Args:
            location: The location of the Data Product.
            data_product_id: The ID of the Data Product.

        Returns:
            DataProductInfo: The Data Product.
        """

        try:
            data_product_request = dataplex.GetDataProductRequest(
                name=f"projects/{self._project_id}/locations/{location}/dataProducts/{data_product_id}",
            )
            data_product = self._client.get_data_product(request=data_product_request)
        except api_exceptions.NotFound as e:
            raise exceptions.NotFoundError(
                f"Could not find the requested data product in the requested location. "
                f"Data product: {data_product_id}, location: {location}",
            ) from e
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded while getting data product.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded while getting data product."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to get data product info.")
            raise exceptions.FailedOperationError("Failed to get data product info.") from e

        try:
            data_assets_request = dataplex.ListDataAssetsRequest(
                parent=f"projects/{self._project_id}/locations/{location}/dataProducts/{data_product_id}",
            )
            data_assets_pager = self._client.list_data_assets(request=data_assets_request)
            data_assets = [self._map_data_asset_to_info(asset) for asset in data_assets_pager]
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded while listing data assets.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded while listing data assets."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to list data assets for data product.")
            raise exceptions.FailedOperationError(
                f"Failed to list data assets for data product: {data_product_id}."
            ) from e

        return dp_client_model.DataProduct(
            data_product_info=self._map_data_product_to_info(data_product),
            data_assets=tuple(data_assets),
        )

    def create_data_product(
        self,
        data_product_info: dp_client_model.DataProductInfo,
        bigquery_asset_links: dp_client_model.BigQueryAssetLinks | None = None,
    ) -> dp_client_model.DataProduct:
        """Creates a Data Product with its linked assets.

        Args:
            data_product_info: The information of the Data Product to create.
            bigquery_asset_links: The BigQuery asset links to create.

        Returns:
            DataProductInfo: The created Data Product.
        """

        data_product = dataplex.DataProduct(
            display_name=data_product_info.display_name,
            description=data_product_info.description,
            owner_emails=data_product_info.owner_emails,
            labels={
                self.CORTEX_FRAMEWORK_CREATED_LABEL: "true",
                self.CORTEX_FRAMEWORK_VERSION_LABEL: self.CORTEX_FRAMEWORK_VERSION,
            },
        )

        project_id = data_product_info.project_id or self._project_id
        request = dataplex.CreateDataProductRequest(
            parent=f"projects/{project_id}/locations/{data_product_info.location}",
            data_product_id=data_product_info.id,
            data_product=data_product,
        )

        created_data_product: dataplex.DataProduct | None = None
        try:
            operation = self._client.create_data_product(
                request=request, retry=self._dataplex_write_retry
            )
            created_data_product = operation.result(
                retry=self._dataplex_write_retry,
                polling=self._dataplex_lro_polling,
            )
        except api_exceptions.AlreadyExists as e:
            logger.exception(
                "Failed to create data product in the knowledge catalog, "
                "a data product with the same id already exists."
            )
            raise exceptions.AlreadyExistsError(
                "Failed to create data product in the knowledge catalog, "
                "a data product with the same id already exists."
            ) from e
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded during data product creation.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded during data product creation."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to create data product in the knowledge catalog.")
            raise exceptions.FailedOperationError(
                "Failed to create data product in the knowledge catalog."
            ) from e

        # If the created data product is None, raise an exception.
        if not created_data_product:
            raise exceptions.FailedOperationError(
                "Failed to create data product in the knowledge catalog."
            )

        created_data_assets: list[dataplex.DataAsset] = []
        if bigquery_asset_links:
            data_assets = self._map_bigquery_asset_links_to_data_assets(bigquery_asset_links)

            futures = [
                self._executor.submit(
                    self._create_data_asset_blocking,
                    parent=created_data_product.name,
                    data_asset=data_asset,
                )
                for data_asset in data_assets
            ]

            for future in concurrent.futures.as_completed(futures):
                created_data_assets.append(future.result())

        return dp_client_model.DataProduct(
            data_product_info=self._map_data_product_to_info(created_data_product),
            data_assets=tuple(
                [self._map_data_asset_to_info(asset) for asset in created_data_assets]
            ),
        )

    def update_data_product(
        self,
        data_product_info: dp_client_model.DataProductInfo,
        bigquery_asset_links: dp_client_model.BigQueryAssetLinks | None = None,
    ) -> dp_client_model.DataProduct:
        """Update an existing managed Data Product and its BigQuery asset links.
        If the Data Product is not managed by this client, the update required will
        not be processed.

        Args:
            data_product_info: The information of the Data Product to update.
            bigquery_asset_links: The BigQuery asset links to update.

        Returns:
            DataProductInfo: The updated Data Product.
        """

        existing_data_product = self.get_data_product(
            data_product_info.location, data_product_info.id
        )

        # If the data product is not managed by this client, do not process the update.
        if not self.is_managed_data_product(existing_data_product):
            raise exceptions.FailedPreconditionError(
                f"Data product '{data_product_info.id}' in location '{data_product_info.location}' "
                "is not managed by this client."
            )

        data_product = dataplex.DataProduct(
            name=existing_data_product.data_product_info.resource_name,
            display_name=data_product_info.display_name,
            description=data_product_info.description,
            owner_emails=data_product_info.owner_emails,
            labels={
                self.CORTEX_FRAMEWORK_CREATED_LABEL: "true",
                self.CORTEX_FRAMEWORK_VERSION_LABEL: self.CORTEX_FRAMEWORK_VERSION,
            },
        )

        request = dataplex.UpdateDataProductRequest(
            data_product=data_product,
        )

        updated_data_product: dataplex.DataProduct | None = None
        try:
            operation = self._client.update_data_product(
                request=request, retry=self._dataplex_write_retry
            )
            updated_data_product = operation.result(
                retry=self._dataplex_write_retry,
                polling=self._dataplex_lro_polling,
            )
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded during data product update.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded during data product update."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to update data product in the knowledge catalog.")
            raise exceptions.FailedOperationError(
                "Failed to update data product in the knowledge catalog."
            ) from e

        # If the updated data product is None, raise an exception.
        if not updated_data_product:
            raise exceptions.FailedOperationError(
                "Failed to update data product in the knowledge catalog."
            )

        data_assets_to_create: list[dataplex.DataAsset] = []
        data_assets_to_delete: list[dp_client_model.DataAssetInfo] = []
        data_assets_to_keep: list[dp_client_model.DataAssetInfo] = []

        if not bigquery_asset_links:
            data_assets_to_delete.extend(existing_data_product.data_assets)
        else:
            existing_data_assets_linked_resource_dict: dict[str, dp_client_model.DataAssetInfo] = {
                asset.linked_resource: asset for asset in existing_data_product.data_assets
            }

            req_data_assets_linked_resource_dict: dict[str, dataplex.DataAsset] = {
                asset.resource: asset
                for asset in self._map_bigquery_asset_links_to_data_assets(bigquery_asset_links)
            }

            linked_resources_to_keep: set[str] = set()
            for req_linked_resource in req_data_assets_linked_resource_dict:
                if req_linked_resource in existing_data_assets_linked_resource_dict:
                    linked_resources_to_keep.add(req_linked_resource)

            for data_asset in existing_data_assets_linked_resource_dict.values():
                if data_asset.linked_resource in linked_resources_to_keep:
                    data_assets_to_keep.append(data_asset)
                else:
                    data_assets_to_delete.append(data_asset)

            data_assets_to_create.extend(
                [
                    asset
                    for asset in req_data_assets_linked_resource_dict.values()
                    if asset.resource not in linked_resources_to_keep
                ]
            )

        updated_data_assets: list[dp_client_model.DataAssetInfo] = [*data_assets_to_keep]

        create_futures = [
            self._executor.submit(
                self._create_data_asset_blocking,
                parent=updated_data_product.name,
                data_asset=data_asset,
            )
            for data_asset in data_assets_to_create
        ]

        delete_futures = [
            self._executor.submit(
                self._delete_data_asset_blocking,
                name=data_asset.resource_name,
            )
            for data_asset in data_assets_to_delete
            if data_asset.resource_name
        ]

        for future in concurrent.futures.as_completed(create_futures):
            created_asset = future.result()
            updated_data_assets.append(self._map_data_asset_to_info(created_asset))

        for del_future in concurrent.futures.as_completed(delete_futures):
            del_future.result()

        return dp_client_model.DataProduct(
            data_product_info=self._map_data_product_to_info(updated_data_product),
            data_assets=tuple(updated_data_assets),
        )

    def is_managed_data_product(self, data_product: dp_client_model.DataProduct) -> bool:
        """Checks if a Data Product is managed by this client.

        Args:
            data_product: The Data Product to check.

        Returns:
            bool: True if the Data Product is managed by this client, False otherwise.
        """

        data_product_info = data_product.data_product_info
        if not data_product_info:
            raise exceptions.IllegalArgumentError(
                "Data Product has no DataProductInfo attached to it"
            )

        return (
            data_product_info.labels.get(self.CORTEX_FRAMEWORK_CREATED_LABEL) is not None
            and data_product_info.labels.get(self.CORTEX_FRAMEWORK_VERSION_LABEL)
            == self.CORTEX_FRAMEWORK_VERSION
        )

    def _create_data_asset_blocking(
        self, parent: str, data_asset: dataplex.DataAsset
    ) -> dataplex.DataAsset:
        try:
            operation = self._client.create_data_asset(
                request=dataplex.CreateDataAssetRequest(
                    parent=parent,
                    data_asset=data_asset,
                ),
                retry=self._dataplex_write_retry,
            )
            return operation.result(
                retry=self._dataplex_write_retry,
                polling=self._dataplex_lro_polling,
            )
        except api_exceptions.AlreadyExists as e:
            logger.exception(
                "Failed to create data asset in the knowledge catalog, "
                "a data asset with the same id already exists."
            )
            raise exceptions.AlreadyExistsError(
                "Failed to create data asset in the knowledge catalog, "
                "a data asset with the same id already exists."
            ) from e
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded during data asset creation.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded during data asset creation."
            ) from e
        except ValueError as e:
            if "doesn't match status code" in str(e):
                raise exceptions.FailedOperationError(
                    f"Internal API error: Dataplex returned inconsistent gRPC status codes: {e}"
                ) from e
            raise
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to create data asset in the knowledge catalog.")
            raise exceptions.FailedOperationError(
                "Failed to create data asset in the knowledge catalog."
            ) from e

    def _delete_data_asset_blocking(self, name: str) -> None:
        try:
            operation = self._client.delete_data_asset(
                request=dataplex.DeleteDataAssetRequest(
                    name=name,
                ),
                retry=self._dataplex_write_retry,
            )
            operation.result(
                retry=self._dataplex_write_retry,
                polling=self._dataplex_lro_polling,
            )
        except api_exceptions.NotFound as e:
            logger.exception(
                "Failed to delete data asset in the knowledge catalog, "
                "a data asset with the same id does not exist."
            )
            raise exceptions.NotFoundError(
                "Failed to delete data asset in the knowledge catalog, "
                "a data asset with the same id does not exist."
            ) from e
        except api_exceptions.ResourceExhausted as e:
            logger.exception("Dataplex resource quota exceeded during data asset deletion.")
            raise exceptions.ResourceQuotaExceededError(
                "Dataplex resource quota exceeded during data asset deletion."
            ) from e
        except api_exceptions.GoogleAPICallError as e:
            logger.exception("Failed to delete data asset in the knowledge catalog.")
            raise exceptions.FailedOperationError(
                "Failed to delete data asset in the knowledge catalog."
            ) from e

    def _map_data_product_to_info(
        self, data_product: dataplex.DataProduct
    ) -> dp_client_model.DataProductInfo:
        """Maps a Data Product to DataProductInfo."""

        # The name field will be tokenized to extract the field information based on the following
        # format: projects/{project_id}/locations/{location_id}/dataProducts/{data_product_id}
        tokens = data_product.name.split("/")
        project_id = tokens[1]
        location = tokens[3]
        data_product_id = tokens[5]

        return dp_client_model.DataProductInfo(
            id=data_product_id,
            project_id=project_id,
            location=location,
            display_name=data_product.display_name,
            owner_emails=tuple(data_product.owner_emails),
            description=data_product.description,
            labels=data_product.labels,
        )

    def _map_data_asset_to_info(
        self, data_asset: dataplex.DataAsset
    ) -> dp_client_model.DataAssetInfo:
        """Maps a Data Asset to DataAssetInfo."""

        return dp_client_model.DataAssetInfo(
            id=data_asset.name.split("/")[-1],
            resource_name=data_asset.name,
            linked_resource=data_asset.resource,
        )

    def _map_bigquery_asset_links_to_data_assets(
        self, bigquery_asset_links: dp_client_model.BigQueryAssetLinks
    ) -> list[dataplex.DataAsset]:
        """Maps BigQueryAssetLinks to a list of DataAssets."""

        dataset_ids = frozenset(bigquery_asset_links.dataset_ids)
        table_infos = frozenset(bigquery_asset_links.table_infos)
        bigquery_project_id = bigquery_asset_links.bigquery_project_id or self._project_id

        # Return a list as protobuf messages are not hashable
        data_assets: list[dataplex.DataAsset] = []

        for dataset_id in dataset_ids:
            data_assets.append(
                self._build_bigquery_dataset_data_asset(bigquery_project_id, dataset_id)
            )

        for table_info in table_infos:
            data_assets.append(
                self._build_bigquery_table_data_asset(
                    bigquery_project_id, table_info.dataset_id, table_info.table_id
                )
            )

        return data_assets

    def _build_bigquery_dataset_data_asset(
        self, bigquery_project_id: str, dataset_id: str
    ) -> dataplex.DataAsset:
        """Build a Data Product Asset using the provided information of the bigquery dataset."""

        return dataplex.DataAsset(
            resource=f"//bigquery.googleapis.com/projects/{bigquery_project_id}/datasets/{dataset_id}",
        )

    def _build_bigquery_table_data_asset(
        self, bigquery_project_id: str, dataset_id: str, table_id: str
    ) -> dataplex.DataAsset:
        """Build a Data Product Asset using the provided information of the bigquery table."""

        return dataplex.DataAsset(
            resource=f"//bigquery.googleapis.com/projects/{bigquery_project_id}/datasets/{dataset_id}/tables/{table_id}",
        )
