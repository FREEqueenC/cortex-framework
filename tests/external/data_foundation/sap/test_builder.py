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

from unittest import mock

import pytest
import yaml

from common.schemas.config_schema import GlobalConfig, SAPModuleConfig, SAPModuleSettings
from common.schemas.enums import SapVersion
from data_modules.cortex.data_foundation.sap.builder import SapDataFoundationBuilder


@pytest.fixture
def mock_global_config():
    config = mock.MagicMock(spec=GlobalConfig)
    config.get_data_source.return_value = mock.MagicMock(
        project_id="source-proj", dataset_id="source-ds"
    )
    config.build_environment = mock.MagicMock()
    config.build_environment.project_id = "build-proj"
    config.build_environment.dataset_id = "build-ds"
    return config


@pytest.fixture
def mock_module_config():
    config = mock.MagicMock(spec=SAPModuleConfig)
    config.module_settings = SAPModuleSettings(sapVersion=SapVersion.ECC, mandt="100")
    config.type = "sap"
    config.data_source_id = "sap_source"
    config.external = False
    return config


def test_build_with_required_tables_filters_output(
    tmp_path, mock_global_config, mock_module_config
):
    # Setup table settings
    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "common": [
            {"source": {"tableName": "MARA"}, "target": {"tableName": "mara"}},
            {"source": {"tableName": "KNA1"}, "target": {"tableName": "kna1"}},
        ]
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    mock_provider = mock.MagicMock()
    mock_provider.get_schema_and_keys.return_value = ([], [], {})

    builder = SapDataFoundationBuilder()

    sources_registry = set()
    mock_manifest = mock.MagicMock()

    mock_module_config.table_settings = "table_settings.yaml"
    mock_module_config._table_settings_explicit = True

    builder.build(
        module_id="erp",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=tmp_path / "annotations",
        output_dir=output_dir,
        module_dir_name="erp",
        sources_registry=sources_registry,
        provider=mock_provider,
        table_settings_file=table_settings_file,
        required_tables={"KNA1"},
    )

    # Verify that only KNA1 was processed/registered!
    assert len(sources_registry) == 1
    source = list(sources_registry)[0]
    assert source.table == "KNA1"


def test_build_with_deploy_always_ignores_filter(tmp_path, mock_global_config, mock_module_config):
    # Setup table settings
    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "common": [
            {
                "source": {"tableName": "MARA"},
                "target": {"tableName": "mara"},
                "deployAlways": True,
            },
            {"source": {"tableName": "KNA1"}, "target": {"tableName": "kna1"}},
        ]
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    mock_provider = mock.MagicMock()
    mock_provider.get_schema_and_keys.return_value = ([], [], {})

    builder = SapDataFoundationBuilder()

    sources_registry = set()
    mock_manifest = mock.MagicMock()

    builder.build(
        module_id="erp",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=tmp_path / "annotations",
        output_dir=output_dir,
        module_dir_name="erp",
        sources_registry=sources_registry,
        provider=mock_provider,
        table_settings_file=table_settings_file,
        required_tables={"KNA1"},  # MARA is not in required, but has deploy_always
    )

    assert len(sources_registry) == 2
    tables = {s.table for s in sources_registry}
    assert "MARA" in tables
    assert "KNA1" in tables
