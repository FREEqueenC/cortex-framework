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

from common.errors import CortexConfigError
from common.schemas.config_schema import CatalogConfig
from common.services.external_module_provider import (
    CatalogTableMetadata,
    ExternalModuleProvider,
)


def test_fetch_all_metadata():
    mock_client = MagicMock()
    mock_client.list_schemas.return_value = [
        {
            "name": (
                "projects/proj1/locations/us/catalogs/cat_phys/shares/share1/schemas/sales_schema"
            )
        }
    ]
    mock_client.list_tables.return_value = [
        {
            "name": (
                "projects/proj1/locations/us/catalogs/cat_phys/shares/share1"
                "/schemas/sales_schema/tables/orders"
            )
        },
        {
            "name": (
                "projects/proj1/locations/us/catalogs/cat_phys/shares/share1"
                "/schemas/sales_schema/tables/customers"
            )
        },
    ]

    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat_alias",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)
    metadata = provider.fetch_all_metadata()

    assert len(metadata) == 2
    assert metadata[0] == CatalogTableMetadata(
        catalog_project="proj1",
        internal_catalog_id="cat_alias",
        physical_catalog_id="cat_phys",
        share_name="share1",
        schema_name="sales_schema",
        table_name="orders",
    )
    assert metadata[1].table_name == "customers"

    # Test cache: calling again shouldn't call list_schemas again unless force_refresh=True
    provider.fetch_all_metadata()
    assert mock_client.list_schemas.call_count == 1

    provider.fetch_all_metadata(force_refresh=True)
    assert mock_client.list_schemas.call_count == 2


def test_disabled_catalogs_ignored():
    mock_client = MagicMock()
    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat_disabled",
            "type": "lakehouse_delta_share",
            "enabled": False,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)
    metadata = provider.fetch_all_metadata()

    assert len(metadata) == 0
    mock_client.list_schemas.assert_not_called()


def test_get_virtual_module_types_and_tables_2part_and_3part():
    mock_client = MagicMock()
    mock_client.list_schemas.return_value = [
        {
            "name": (
                "projects/proj1/locations/us/catalogs/cat_phys/shares/share1/schemas/sales_schema"
            )
        }
    ]
    mock_client.list_tables.return_value = [
        {"name": "orders"},
        {"name": "customers"},
    ]

    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat1",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)
    virtual_types = provider.get_module_types()
    assert virtual_types == {"cat1.share1.sales_schema"}

    tables_2part = provider.get_tables_for_module("cat1.sales_schema")
    assert tables_2part == {"orders", "customers"}

    tables_3part = provider.get_tables_for_module("cat1.share1.sales_schema")
    assert tables_3part == {"orders", "customers"}

    resolved = provider.resolve_catalog_schema("cat1.sales_schema")
    assert resolved is not None
    assert resolved.physical_dataset_id == "cat_phys.share1.sales_schema"
    assert resolved.project_id == "proj1"


def test_schema_collision_raises_cortex_config_error_with_hint():
    mock_client = MagicMock()

    def list_schemas_side_effect(project, location, catalog, share):
        if share in ("share1", "share2"):
            return [{"name": "customer"}]
        return []

    mock_client.list_schemas.side_effect = list_schemas_side_effect
    mock_client.list_tables.return_value = [{"name": "kna1"}]

    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat1",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}, {"shareId": "share2"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)

    # 2-part resolution should raise CortexConfigError with disambiguation hint
    with pytest.raises(CortexConfigError) as exc_info:
        provider.resolve_catalog_schema("cat1.customer")

    assert "ambiguous" in str(exc_info.value)
    assert exc_info.value.hint and "cat1.share1.customer" in exc_info.value.hint

    # 3-part resolution should succeed without conflict
    resolved_3part = provider.resolve_catalog_schema("cat1.share1.customer")
    assert resolved_3part is not None
    assert resolved_3part.physical_dataset_id == "cat_phys.share1.customer"


def test_get_provided_type_for_virtual_module():
    mock_client = MagicMock()
    mock_client.list_schemas.return_value = [
        {
            "name": (
                "projects/proj1/locations/us/catalogs/cat_phys/shares/share1/schemas/sales_schema"
            )
        }
    ]
    mock_client.list_tables.return_value = [{"name": "orders"}]

    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat1",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "bindsNamespaces": ["sap_bdc"],
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)
    provided_types = provider.get_provided_types_for_module("cat1.sales_schema")
    assert provided_types == ["sap_bdc.sales_schema"]

    # Test when bindsNamespaces is not configured
    cat_cfg_no_type = CatalogConfig.model_validate(
        {
            "id": "cat1",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "share1"}],
            },
        }
    )
    provider_no_type = ExternalModuleProvider(catalogs=[cat_cfg_no_type], client=mock_client)
    assert provider_no_type.get_provided_types_for_module("cat1.sales_schema") == []


def test_share_and_schema_special_character_sanitization():
    mock_client = MagicMock()
    mock_client.list_schemas.return_value = [{"name": "sales-schema:v1"}]
    mock_client.list_tables.return_value = [{"name": "orders"}]

    cat_cfg = CatalogConfig.model_validate(
        {
            "id": "cat1",
            "type": "lakehouse_delta_share",
            "enabled": True,
            "connectionSettings": {
                "catalogId": "cat_phys",
                "projectId": "proj1",
                "location": "us",
                "shares": [{"shareId": "customer-v1:400"}],
            },
        }
    )

    provider = ExternalModuleProvider(catalogs=[cat_cfg], client=mock_client)
    metadata = provider.fetch_all_metadata()

    # Verify REST API is called with raw share ID and raw schema ID
    mock_client.list_schemas.assert_called_once_with(
        project="proj1", location="us", catalog="cat_phys", share="customer-v1:400"
    )
    mock_client.list_tables.assert_called_once_with(
        project="proj1",
        location="us",
        catalog="cat_phys",
        share="customer-v1:400",
        schema_id="sales_schema_v1",
    )

    # Verify metadata and resolved schema use sanitized share_name and schema_name
    assert len(metadata) == 1
    assert metadata[0].share_name == "customer_v1_400"
    assert metadata[0].schema_name == "sales_schema_v1"

    resolved_2part = provider.resolve_catalog_schema("cat1.sales-schema:v1")
    assert resolved_2part is not None
    assert resolved_2part.physical_dataset_id == "cat_phys.customer_v1_400.sales_schema_v1"

    resolved_3part = provider.resolve_catalog_schema("cat1.customer-v1:400.sales-schema:v1")
    assert resolved_3part is not None
    assert resolved_3part.physical_dataset_id == "cat_phys.customer_v1_400.sales_schema_v1"
