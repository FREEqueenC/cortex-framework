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

from common.clients.resource_manager import ResourceManagerClient
from common.schemas.config_schema import (
    DatasetConfig,
    GlobalConfig,
    SAPModuleConfig,
    SAPModuleSettings,
)
from common.schemas.enums import SapVersion
from common.services.sample_data_seeder import SampleDataSeeder


class MockModules:
    def __init__(self, foundation=None):
        self.foundation = foundation or []


class MockData:
    def __init__(self, modules, big_query_location="US"):
        self.modules = modules
        self.big_query_location = big_query_location


@pytest.fixture
def mock_global_config():
    foundation_module = SAPModuleConfig(
        moduleId="sap_ecc",
        enabled=True,
        type="cortex.sap",  # type: ignore[arg-type]
        moduleSettings=SAPModuleSettings(sapVersion=SapVersion.ECC, mandt="100"),
        dataTargetId="dest_ds",
        dataSourceId="source_ds",
        tableSettings="...",
    )
    modules = MockModules(foundation=[foundation_module])
    data = MockData(modules=modules, big_query_location="US")

    config = MagicMock(spec=GlobalConfig)
    config.data = data

    mock_source = DatasetConfig(id="source_ds", projectId="target-proj", datasetId="sap_raw_ds")
    config.get_data_source.return_value = mock_source

    return config


def test_get_ephemeral_bucket_name_with_project_number(mock_global_config):
    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.return_value = "123456789012"

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client
    bucket_name = seeder._get_ephemeral_bucket_name("target-proj", "US")

    assert bucket_name == "cortex-demo-seed-123456789012-us"
    mock_rm_client.get_project_number.assert_called_once_with("target-proj")


def test_get_ephemeral_bucket_name_fallback_to_hash(mock_global_config):
    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.side_effect = Exception("API not enabled")

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client

    with pytest.raises(ValueError) as exc_info:
        seeder._get_ephemeral_bucket_name("target-proj", "US")

    assert "Failed to fetch project number for target-proj" in str(exc_info.value)
    mock_rm_client.get_project_number.assert_called_once_with("target-proj")


@patch("common.services.sample_data_seeder.uuid.uuid4")
@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_success(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_uuid_class,
    mock_global_config,
):
    # Setup mock uuid
    mock_uuid = MagicMock()
    mock_uuid.hex = "mocked-run-uuid"
    mock_uuid_class.return_value = mock_uuid

    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.return_value = "123456789012"

    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = False
    mock_storage_client.create_bucket.return_value = True
    mock_storage_client.copy_objects.return_value = True

    # Mock blobs in the bucket
    mock_blob1 = MagicMock()
    mock_blob1.name = "mocked-run-uuid/sap/ecc/kna1/00000000.parquet"
    mock_blob2 = MagicMock()
    mock_blob2.name = "mocked-run-uuid/sap/ecc/lfa1/00000000.parquet"

    def list_blobs_side_effect(bucket_name, prefix=None):
        if prefix == "mocked-run-uuid/sap/ecc":
            return [mock_blob1, mock_blob2]
        return []

    mock_storage_client._client.list_blobs.side_effect = list_blobs_side_effect

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client
    mock_bq_client.load_table_from_parquet.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is True
    mock_storage_client.bucket_exists.assert_called_once_with("cortex-demo-seed-123456789012-us")
    mock_storage_client.create_bucket.assert_called_once_with(
        "cortex-demo-seed-123456789012-us", location="US"
    )
    mock_storage_client.copy_objects.assert_called_once_with(
        source_bucket_name="cortex-framework-public",
        source_prefix="demo-sample-data/rel700/sap/ecc",
        dest_bucket_name="cortex-demo-seed-123456789012-us",
        dest_prefix="mocked-run-uuid/sap/ecc",
    )
    # Step 3 lists tables using the prefix with sap version
    mock_storage_client._client.list_blobs.assert_any_call(
        "cortex-demo-seed-123456789012-us", prefix="mocked-run-uuid/sap/ecc"
    )
    assert mock_bq_client.load_table_from_parquet.call_count == 2
    # Step 4 cleanup deletes the ephemeral bucket
    mock_storage_client.delete_bucket.assert_called_once_with(
        "cortex-demo-seed-123456789012-us", force=True
    )


@patch("common.services.sample_data_seeder.uuid.uuid4")
@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_failure_gcs_copy(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_uuid_class,
    mock_global_config,
):
    # Setup mock uuid
    mock_uuid = MagicMock()
    mock_uuid.hex = "mocked-run-uuid"
    mock_uuid_class.return_value = mock_uuid

    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.return_value = "123456789012"

    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = False
    mock_storage_client.create_bucket.return_value = True
    mock_storage_client.copy_objects.return_value = False

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is False
    mock_storage_client.copy_objects.assert_called_once()
    # Ephemeral bucket must still be cleaned up even on failure
    mock_storage_client.delete_bucket.assert_called_once_with(
        "cortex-demo-seed-123456789012-us", force=True
    )


