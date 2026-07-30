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

from unittest.mock import MagicMock

import pytest
from google.api_core.exceptions import NotFound
from google.cloud import bigquery

from common.clients.bq.bigquery import BigQueryManager
from common.clients.bq.model import TableInfo
from common.schemas.config_schema import GlobalConfig


# Mock Dataclass-like config structure for testing
class MockModule:
    def __init__(self, enabled=True, big_query_target=None):
        self.enabled = enabled
        self.big_query_target = big_query_target


class MockTarget:
    def __init__(self, project_id=None, dataset_id=None):
        self.project_id = project_id
        self.dataset_id = dataset_id


class MockData:
    def __init__(self, modules, big_query_location="US"):
        self.modules = modules
        self.big_query_location = big_query_location


class MockModules:
    def __init__(self, foundation=None, product=None):
        self.foundation = foundation or []
        self.product = product or []


@pytest.fixture
def mock_global_config():
    foundation_module = MockModule(
        enabled=True,
        big_query_target=MockTarget(project_id="source-proj", dataset_id="foundation-ds"),
    )
    product_module = MockModule(
        enabled=True, big_query_target=MockTarget(project_id="source-proj", dataset_id="product-ds")
    )
    disabled_module = MockModule(
        enabled=False,
        big_query_target=MockTarget(project_id="source-proj", dataset_id="disabled-ds"),
    )

    modules = MockModules(foundation=[foundation_module, disabled_module], product=[product_module])
    data = MockData(modules=modules, big_query_location="US")

    config = MagicMock(spec=GlobalConfig)
    config.data = data
    return config


def test_ensure_datasets_success():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.get_dataset.return_value = MagicMock()

    bq_client = BigQueryManager(clients={"proj1": mock_client, "proj2": mock_client})
    result = bq_client.ensure_datasets(datasets=[("proj1", "ds1"), ("proj2", "ds2")], location="US")
    assert result is True
    assert mock_client.get_dataset.call_count == 2


def test_ensure_datasets_create_dataset():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.get_dataset.side_effect = NotFound("Dataset not found")

    bq_client = BigQueryManager(clients={"proj1": mock_client, "proj2": mock_client})
    result = bq_client.ensure_datasets(datasets=[("proj1", "ds1"), ("proj2", "ds2")], location="US")
    assert result is True
    assert mock_client.create_dataset.call_count == 2


def test_ensure_datasets_exception_handling():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.get_dataset.side_effect = Exception("Generic error")

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    result = bq_client.ensure_datasets(datasets=[("proj1", "ds1")], location="US")
    assert result is False


# -- Tests for copy_tables --


def test_copy_tables_success():
    mock_client = MagicMock(spec=bigquery.Client)

    mock_table1 = MagicMock()
    mock_table1.table_id = "table_1"
    mock_table2 = MagicMock()
    mock_table2.table_id = "table_2"
    mock_client.list_tables.return_value = [mock_table1, mock_table2]

    mock_job = MagicMock()
    mock_client.copy_table.return_value = mock_job

    bq_client = BigQueryManager(clients={"dest-proj": mock_client})
    result = bq_client.copy_tables(
        source_project="source-proj",
        source_dataset="source-ds",
        source_location="US",
        dest_project="dest-proj",
        dest_dataset="dest-ds",
        dest_location="US",
    )

    assert result is True
    assert mock_client.list_tables.call_count == 1
    assert mock_client.copy_table.call_count == 2
    mock_job.result.assert_called()


def test_copy_tables_location_mismatch():
    mock_client = MagicMock(spec=bigquery.Client)

    bq_client = BigQueryManager(clients={"dest-proj": mock_client})
    result = bq_client.copy_tables(
        source_project="source-proj",
        source_dataset="source-ds",
        source_location="US",
        dest_project="dest-proj",
        dest_dataset="dest-ds",
        dest_location="EU",
    )

    assert result is False
    assert mock_client.list_tables.call_count == 0


def test_copy_tables_list_failed():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.list_tables.side_effect = Exception("List failed")

    bq_client = BigQueryManager(clients={"dest-proj": mock_client})
    result = bq_client.copy_tables(
        source_project="source-proj",
        source_dataset="source-ds",
        source_location="US",
        dest_project="dest-proj",
        dest_dataset="dest-ds",
        dest_location="US",
    )

    assert result is False


