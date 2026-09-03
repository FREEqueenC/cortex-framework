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

import pytest
from pydantic import ValidationError

from common.schemas.enums import MaterializationType, PartitionType
from common.schemas.table_settings_schema import (
    ClusterDetails,
    FoundationSource,
    FoundationTableItem,
    FoundationTableSettings,
    FoundationTarget,
    PartitionDetails,
    ProductTableItem,
    SapBdcProductTableSettings,
    SapFoundationSource,
    SapFoundationTableItem,
    SapFoundationTableSettings,
    SapFoundationTarget,
)


def test_partition_details_valid_column():
    details = PartitionDetails(column="material", partition_type=PartitionType.DATE)
    assert details.column == "material"


def test_partition_details_invalid_column():
    with pytest.raises(ValidationError):
        PartitionDetails(column="material); SELECT 1; --", partition_type=PartitionType.DATE)


def test_partition_details_invalid_column_with_spaces():
    with pytest.raises(ValidationError):
        PartitionDetails(column="a b", partition_type=PartitionType.DATE)


def test_cluster_details_valid_columns():
    details = ClusterDetails(columns=["col1", "col2"])
    assert details.columns == ["col1", "col2"]


def test_cluster_details_invalid_columns():
    with pytest.raises(ValidationError):
        ClusterDetails(columns=["col1", "col2; DROP TABLE x;"])


def test_product_table_item_enabled_default():
    item = ProductTableItem()
    assert item.enabled is True


def test_product_table_item_enabled_override():
    item = ProductTableItem(enabled=False)
    assert item.enabled is False


def test_sap_bdc_product_table_settings_valid():
    raw_data = {
        "sales_performance": {
            "materializationType": "view",
            "dataformTags": ["sap_bdc", "sales"],
            "enabled": True,
        },
        "supplier_spend_analysis": {
            "materializationType": "view",
            "enabled": False,
        },
    }
    settings = SapBdcProductTableSettings.model_validate(raw_data)
    assert "sales_performance" in settings.root
    assert settings.root["sales_performance"].materialization_type == MaterializationType.VIEW
    assert settings.root["sales_performance"].dataform_tags == ["sap_bdc", "sales"]
    assert settings.root["sales_performance"].enabled is True
    assert settings.root["supplier_spend_analysis"].enabled is False


def test_sap_bdc_product_table_settings_empty():
    settings = SapBdcProductTableSettings.model_validate({})
    assert settings.root == {}


def test_sap_foundation_source_defaults_sap_table_name():
    source = SapFoundationSource(table_name="acdoca")
    assert source.table_name == "acdoca"
    assert source.sap_table_name == "acdoca"
    assert source.is_cdc is True


def test_sap_foundation_source_custom_sap_table_name():
    source = SapFoundationSource.model_validate(
        {"tableName": "raw_acdoca", "sapTableName": "acdoca"}
    )
    assert source.table_name == "raw_acdoca"
    assert source.sap_table_name == "acdoca"


def test_sap_foundation_table_item_normalizes_target_name():
    item = SapFoundationTableItem.model_validate(
        {"source": {"tableName": "raw_bkpf", "sapTableName": "bkpf"}}
    )
    assert item.source.table_name == "raw_bkpf"
    assert item.source.sap_table_name == "bkpf"
    assert item.target.table_name == "bkpf"


def test_sap_foundation_table_item_explicit_target_name():
    item = SapFoundationTableItem.model_validate(
        {
            "source": {"tableName": "raw_bkpf", "sapTableName": "bkpf"},
            "target": {"tableName": "custom_bkpf_target"},
        }
    )
    assert item.source.table_name == "raw_bkpf"
    assert item.source.sap_table_name == "bkpf"
    assert item.target.table_name == "custom_bkpf_target"


def test_sap_foundation_table_settings_parsing():
    raw_yaml = {
        "s4": [
            {
                "source": {"tableName": "raw_acdoca", "sapTableName": "acdoca"},
                "target": {"dataformTags": ["sap", "foundation"]},
            }
        ],
        "ecc": [
            {
                "source": {"tableName": "mara"},
            }
        ],
    }
    settings = SapFoundationTableSettings.model_validate(raw_yaml)
    assert len(settings.s4) == 1
    assert settings.s4[0].source.table_name == "raw_acdoca"
    assert settings.s4[0].source.sap_table_name == "acdoca"
    assert settings.s4[0].target.table_name == "acdoca"
    assert settings.s4[0].target.dataform_tags == ["sap", "foundation"]

    assert len(settings.ecc) == 1
    assert settings.ecc[0].source.table_name == "mara"
    assert settings.ecc[0].source.sap_table_name == "mara"
    assert settings.ecc[0].target.table_name == "mara"


def test_foundation_aliases():
    assert SapFoundationSource is FoundationSource
    assert SapFoundationTarget is FoundationTarget
    assert SapFoundationTableItem is FoundationTableItem
    assert SapFoundationTableSettings is FoundationTableSettings