@patch("common.services.sample_data_seeder.uuid.uuid4")
@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_failure_bq_load(
    mock_bq_manager_class,
    mock_storage_manager_class,
    mock_uuid_class,
    mock_global_config,
):
    # Setup mock uuid
    mock_uuid = MagicMock()
    mock_uuid.hex = "mocked-run-uuid"
    mock_uuid_class.return_value = mock_uuid

    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.return_value = "123456789012"

    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True
    mock_storage_client.copy_objects.return_value = True

    # Mock blobs in the bucket
    mock_blob = MagicMock()
    mock_blob.name = "mocked-run-uuid/sap/ecc/kna1/00000000.parquet"

    def list_blobs_side_effect(bucket_name, prefix=None):
        if prefix == "mocked-run-uuid/sap/ecc":
            return [mock_blob]
        return []

    mock_storage_client._client.list_blobs.side_effect = list_blobs_side_effect

    mock_bq_client = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_client
    # Load table fails
    mock_bq_client.load_table_from_parquet.return_value = False

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client
    seeder.storage_client = mock_storage_client
    seeder.bq_client = mock_bq_client

    result = seeder.seed_sample_data()

    assert result is False
    mock_bq_client.load_table_from_parquet.assert_called_once()
    # Ephemeral bucket must still be cleaned up even on failure
    mock_storage_client.delete_bucket.assert_called_once_with(
        "cortex-demo-seed-123456789012-us", force=True
    )


@patch("common.services.sample_data_seeder.storage.StorageManager")
@patch("common.services.sample_data_seeder.bigquery.BigQueryManager")
def test_seed_sample_data_failure_resource_manager_exception(
    mock_bq_manager_class, mock_storage_manager_class, mock_global_config
):
    mock_rm_client = MagicMock(spec=ResourceManagerClient)
    mock_rm_client.get_project_number.side_effect = Exception("API not enabled")

    seeder = SampleDataSeeder(mock_global_config)
    seeder.resource_manager_client = mock_rm_client

    with pytest.raises(ValueError) as exc_info:
        seeder.seed_sample_data()

    assert "Failed to fetch project number for target-proj" in str(exc_info.value)


@patch("common.services.sample_data_seeder.storage.StorageManager")
def test_ensure_ephemeral_bucket_exists(mock_storage_manager_class, mock_global_config):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client

    result = seeder._ensure_ephemeral_bucket(
        "test-bucket", "US", storage_client=mock_storage_client
    )

    assert result is True
    mock_storage_client.bucket_exists.assert_called_once_with("test-bucket")
    mock_storage_client.create_bucket.assert_not_called()


@patch("common.services.sample_data_seeder.storage.StorageManager")
def test_ensure_ephemeral_bucket_create_success(mock_storage_manager_class, mock_global_config):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = False
    mock_storage_client.create_bucket.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client

    result = seeder._ensure_ephemeral_bucket(
        "test-bucket", "US", storage_client=mock_storage_client
    )

    assert result is True
    mock_storage_client.bucket_exists.assert_called_once_with("test-bucket")
    mock_storage_client.create_bucket.assert_called_once_with("test-bucket", location="US")


@patch("common.services.sample_data_seeder.storage.StorageManager")
def test_ensure_ephemeral_bucket_create_failure(mock_storage_manager_class, mock_global_config):
    mock_storage_client = MagicMock()
    mock_storage_manager_class.return_value = mock_storage_client
    mock_storage_client.bucket_exists.return_value = False
    mock_storage_client.create_bucket.return_value = False

    seeder = SampleDataSeeder(mock_global_config)
    seeder.storage_client = mock_storage_client

    result = seeder._ensure_ephemeral_bucket(
        "test-bucket", "US", storage_client=mock_storage_client
    )

    assert result is False
    mock_storage_client.bucket_exists.assert_called_once_with("test-bucket")
    mock_storage_client.create_bucket.assert_called_once_with("test-bucket", location="US")


def test_extract_table_names(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)

    # Create mock GCS blob objects
    blob1 = MagicMock()
    blob1.name = "run123/sap/s4/kna1/00000.parquet"
    blob2 = MagicMock()
    blob2.name = "run123/sap/s4/lfa1/00000.parquet"
    blob3 = MagicMock()
    blob3.name = "run123/sap/s4/kna1/00001.parquet"  # Duplicate table name kna1
    blob4 = MagicMock()
    blob4.name = "run123/sap/s4/somefile.parquet"  # No nested table folder

    blobs = [blob1, blob2, blob3, blob4]

    result = seeder._extract_table_names(blobs, prefix="run123/sap/s4")

    assert result == ["kna1", "lfa1"]