def test_copy_tables_job_failed():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_table = MagicMock()
    mock_table.table_id = "table_fail"
    mock_client.list_tables.return_value = [mock_table]

    mock_client.copy_table.side_effect = Exception("Copy job failed")

    bq_client = BigQueryManager(clients={"dest-proj": mock_client})
    result = bq_client.copy_tables(
        source_project="source-proj",
        source_dataset="source-ds",
        source_location="US",
        dest_project="dest-proj",
        dest_dataset="dest-ds",
        dest_location="US",
    )

    assert result is False


# -- Tests for delete_dataset --


def test_delete_dataset_success():
    mock_client = MagicMock(spec=bigquery.Client)

    bq_client = BigQueryManager(clients={"test-proj": mock_client})
    result = bq_client.delete_dataset(
        project_id="test-proj", dataset_id="test-ds", delete_contents=True, not_found_ok=True
    )

    assert result is True
    mock_client.delete_dataset.assert_called_once_with(
        "test-proj.test-ds", delete_contents=True, not_found_ok=True
    )


def test_delete_dataset_exception():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.delete_dataset.side_effect = Exception("Delete failed")

    bq_client = BigQueryManager(clients={"test-proj": mock_client})
    result = bq_client.delete_dataset(project_id="test-proj", dataset_id="test-ds")

    assert result is False
    mock_client.delete_dataset.assert_called_once()


def test_get_dataset_exists():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_dataset = MagicMock(spec=bigquery.Dataset)
    mock_client.get_dataset.return_value = mock_dataset

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    result = bq_client.get_dataset(project_id="proj1", dataset_id="ds1")
    assert result == mock_dataset
    mock_client.get_dataset.assert_called_once_with("proj1.ds1")


def test_get_dataset_not_found():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.get_dataset.side_effect = NotFound("Dataset not found")

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    result = bq_client.get_dataset(project_id="proj1", dataset_id="ds1")
    assert result is None
    mock_client.get_dataset.assert_called_once_with("proj1.ds1")


def test_get_dataset_exception():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.get_dataset.side_effect = Exception("Generic error")

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    with pytest.raises(Exception) as excinfo:
        bq_client.get_dataset(project_id="proj1", dataset_id="ds1")
    assert "Generic error" in str(excinfo.value)


# -- Tests for list_dataset_tables --


def test_list_dataset_tables_success():
    mock_client = MagicMock(spec=bigquery.Client)

    mock_item1 = MagicMock()
    mock_item1.table_id = "table_1"
    mock_item1.labels = {"key1": "val1"}

    mock_item2 = MagicMock()
    mock_item2.table_id = "table_2"
    mock_item2.labels = {"key2": "val2"}

    mock_client.list_tables.return_value = [mock_item1, mock_item2]

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    result = bq_client.list_dataset_tables(project_id="proj1", dataset_id="ds1")

    assert len(result) == 2
    assert result[0] == TableInfo(id="table_1", dataset_id="ds1", labels={"key1": "val1"})
    assert result[1] == TableInfo(id="table_2", dataset_id="ds1", labels={"key2": "val2"})

    mock_client.list_tables.assert_called_once_with(
        "proj1.ds1", retry=bq_client._bigquery_read_retry
    )


def test_list_dataset_tables_list_error():
    mock_client = MagicMock(spec=bigquery.Client)
    mock_client.list_tables.side_effect = Exception("API error")

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    from common.clients.model import exception as exceptions

    with pytest.raises(exceptions.FailedOperationError) as excinfo:
        bq_client.list_dataset_tables(project_id="proj1", dataset_id="ds1")
    assert "Failed to list bigquery tables in proj1.ds1" in str(excinfo.value)


def test_list_dataset_tables_missing_labels():
    mock_client = MagicMock(spec=bigquery.Client)

    mock_item1 = MagicMock()
    mock_item1.table_id = "table_1"
    mock_item1.labels = {"key1": "val1"}

    mock_item2 = MagicMock()
    mock_item2.table_id = "table_2"
    mock_item2.labels = None

    mock_client.list_tables.return_value = [mock_item1, mock_item2]

    bq_client = BigQueryManager(clients={"proj1": mock_client})
    result = bq_client.list_dataset_tables(project_id="proj1", dataset_id="ds1")

    assert len(result) == 2
    assert result[0] == TableInfo(id="table_1", dataset_id="ds1", labels={"key1": "val1"})
    assert result[1] == TableInfo(id="table_2", dataset_id="ds1", labels={})
