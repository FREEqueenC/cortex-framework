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

import json
import re
from unittest import mock

import pytest
import yaml

from common.builders.sap_product_builder import SapProductBuilder
from common.errors import CortexConfigError
from common.schemas.config_schema import (
    DataProductModuleConfig,
    GlobalConfig,
    SAPModuleConfig,
    SAPModuleSettings,
)
from common.schemas.enums import SapVersion
from common.schemas.manifest_schema import ManifestConfig, SapDependencyInfo


@pytest.fixture
def mock_global_config():
    config = mock.MagicMock(spec=GlobalConfig)
    # Mock data source
    config.get_dataset.return_value = mock.MagicMock(
        project_id="source-proj", dataset_id="source-ds"
    )
    # Mock global modules
    dep_module = mock.MagicMock(spec=SAPModuleConfig)
    dep_module.module_id = "erp"
    dep_module.enabled = True
    dep_module.module_path = "cortex.sap.foundations.sap"
    dep_module.module_settings = SAPModuleSettings.model_validate(
        {"sapVersion": SapVersion.S4, "mandt": "100"}
    )
    config.data = mock.MagicMock()
    config.data.modules.foundation = [dep_module]
    config.data.modules.product = []
    return config


@pytest.fixture
def mock_module_config():
    config = mock.MagicMock(spec=DataProductModuleConfig)
    config.dependency_bindings = {"sapModule": "erp"}
    config.module_path = "cortex.material_ledger"
    config.namespaced_type = "cortex.product.sap.material_ledger"
    return config


@pytest.fixture
def mock_manifest():
    manifest = mock.MagicMock(spec=ManifestConfig)
    dep_info = mock.MagicMock(spec=SapDependencyInfo)
    dep_info.module_path = "cortex.sap.foundations.sap"
    manifest.dependencies = {"sapModule": dep_info}
    manifest.category = None
    manifest.type = None
    return manifest


def test_build_skips_disabled_tables(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    # Setup temporary layout
    # parent_definitions_dir / sap_version / table.js
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    table2_file = definitions_dir / "table2.js"
    table2_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table2');",
        encoding="utf-8",
    )

    # Table settings
    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "s4": {
            "table1": {"enabled": True, "tags": ["tag1"]},
            "table2": {"enabled": False, "tags": ["tag2"]},
        }
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    builder = SapProductBuilder()
    builder.build(
        module_id="sap_material_ledger",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="material_ledger",
        sources_registry=set(),
        table_settings_file=table_settings_file,  # type: ignore[call-arg]
    )

    # Verify that only table1 was processed/copied, and table2 was skipped
    assert (output_dir / "table1.js").exists()
    assert not (output_dir / "table2.js").exists()

    content1 = (output_dir / "table1.js").read_text()
    assert "tag1" in content1


