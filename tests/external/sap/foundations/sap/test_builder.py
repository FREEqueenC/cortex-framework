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
from typing import Any
from unittest import mock

import pytest
import yaml

from common.errors import CortexConfigError
from common.schemas.annotation_schema import TableAnnotation
from common.schemas.config_schema import GlobalConfig, SAPModuleConfig, SAPModuleSettings
from common.schemas.enums import SapVersion
from common.schemas.table_settings_schema import FoundationTableItem
from data_modules.cortex.sap.foundations.sap.builder import (
    SapDataFoundationBuilder,
    _render_data_foundation_sqlx,
)


@pytest.fixture
def mock_global_config():
    config = mock.MagicMock(spec=GlobalConfig)
    config.get_dataset.return_value = mock.MagicMock(
        project_id="source-proj", dataset_id="source-ds"
    )
    config.build_environment = mock.MagicMock()
    config.build_environment.project_id = "build-proj"
    config.build_environment.dataset_id = "build-ds"
    return config


@pytest.fixture
def mock_module_config():
    config = mock.MagicMock(spec=SAPModuleConfig)
    config.module_settings = SAPModuleSettings.model_validate(
        {"sapVersion": SapVersion.ECC, "mandt": "100"}
    )
    config.type = "sap"
    config.data_source_id = "sap_source"
    config.external = False
    config.namespaced_type = "cortex.foundation.sap.sap"
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

    sources_registry: set[Any] = set()
    mock_manifest = mock.MagicMock()
    mock_manifest.category = None
    mock_manifest.type = None

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

    sources_registry: set[Any] = set()
    mock_manifest = mock.MagicMock()
    mock_manifest.category = None
    mock_manifest.type = None

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


def test_build_raises_cortex_config_error_on_invalid_yaml(
    tmp_path, mock_global_config, mock_module_config
):
    table_settings_file = tmp_path / "table_settings.yaml"
    with open(table_settings_file, "w") as f:
        f.write("invalid: yaml: : :")  # Invalid YAML syntax

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    builder = SapDataFoundationBuilder()
    with pytest.raises(CortexConfigError, match="Invalid table settings file for module"):
        builder.build(
            module_id="erp",
            module_config=mock_module_config,
            global_config=mock_global_config,
            manifest=mock.MagicMock(),
            base_dir=tmp_path,
            annotations_dir=tmp_path / "annotations",
            output_dir=output_dir,
            module_dir_name="erp",
            sources_registry=set(),
            table_settings_file=table_settings_file,
        )


def test_build_raises_cortex_config_error_on_invalid_schema(
    tmp_path, mock_global_config, mock_module_config
):
    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "common": [
            {"source": "invalid_format"}  # Schema expects dict for source
        ]
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    builder = SapDataFoundationBuilder()
    with pytest.raises(CortexConfigError, match="Invalid table settings format for module"):
        builder.build(
            module_id="erp",
            module_config=mock_module_config,
            global_config=mock_global_config,
            manifest=mock.MagicMock(),
            base_dir=tmp_path,
            annotations_dir=tmp_path / "annotations",
            output_dir=output_dir,
            module_dir_name="erp",
            sources_registry=set(),
            table_settings_file=table_settings_file,
        )


def test_render_data_foundation_sqlx_escapes_module_id_rce_payload():
    table_item = FoundationTableItem.model_validate(
        {
            "source": {"tableName": "MARA"},
            "target": {"tableName": "mara", "dataformTags": ["sap", "ecc"]},
        }
    )
    annotations = TableAnnotation(description="Test table description")

    payload_module_id = (
        'erp"; } js { require("child_process").execSync("whoami"); } config { name: "mara'
    )
    sqlx_content = _render_data_foundation_sqlx(
        module_id=payload_module_id,
        table_config=table_item,
        columns=["mandt", "matnr"],
        keys=["mandt", "matnr"],
        column_types={"mandt": "STRING", "matnr": "STRING"},
        annotations=annotations,
    )

    escaped_payload = (
        'erp\\"; } js { require(\\"child_process\\").execSync(\\"whoami\\"); } '
        'config { name: \\"mara'
    )
    expected_db = f'config.foundation["{escaped_payload}"].targetProjectId'
    expected_schema = f'config.foundation["{escaped_payload}"].targetDatasetId'
    expected_src = (
        f'source_ref: ref(config.foundation["{escaped_payload}"].sourceDatasetId, "MARA")'
    )

    assert expected_db in sqlx_content
    assert expected_schema in sqlx_content
    assert expected_src in sqlx_content
    assert 'config.foundation.erp"; }' not in sqlx_content


def test_sap_cdc_js_escapes_bigquery_string():
    sap_cdc_path = pathlib.Path(__file__).parents[5] / "src" / "dataform_includes" / "sap_cdc.js"
    assert sap_cdc_path.exists()
    content = sap_cdc_path.read_text(encoding="utf-8")

    assert "function escapeBigQueryString(str)" in content
    assert "escapeBigQueryString(config.table_description)" in content
    assert "escapeBigQueryString(d)" in content
