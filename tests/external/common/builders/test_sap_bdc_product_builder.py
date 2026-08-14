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

from common.builders.sap_bdc_product_builder import SapBdcProductBuilder
from common.schemas.config_schema import DataProductModuleConfig, GlobalConfig
from common.schemas.manifest_schema import ManifestConfig


@pytest.fixture
def mock_global_config():
    config = mock.MagicMock(spec=GlobalConfig)
    config.data = mock.MagicMock()
    config.data.modules.foundation = []
    config.data.modules.product = []
    return config


@pytest.fixture
def mock_module_config():
    config = mock.MagicMock(spec=DataProductModuleConfig)
    config.dependency_bindings = {
        "sapBdcCustomer": "sap_bdc_catalog.customer_v1.customer",
        "sapBdcSalesOrder": "sap_bdc_catalog.salesorder_v1.salesorder",
    }
    config.module_path = "cortex_samples.sap_bdc.products.sales_performance"
    return config


@pytest.fixture
def mock_manifest():
    manifest = mock.MagicMock(spec=ManifestConfig)
    manifest.dependencies = {
        "sapBdcCustomer": mock.MagicMock(),
        "sapBdcSalesOrder": mock.MagicMock(),
    }
    return manifest


def test_build_sap_bdc_product_success(
    tmp_path, mock_global_config, mock_module_config, mock_manifest
):
    module_src_dir = tmp_path / "src"
    definitions_dir = module_src_dir / "definitions"
    definitions_dir.mkdir(parents=True)

    table1_file = definitions_dir / "sales_performance.js"
    table1_file.write_text(
        "// ___MODULE_CONTEXT___\n// ___TABLE_CONFIG___\nconsole.log('sales_performance');",
        encoding="utf-8",
    )

    table_settings_file = tmp_path / "table_settings.yaml"
    settings = {
        "sales_performance": {
            "dataformTags": ["bdc_tag"],
            "materializationType": "view",
        }
    }
    with open(table_settings_file, "w", encoding="utf-8") as f:
        yaml.dump(settings, f)

    output_dir = tmp_path / "dist"
    output_dir.mkdir()

    annotations_dir = module_src_dir / "annotations"
    annotations_dir.mkdir()

    annotation_file = annotations_dir / "sales_performance.yaml"
    annotation_content = {
        "description": "Sales performance report",
        "fields": [{"name": "sales_order", "description": "Sales order ID"}],
    }
    with open(annotation_file, "w", encoding="utf-8") as f:
        yaml.dump(annotation_content, f)

    builder = SapBdcProductBuilder()
    builder.build(
        module_id="sap_bdc_sales_performance",
        module_config=mock_module_config,
        global_config=mock_global_config,
        manifest=mock_manifest,
        base_dir=tmp_path,
        annotations_dir=annotations_dir,
        output_dir=output_dir,
        module_dir_name="sales_performance",
        sources_registry=set(),
        table_settings_file=table_settings_file,
    )

    out_file = output_dir / "sales_performance.js"
    assert out_file.exists()

    content = out_file.read_text(encoding="utf-8")
    match = re.search(r"const tableConfig = (\{.*?\});", content, re.DOTALL)
    assert match is not None
    table_config = json.loads(match.group(1))

    assert table_config["tableName"] == "sales_performance"
    assert table_config["tags"] == ["bdc_tag"]
    assert table_config["description"] == "Sales performance report"
    assert table_config["columns"] == {"sales_order": "Sales order ID"}