def test_build_copies_all_enabled_tables_by_default(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    table2_file = definitions_dir / "table2.js"
    table2_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table2');",
        encoding="utf-8",
    )

    # Empty table settings
    table_settings_file = tmp_path / "table_settings.yaml"
    with open(table_settings_file, "w") as f:
        yaml.dump({"common": {}}, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    builder = SapProductBuilder()
    builder.build(
        module_id="sap_material_ledger",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="material_ledger",
        sources_registry=set(),
        table_settings_file=table_settings_file,  # type: ignore[call-arg]
    )

    # By default (no settings specified), both tables should be copied
    assert (output_dir / "table1.js").exists()
    assert (output_dir / "table2.js").exists()


def test_build_injects_table_settings(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    # Settings with tags, materialization, partition, cluster, and extra fields
    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "s4": {
            "table1": {
                "tags": ["custom_tag"],
                "materializationType": "table",
                "partitionDetails": {
                    "column": "date_field",
                    "partitionType": "DATE",
                    "timeGrain": "day",
                },
                "clusterDetails": {"columns": ["id_field"]},
                "extraProperty": "extra_val",
            }
        }
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    builder = SapProductBuilder()
    builder.build(
        module_id="sap_material_ledger",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="material_ledger",
        sources_registry=set(),
        table_settings_file=table_settings_file,  # type: ignore[call-arg]
    )

    content = (output_dir / "table1.js").read_text()
    match = re.search(r"const tableConfig = (\{.*?\});", content, re.DOTALL)
    assert match is not None
    table_config = json.loads(match.group(1))

    assert table_config["tableName"] == "table1"
    assert table_config["tags"] == ["custom_tag"]
    assert table_config["materializationType"] == "table"
    assert table_config["extraProperty"] == "extra_val"
    assert table_config["bigquery"] == {
        "partitionBy": "DATE(date_field)",
        "clusterBy": ["id_field"],
        "labels": {
            "module_id": "sap_material_ledger",
            "namespaced_module_type": "cortex_product_sap_material_ledger",
        },
    }


def test_build_merges_common_and_version_settings(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "common": {
            "table1": {
                "tags": ["common_tag"],
                "materializationType": "view",
            }
        },
        "s4": {
            "table1": {
                "tags": ["s4_tag"],
            }
        },
    }
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    builder = SapProductBuilder()
    builder.build(
        module_id="sap_material_ledger",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="material_ledger",
        sources_registry=set(),
        table_settings_file=table_settings_file,  # type: ignore[call-arg]
    )

    content = (output_dir / "table1.js").read_text()
    match = re.search(r"const tableConfig = (\{.*?\});", content, re.DOTALL)
    assert match is not None
    table_config = json.loads(match.group(1))

    # Tags should be overridden by S4 version, and materializationType
    # is also overridden (defaulting back to incremental)
    assert table_config["tags"] == ["s4_tag"]
    assert table_config["materializationType"] == "incremental"


def test_build_injects_annotations(tmp_path, mock_global_config, mock_module_config, mock_manifest):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    table_settings_file = tmp_path / "table_settings.yaml"
    with open(table_settings_file, "w") as f:
        yaml.dump({"common": {}}, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    # Place S4 annotations
    annotations_dir = module_src_dir / "annotations"
    s4_annotations_dir = annotations_dir / "s4"
    s4_annotations_dir.mkdir(parents=True)

    annotation_file = s4_annotations_dir / "table1.yaml"
    annotation_content = {
        "description": "Table description from S4 annotation file",
        "fields": [
            {"name": "col1", "description": "col1 description"},
            {"name": "col2", "description": "col2 description"},
        ],
    }
    with open(annotation_file, "w") as f:
        yaml.dump(annotation_content, f)

    builder = SapProductBuilder()
    builder.build(
        module_id="sap_material_ledger",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="material_ledger",
        sources_registry=set(),
        table_settings_file=table_settings_file,  # type: ignore[call-arg]
    )

    content = (output_dir / "table1.js").read_text()
    match = re.search(r"const tableConfig = (\{.*?\});", content, re.DOTALL)
    assert match is not None
    table_config = json.loads(match.group(1))

    assert table_config["description"] == "Table description from S4 annotation file"
    assert table_config["columns"] == {
        "col1": "col1 description",
        "col2": "col2 description",
    }


def test_build_raises_value_error_on_invalid_settings_format(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions" / "s4"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "table1.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('table1');",
        encoding="utf-8",
    )

    table_settings_file = tmp_path / "table_settings.yaml"
    # Invalid S4 settings format: list instead of dict
    settings = {"s4": [{"table1": {"enabled": True}}]}
    with open(table_settings_file, "w") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    builder = SapProductBuilder()
    with pytest.raises(
        CortexConfigError, match="Invalid table settings format for module 'sap_material_ledger'"
    ):
        builder.build(
            module_id="sap_material_ledger",
            module_config=mock_module_config,
            global_config=mock_global_config,
            manifest=mock_manifest,
            base_dir=tmp_path,
            annotations_dir=annotations_dir,
            output_dir=output_dir,
            module_dir_name="material_ledger",
            sources_registry=set(),
            table_settings_file=table_settings_file,  # type: ignore[call-arg]
        )
