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
from unittest.mock import patch

import pytest
import yaml

import common.services.dataplex.model as service_model
from common.clients.bq.bigquery import BigQueryManager
from common.schemas.manifest_schema import ManifestConfig
from common.services.config_loader import ConfigLoader
from common.services.dataplex.config_extractor import DataProductHandler
from common.services.unified_module_provider import UnifiedModuleProvider


class MockUnifiedModuleProvider(UnifiedModuleProvider):
    internal_provider: Any = None


@pytest.fixture
def sample_config_dict():
    """Provide a valid mock config dictionary matching GlobalConfig schema."""
    return {
        "data": {
            "bigQueryLocation": "europe-west2",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "cortex-test-proj", "datasetId": "sap_raw_ecc"},
                {
                    "id": "sap_foundation",
                    "projectId": "cortex-test-proj",
                    "datasetId": "cortex_sap_foundation",
                },
                {
                    "id": "product_target",
                    "projectId": "cortex-test-proj",
                    "datasetId": "cortex_data_products",
                },
            ],
            "modules": {
                "foundations": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {
                            "sapVersion": "ecc",
                            "mandt": "100",
                        },
                    }
                ],
                "products": [
                    {
                        "moduleId": "sap_purchasing_organizations",
                        "namespace": "cortex",
                        "modulePath": "cortex.sap.products.purchasing_organizations",
                        "dependencyBindings": {
                            "sapModule": "erp",
                        },
                        "dataTargetId": "product_target",
                    }
                ],
            },
        }
    }


@pytest.fixture
def mock_module_provider():
    provider_mock = mock.MagicMock(spec=MockUnifiedModuleProvider)

    def mock_get_manifest(*args):
        module_path = args[-1]
        if "products.purchasing" in module_path:
            return ManifestConfig.model_validate(
                {
                    "category": "source_aligned_product",
                    "type": "sap",
                    "dependencies": {"sapModule": {"modulePath": "cortex.sap.foundations.sap"}},
                }
            )
        elif "sap" in module_path:
            return ManifestConfig.model_validate({"category": "foundation", "type": "sap"})
        return ManifestConfig.model_validate(
            {"category": "source_aligned_product", "type": "generic"}
        )

    provider_mock.get_manifest.side_effect = mock_get_manifest
    provider_mock.get_module_dir.return_value = pathlib.Path(
        "/dummy/data/modules/cortex/sap/products/purchasing_organizations"
    )
    provider_mock.internal_provider.config_dir = pathlib.Path("/dummy/config")

    def mock_is_valid_module_type(self, module_type: str):
        return module_type in (
            "sap",
            "generic",
            "cortex.sap.foundations.sap",
            "cortex.sap.products.purchasing_organizations",
        )

    def mock_get_module_types(self):
        return {
            "sap",
            "generic",
            "cortex.sap.foundations.sap",
            "cortex.sap.products.purchasing_organizations",
        }

    with (
        mock.patch(
            "common.services.internal_module_provider.InternalModuleProvider.get_manifest",
            mock_get_manifest,
        ),
        mock.patch(
            "common.services.internal_module_provider.InternalModuleProvider.is_valid_module_type",
            mock_is_valid_module_type,
        ),
        mock.patch(
            "common.services.internal_module_provider.InternalModuleProvider.get_module_types",
            mock_get_module_types,
        ),
        mock.patch(
            "common.services.external_module_provider.ExternalModuleProvider.__init__",
            return_value=None,
        ),
        mock.patch(
            "common.services.external_module_provider.ExternalModuleProvider.get_module_types",
            return_value=set(),
        ),
        mock.patch(
            "common.services.external_module_provider.ExternalModuleProvider.is_valid_module_type",
            return_value=False,
        ),
    ):
        yield provider_mock


@pytest.fixture
def mock_bigquery_client():
    return mock.MagicMock(spec=BigQueryManager)


def test_config_extractor_success(
    tmp_path, sample_config_dict, mock_module_provider, mock_bigquery_client
):
    """Test successful extraction of deployed data products."""
    config_path = tmp_path / "config.yaml"
    with open(config_path, "w") as f:
        yaml.dump(sample_config_dict, f)

    with (
        patch("pathlib.Path.exists", return_value=True),
        patch(
            "common.services.dataplex.config_extractor.bq_table_extractor.DataProductTableResolver"
        ) as mock_resolver_cls,
    ):
        mock_resolver = mock_resolver_cls.return_value
        mock_resolver.resolve_data_product_tables.return_value = ["purchasing_organizations_md"]

        global_config, errors = ConfigLoader.load_and_validate(config_path)
        assert not errors, f"Unexpected validation errors: {errors}"
        extractor = DataProductHandler(global_config, mock_module_provider, mock_bigquery_client)
        products = extractor.extract_deployed_data_products()

        assert len(products) == 1
        product = products[0]
        assert isinstance(product, service_model.data_product.DeploymentInfo)
        assert product.id == "sap_purchasing_organizations"
        assert product.project_id == "cortex-test-proj"
        assert product.location == "europe-west2"
        assert product.bigquery_dataset_id == "cortex_data_products"
        assert product.bigquery_table_ids == ("purchasing_organizations_md",)

        mock_resolver.resolve_data_product_tables.assert_called_once_with(
            project_id="cortex-test-proj",
            dataset_id="cortex_data_products",
            data_product_type_fqn="cortex.sap.products.purchasing_organizations",
        )


def test_config_extractor_missing_data_target(
    tmp_path, sample_config_dict, mock_module_provider, mock_bigquery_client
):
    """Test error is raised when module references an unknown data target."""
    config_path = tmp_path / "config.yaml"
    with open(config_path, "w") as f:
        yaml.dump(sample_config_dict, f)

    with patch("pathlib.Path.exists", return_value=True):
        global_config, errors = ConfigLoader.load_and_validate(config_path)
        assert not errors, f"Unexpected validation errors: {errors}"
        extractor = DataProductHandler(global_config, mock_module_provider, mock_bigquery_client)
        # Mutate target ID after __init__ to trigger extraction error
        extractor._global_config.data.modules.product[0].data_target_id = "unknown_target"
        with pytest.raises(service_model.exception.DataProductConfigurationError) as excinfo:
            extractor.extract_deployed_data_products()
        assert "Data target unknown_target not found in the data targets" in str(excinfo.value)
