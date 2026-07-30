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

import pathlib
from unittest.mock import MagicMock, patch

import pytest

import common.services.dataplex.model as service_model
from common.clients.dataplex.model import (
    BigQueryAssetLinks,
    BigQueryTableInfo,
    DataAssetInfo,
    DataProduct,
    DataProductInfo,
)
from common.clients.model.exception import NotFoundError
from common.services.dataplex.data_products_sync import DataProductsSyncer
from tools import kc_sync


@pytest.fixture
def mock_bigquery_manager():
    with patch(
        "common.services.dataplex.data_products_sync.bigquery.BigQueryManager"
    ) as mock_class:
        yield mock_class


@pytest.fixture
def mock_config_extractor():
    with patch(
        "common.services.dataplex.data_products_sync.config_extractor.DataProductHandler"
    ) as mock_class:
        yield mock_class


@pytest.fixture
def mock_data_product_client():
    with patch(
        "common.services.dataplex.data_products_sync.dp_client.DataProductClient"
    ) as mock_class:
        yield mock_class


def test_sync_creates_new_data_product_when_not_found(
    mock_bigquery_manager, mock_config_extractor, mock_data_product_client
):
    extractor_instance = mock_config_extractor.return_value
    client_instance = mock_data_product_client.return_value

    mock_product = service_model.data_product.DeploymentInfo(
        id="sap_vendors",
        project_id="proj",
        location="loc",
        bigquery_dataset_id="ds",
        bigquery_table_ids=("t1",),
        manifest_info=service_model.data_product.ManifestInfo(
            module_type="sap_vendors",
            category="sap",
            display_name="Vendors",
            description="Vendors description",
        ),
    )
    extractor_instance.extract_deployed_data_products.return_value = [mock_product]

    # Mock get_data_product to raise NotFoundError
    client_instance.get_data_product.side_effect = NotFoundError("Not found")

    syncer = DataProductsSyncer(
        kc_project_id="kc-proj",
        global_config=MagicMock(),
        module_provider=MagicMock(),
        owner_email="cortex-support@google.com",
    )
    syncer.sync_data_products()

    mock_data_product_client.assert_called_once_with(project_id="kc-proj")
    client_instance.get_data_product.assert_called_once_with(
        location="loc", data_product_id="sap-vendors"
    )

    # Assert create_data_product was called with correct data product info and assets
    expected_info = DataProductInfo(
        id="sap-vendors",
        project_id="kc-proj",
        location="loc",
        display_name="Vendors",
        description="Vendors description",
        owner_emails=("cortex-support@google.com",),
    )
    expected_assets = BigQueryAssetLinks(
        bigquery_project_id="proj",
        table_infos=(BigQueryTableInfo(dataset_id="ds", table_id="t1"),),
    )
    client_instance.create_data_product.assert_called_once_with(
        data_product_info=expected_info,
        bigquery_asset_links=expected_assets,
    )


def test_sync_skips_when_existing_is_not_managed(
    mock_bigquery_manager, mock_config_extractor, mock_data_product_client
):
    extractor_instance = mock_config_extractor.return_value
    client_instance = mock_data_product_client.return_value

    mock_product = service_model.data_product.DeploymentInfo(
        id="sap_vendors",
        project_id="proj",
        location="loc",
        bigquery_dataset_id="ds",
        bigquery_table_ids=("t1",),
        manifest_info=service_model.data_product.ManifestInfo(
            module_type="sap_vendors",
            category="sap",
            display_name="Vendors",
            description="Vendors description",
        ),
    )
    extractor_instance.extract_deployed_data_products.return_value = [mock_product]

    # Mock existing managed check
    existing_dp = MagicMock()
    client_instance.get_data_product.return_value = existing_dp
    client_instance.is_managed_data_product.return_value = False

    syncer = DataProductsSyncer(
        kc_project_id="kc-proj",
        global_config=MagicMock(),
        module_provider=MagicMock(),
        owner_email="cortex-support@google.com",
    )
    syncer.sync_data_products()

    client_instance.get_data_product.assert_called_once()
    client_instance.is_managed_data_product.assert_called_once_with(existing_dp)
    # Should skip, meaning create or update are NOT called
    client_instance.create_data_product.assert_not_called()
    client_instance.update_data_product.assert_not_called()


