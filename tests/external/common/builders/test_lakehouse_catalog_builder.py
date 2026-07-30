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

"""Unit tests for LakehouseCatalogBuilder."""

import pathlib
from unittest.mock import MagicMock, patch

from common.builders.base import Source
from common.builders.lakehouse_catalog_builder import LakehouseCatalogBuilder
from common.schemas.config_schema import CatalogConfig
from common.services.external_module_provider import CatalogTableMetadata


def test_build_output_formatting(tmp_path: pathlib.Path):
    """Verify that Source objects are added without trailing table names in dataset field."""
    catalog_config = CatalogConfig.model_validate(
        {
            "id": "my_catalog",
            "type": "lakehouse_delta_share",
            "bindsNamespaces": ["sap_bdc"],
            "connectionSettings": {
                "catalogId": "my_catalog_phys",
                "projectId": "cat_proj",
                "location": "US",
                "shares": [{"shareId": "share_1"}],
            },
        }
    )

    builder = LakehouseCatalogBuilder()
    mock_metadata = [
        CatalogTableMetadata(
            catalog_project="cat_proj",
            internal_catalog_id="my_catalog",
            physical_catalog_id="my_catalog_phys",
            share_name="share_1",
            schema_name="schema_1",
            table_name="table_a",
        ),
        CatalogTableMetadata(
            catalog_project="cat_proj",
            internal_catalog_id="my_catalog",
            physical_catalog_id="my_catalog_phys",
            share_name="share_1",
            schema_name="schema_1",
            table_name="table_b",
        ),
    ]

    sources_registry: set[Source] = set()
    with patch(
        "common.builders.lakehouse_catalog_builder.ExternalModuleProvider"
    ) as mock_provider_cls:
        mock_provider = MagicMock()
        mock_provider.fetch_all_metadata.return_value = mock_metadata
        mock_provider_cls.return_value = mock_provider

        builder.build(
            module_id="my_catalog",
            module_config=catalog_config,
            global_config=MagicMock(),
            manifest=MagicMock(),
            base_dir=tmp_path,
            annotations_dir=tmp_path,
            output_dir=tmp_path,
            module_dir_name="catalog",
            sources_registry=sources_registry,
        )

    assert len(sources_registry) == 2
    assert (
        Source(
            project="cat_proj",
            dataset="my_catalog_phys.share_1.schema_1",
            table="table_a",
        )
        in sources_registry
    )
    assert (
        Source(
            project="cat_proj",
            dataset="my_catalog_phys.share_1.schema_1",
            table="table_b",
        )
        in sources_registry
    )
