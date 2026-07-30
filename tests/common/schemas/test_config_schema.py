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

import pytest
from pydantic import ValidationError

from common.schemas.config_schema import (
    DataProductModuleConfig,
    GlobalConfig,
)
from common.services.config_validator import ConfigValidator


def test_data_product_module_config_four_part():
    """Verify Pydantic model validation accepts combined 4-part namespaced types."""
    config_combined = DataProductModuleConfig.model_validate(
        {
            "moduleId": "dp1",
            "modulePath": "cortex.sap.products.customers",
            "dataTargetId": "target1",
        }
    )
    assert config_combined.module_path == "cortex.sap.products.customers"
    assert config_combined.namespace == "cortex"
    assert config_combined.namespaced_type == "cortex.sap.products.customers"

    config_separate = DataProductModuleConfig.model_validate(
        {
            "moduleId": "dp2",
            "modulePath": "my_dp",
            "namespace": "cortex",
            "dataTargetId": "target1",
        }
    )
    assert config_separate.module_path == "my_dp"
    assert config_separate.namespace == "cortex"


def test_data_product_module_config_missing_namespace_rejected():
    """Verify that specifying a dotless type without a separate namespace raises ValidationError."""
    with pytest.raises(ValidationError, match="must be namespaced"):
        DataProductModuleConfig.model_validate(
            {"moduleId": "dp1", "modulePath": "my_dp", "dataTargetId": "target1"}
        )


def test_catalog_config_valid():
    config_dict = {
        "data": {
            "bigQueryLocation": "US",
            "datasets": [
                {"id": "src1", "projectId": "p1", "datasetId": "d1"},
                {"id": "tgt1", "projectId": "p2", "datasetId": "d2"},
            ],
            "modules": {
                "foundation": [],
                "product": [],
                "catalogs": [
                    {
                        "id": "cat_sap",
                        "type": "lakehouse_delta_share",
                        "enabled": True,
                        "bindsNamespaces": ["sap_bdc"],
                        "connectionSettings": {
                            "catalogId": "sap_catalog_1",
                            "projectId": "proj-cat",
                            "location": "us",
                            "shares": [{"shareId": "share_1"}],
                        },
                    }
                ],
            },
        }
    }
    config = GlobalConfig.model_validate(config_dict)
    assert len(config.data.modules.catalogs) == 1
    cat = config.data.modules.catalogs[0]
    assert cat.id == "cat_sap"
    assert cat.type == "lakehouse_delta_share"
    assert cat.binds_namespaces == ["sap_bdc"]
    assert cat.connection_settings.catalog_id == "sap_catalog_1"
    assert cat.connection_settings.project_id == "proj-cat"
    assert len(cat.connection_settings.shares) == 1
    assert cat.connection_settings.shares[0].share_id == "share_1"


def test_catalog_config_missing_required_fields():
    config_dict = {
        "data": {
            "bigQueryLocation": "US",
            "datasets": [
                {"id": "src1", "projectId": "p1", "datasetId": "d1"},
                {"id": "tgt1", "projectId": "p2", "datasetId": "d2"},
            ],
            "modules": {
                "foundation": [],
                "product": [],
                "catalogs": [
                    {
                        "id": "cat_sap",
                        "type": "lakehouse_delta_share",
                        "enabled": True,
                    }
                ],
            },
        }
    }
    with pytest.raises(ValidationError, match="Field required"):
        GlobalConfig.model_validate(config_dict)


def test_catalog_id_uniqueness():
    config_dict = {
        "data": {
            "bigQueryLocation": "US",
            "datasets": [
                {"id": "duplicate_id", "projectId": "p1", "datasetId": "d1"},
                {"id": "tgt1", "projectId": "p2", "datasetId": "d2"},
            ],
            "modules": {
                "foundation": [],
                "product": [],
                "catalogs": [
                    {
                        "id": "duplicate_id",
                        "type": "lakehouse_delta_share",
                        "enabled": True,
                        "connectionSettings": {
                            "catalogId": "sap_catalog_1",
                            "projectId": "p1",
                            "location": "us",
                            "shares": [],
                        },
                    }
                ],
            },
        }
    }
    config = GlobalConfig.model_validate(config_dict)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("Duplicate ID 'duplicate_id'" in e for e in errors)


def test_pluralized_categories_and_4_segment_types():
    config_dict = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "src1", "projectId": "p1", "datasetId": "d1"},
                {"id": "tgt1", "projectId": "p2", "datasetId": "d2"},
            ],
            "modules": {
                "foundations": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "products": [
                    {
                        "moduleId": "sap_customers",
                        "modulePath": "cortex.sap.products.customers",
                        "dataTargetId": "tgt1",
                        "dependencyBindings": {"sapModule": "erp"},
                    }
                ],
            },
        }
    }
    config = GlobalConfig.model_validate(config_dict)
    assert len(config.data.modules.foundation) == 1
    assert len(config.data.modules.product) == 1

    f_mod = config.data.modules.foundation[0]
    assert f_mod._namespace == "cortex"
    assert f_mod.module_path == "cortex.sap.foundations.sap"

    p_mod = config.data.modules.product[0]
    assert p_mod._namespace == "cortex"
    assert p_mod.module_path == "cortex.sap.products.customers"