def test_sync_skips_when_no_update_needed(
    mock_bigquery_manager, mock_config_extractor, mock_data_product_client
):
    extractor_instance = mock_config_extractor.return_value
    client_instance = mock_data_product_client.return_value

    mock_product = service_model.data_product.DeploymentInfo(
        id="sap_vendors",
        project_id="proj",
        location="loc",
        bigquery_dataset_id="ds",
        bigquery_table_ids=("t1",),
        manifest_info=service_model.data_product.ManifestInfo(
            module_type="sap_vendors",
            category="sap",
            display_name="Vendors",
            description="Vendors description",
        ),
    )
    extractor_instance.extract_deployed_data_products.return_value = [mock_product]

    client_instance.is_managed_data_product.return_value = True

    # Setup existing to be identical to what is deployed
    existing_info = DataProductInfo(
        id="sap-vendors",
        project_id="kc-proj",
        location="loc",
        display_name="Vendors",
        description="Vendors description",
        owner_emails=("cortex-support@google.com",),
    )
    existing_assets = (
        DataAssetInfo(
            id="t1",
            linked_resource="//bigquery.googleapis.com/projects/proj/datasets/ds/tables/t1",
        ),
    )
    existing_dp = DataProduct(data_product_info=existing_info, data_assets=existing_assets)
    client_instance.get_data_product.return_value = existing_dp

    syncer = DataProductsSyncer(
        kc_project_id="kc-proj",
        global_config=MagicMock(),
        module_provider=MagicMock(),
        owner_email="cortex-support@google.com",
    )
    syncer.sync_data_products()

    # Should not call update since identical
    client_instance.update_data_product.assert_not_called()


def test_sync_updates_when_config_or_assets_change(
    mock_bigquery_manager, mock_config_extractor, mock_data_product_client
):
    extractor_instance = mock_config_extractor.return_value
    client_instance = mock_data_product_client.return_value

    mock_product = service_model.data_product.DeploymentInfo(
        id="sap_vendors",
        project_id="proj",
        location="loc",
        bigquery_dataset_id="ds",
        bigquery_table_ids=("t1",),
        manifest_info=service_model.data_product.ManifestInfo(
            module_type="sap_vendors",
            category="sap",
            display_name="Vendors Updated",
            description="Vendors description",
        ),
    )
    extractor_instance.extract_deployed_data_products.return_value = [mock_product]

    client_instance.is_managed_data_product.return_value = True

    # Setup existing with different display_name
    existing_info = DataProductInfo(
        id="sap-vendors",
        project_id="kc-proj",
        location="loc",
        display_name="Vendors",
        description="Vendors description",
        owner_emails=("cortex-support@google.com",),
    )
    existing_assets = (
        DataAssetInfo(
            id="t1",
            linked_resource="//bigquery.googleapis.com/projects/proj/datasets/ds/tables/t1",
        ),
    )
    existing_dp = DataProduct(data_product_info=existing_info, data_assets=existing_assets)
    client_instance.get_data_product.return_value = existing_dp

    syncer = DataProductsSyncer(
        kc_project_id="kc-proj",
        global_config=MagicMock(),
        module_provider=MagicMock(),
        owner_email="cortex-support@google.com",
    )
    syncer.sync_data_products()

    expected_info = DataProductInfo(
        id="sap-vendors",
        project_id="kc-proj",
        location="loc",
        display_name="Vendors Updated",
        description="Vendors description",
        owner_emails=("cortex-support@google.com",),
    )
    expected_assets = BigQueryAssetLinks(
        bigquery_project_id="proj",
        table_infos=(BigQueryTableInfo(dataset_id="ds", table_id="t1"),),
    )

    client_instance.update_data_product.assert_called_once_with(
        data_product_info=expected_info,
        bigquery_asset_links=expected_assets,
    )


def test_kc_sync_main():
    with (
        patch("tools.kc_sync.argparse.ArgumentParser") as mock_parser,
        patch("tools.kc_sync.data_products_sync.DataProductsSyncer") as mock_syncer_class,
        patch("tools.kc_sync.ConfigLoader") as mock_config_loader,
        patch("tools.kc_sync.InternalModuleProvider"),
        patch("tools.kc_sync.ExternalModuleProvider"),
        patch("tools.kc_sync.UnifiedModuleProvider") as mock_unified,
        patch("pathlib.Path.exists", return_value=True),
    ):
        mock_args = MagicMock()
        mock_args.kc_project_id = "enawara-cortexfs-sandbox"
        mock_args.config = pathlib.Path("config.yaml")
        mock_args.data_modules_root_directory = pathlib.Path("src/data_modules")
        mock_args.owner_email = "cortex-support@google.com"
        mock_parser.return_value.parse_args.return_value = mock_args

        mock_global_config = MagicMock()
        mock_config_loader.load_and_validate.return_value = (mock_global_config, [])

        mock_syncer = mock_syncer_class.return_value
        mock_syncer.__enter__.return_value = mock_syncer

        kc_sync.main([])

        mock_syncer_class.assert_called_once_with(
            kc_project_id="enawara-cortexfs-sandbox",
            global_config=mock_global_config,
            module_provider=mock_unified.return_value,
            owner_email="cortex-support@google.com",
        )
        mock_syncer_class.return_value.sync_data_products.assert_called_once()
