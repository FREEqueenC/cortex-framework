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

from unittest.mock import MagicMock, patch

import pytest

from common.errors import CortexGcpError
from common.schemas.config_schema import DatasetConfig, GlobalConfig, SAPModuleConfig
from common.services.sample_data_seeder import SampleDataSeeder


@pytest.fixture(autouse=True)
def mock_gcp_clients():
    with patch("common.services.sample_data_seeder.bigquery.BigQueryManager"):
        yield


class MockModules:
    def __init__(self, foundation=None, product=None):
        self.foundation = foundation or []
        self.product = product or []


class MockData:
    def __init__(self, modules, big_query_location="US"):
        self.modules = modules
        self.big_query_location = big_query_location


@pytest.fixture
def mock_global_config():
    foundation_module = SAPModuleConfig.model_validate(
        {
            "moduleId": "sap_ecc",
            "moduleType": "sap",
            "enabled": True,
            "modulePath": "cortex.sap.foundations.sap",
            "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
            "dataTargetId": "dest_ds",
            "dataSourceId": "source_ds",
            "tableSettings": "...",
        }
    )
    modules = MockModules(foundation=[foundation_module])
    data = MockData(modules=modules, big_query_location="US")

    config = MagicMock(spec=GlobalConfig)
    config.data = data

    mock_source = DatasetConfig.model_validate(
        {
            "id": "source_ds",
            "projectId": "target-proj",
            "datasetId": "sap_raw_ds",
        }
    )
    config.get_dataset.return_value = mock_source

    return config


def test_get_public_bucket_name(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)
    assert seeder._get_public_bucket_name("US") == "cortex-framework-public-us"
    assert seeder._get_public_bucket_name("us-central1") == "cortex-framework-public-us-central1"
    assert seeder._get_public_bucket_name("EU") == "cortex-framework-public-eu"


@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_success(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_global_config,
):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True

    # Mock blobs in the public bucket
    mock_blob1 = MagicMock()
    mock_blob1.name = "demo-sample-data/rel700/sap/ecc/kna1/00000000.parquet"
    mock_blob2 = MagicMock()
    mock_blob2.name = "demo-sample-data/rel700/sap/ecc/lfa1/00000000.parquet"

    def list_blobs_side_effect(bucket_name, prefix=None):
        if prefix == "demo-sample-data/rel700/sap/ecc":
            return [mock_blob1, mock_blob2]
        return []

    mock_storage_client._client.list_blobs.side_effect = list_blobs_side_effect

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client
    mock_bq_client.load_table_from_parquet.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is True
    mock_storage_client._client.list_blobs.assert_called_once_with(
        "cortex-framework-public-us", prefix="demo-sample-data/rel700/sap/ecc"
    )
    assert mock_bq_client.load_table_from_parquet.call_count == 2
    mock_bq_client.load_table_from_parquet.assert_any_call(
        project_id="target-proj",
        dataset_id="sap_raw_ds",
        table_id="kna1",
        gcs_uris=["gs://cortex-framework-public-us/demo-sample-data/rel700/sap/ecc/kna1/*.parquet"],
        write_disposition="WRITE_TRUNCATE",
    )


@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_idempotent_duplicate_dataset(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_global_config,
):
    # Add a second module pointing to the exact same dataset
    foundation_module2 = SAPModuleConfig.model_validate(
        {
            "moduleId": "sap_ecc_dup",
            "moduleType": "sap",
            "enabled": True,
            "modulePath": "cortex.sap.foundations.sap",
            "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
            "dataTargetId": "dest_ds",
            "dataSourceId": "source_ds",
            "tableSettings": "...",
        }
    )
    mock_global_config.data.modules.foundation.append(foundation_module2)

    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True

    mock_blob1 = MagicMock()
    mock_blob1.name = "demo-sample-data/rel700/sap/ecc/kna1/00000000.parquet"
    mock_storage_client._client.list_blobs.return_value = [mock_blob1]

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client
    mock_bq_client.load_table_from_parquet.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is True
    # Should only load once for the shared dataset
    assert mock_bq_client.load_table_from_parquet.call_count == 1


@patch("common.services.sample_data_seeder.storage.StorageManager")
def test_seed_sample_data_missing_bucket_raises_error(
    mock_storage_manager_class,
    mock_global_config,
):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client._client.list_blobs.side_effect = Exception("Bucket not found")

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client

    with pytest.raises(CortexGcpError) as exc_info:
        seeder.seed_sample_data()

    assert "Failed to access sample data in bucket 'cortex-framework-public-us'" in str(
        exc_info.value
    )


@patch("common.services.sample_data_seeder.storage.StorageManager")
def test_seed_sample_data_no_content_raises_error(
    mock_storage_manager_class,
    mock_global_config,
):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True
    mock_storage_client._client.list_blobs.return_value = []

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client

    with pytest.raises(CortexGcpError) as exc_info:
        seeder.seed_sample_data()

    assert "No sample data found in bucket 'cortex-framework-public-us'" in str(exc_info.value)


@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_failure_bq_load(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_global_config,
):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True

    mock_blob = MagicMock()
    mock_blob.name = "demo-sample-data/rel700/sap/ecc/kna1/00000000.parquet"
    mock_storage_client._client.list_blobs.return_value = [mock_blob]

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client
    mock_bq_client.load_table_from_parquet.return_value = False

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is False
    mock_bq_client.load_table_from_parquet.assert_called_once()


def test_extract_table_names(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)

    blob1 = MagicMock()
    blob1.name = "demo-sample-data/rel700/sap/s4/kna1/00000.parquet"
    blob2 = MagicMock()
    blob2.name = "demo-sample-data/rel700/sap/s4/lfa1/00000.parquet"
    blob3 = MagicMock()
    blob3.name = "demo-sample-data/rel700/sap/s4/kna1/00001.parquet"
    blob4 = MagicMock()
    blob4.name = "demo-sample-data/rel700/sap/s4/somefile.parquet"

    blobs = [blob1, blob2, blob3, blob4]

    result = seeder._extract_table_names(blobs, prefix="demo-sample-data/rel700/sap/s4")

    assert result == ["kna1", "lfa1"]
