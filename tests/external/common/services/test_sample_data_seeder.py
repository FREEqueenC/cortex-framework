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

from common.schemas.config_schema import (
    DatasetConfig,
    GlobalConfig,
    SAPModuleConfig,
    SAPModuleSettings,
)
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
        module_id="sap_ecc",
        enabled=True,
        type="cortex.sap",
        module_settings=SAPModuleSettings(sap_version="ecc", mandt="100"),
        data_target_id="dest_ds",
        data_source_id="source_ds",
        table_settings="...",
    )
    modules = MockModules(foundation=[foundation_module])
    data = MockData(modules=modules, big_query_location="US")

    config = MagicMock(spec=GlobalConfig)
    config.data = data

    mock_source = DatasetConfig(id="source_ds", project_id="target-proj", dataset_id="sap_raw_ds")
    config.get_data_source.return_value = mock_source

    return config


def test_get_source_dataset_found(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)
    result = seeder._get_source_dataset(module_type="sap", module_version="ecc", location="US")
    assert result == "sap__rawecc__6_3__us"


def test_get_source_dataset_with_hyphen_location(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)
    result = seeder._get_source_dataset(
        module_type="sap",
        module_version="s4",
        location="northamerica-northeast2",
    )
    assert result == "sap__raws4__6_3__northamerica_northeast2"


def test_get_source_dataset_not_found(mock_global_config):
    seeder = SampleDataSeeder(mock_global_config)

    result = seeder._get_source_dataset(module_type="unknown", module_version="1.0", location="US")
    assert result is None


@patch("common.services.sample_data_seeder.BigQueryManager")
def test_seed_sample_data_success(mock_bq_manager_class, mock_global_config):
    mock_bq_manager = MagicMock()
    mock_bq_manager_class.return_value = mock_bq_manager
    mock_bq_manager.copy_tables.return_value = True

    seeder = SampleDataSeeder(mock_global_config)
    result = seeder.seed_sample_data()

    assert result is True
    mock_bq_manager.copy_tables.assert_called_once_with(
        source_project="kittycorn-public",
        source_dataset="sap__rawecc__6_3__us",
        source_location="US",
        dest_project="target-proj",
        dest_dataset="sap_raw_ds",
        dest_location="US",
    )
