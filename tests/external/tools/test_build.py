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
import pathlib
from unittest import mock

import pytest

from common.builders.base import FoundationBuilder, Source
from common.errors import CortexBuildError, CortexConfigError, CortexGcpError
from common.schemas.config_schema import GlobalConfig
from common.schemas.enums import Category
from common.schemas.manifest_schema import ManifestConfig
from tools.build import DataformBuilder, main

# Add an empty config and manifest dictionary definitions to use in tests.


@pytest.fixture
def mock_config_content():
    return {
        "data": {
            "bigQueryLocation": "US",
            "datasets": [
                {"id": "source_1", "projectId": "source_project", "datasetId": "source_dataset"},
                {"id": "target_1", "projectId": "target_project", "datasetId": "target_dataset"},
                {"id": "target_2", "projectId": "target_project", "datasetId": "target_dataset"},
            ],
            "modules": {
                "foundation": [
                    {
                        "enabled": True,
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleId": "test_foundation",
                        "dataSourceId": "source_1",
                        "dataTargetId": "target_1",
                        "moduleType": "sap",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "enabled": True,
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleId": "test_product",
                        "dependencyBindings": {"sap_foundation": "test_foundation"},
                        "dataTargetId": "target_2",
                        "moduleType": "generic",
                    }
                ],
            },
        }
    }


@pytest.fixture
def mock_manifest_content():
    return {
        "category": "foundation",
        "type": "sap",
        "dependencies": {
            "sap_foundation": {
                "modulePath": "cortex.sap.foundations.sap",
                "module": "test_foundation",
                "displayName": "SAP Foundation",
                "description": "SAP Foundation",
                "ownerEmails": ["test-owner@google.com"],
                "supportedVersions": ["ecc", "s4"],
                "tables": {"common": ["mock_table"]},
            }
        },
    }


@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_dataform_builder_initialization(mock_discover_modules, mock_config_content):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig(**mock_config_content)
    output_dir = pathlib.Path("/tmp/test_output")
    assertions_path = pathlib.Path("/tmp/assertions.sqlx")

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=output_dir,
        base_dir=pathlib.Path.cwd(),
        config_dir=pathlib.Path.cwd(),
        assertions_path=assertions_path,
    )

    assert builder.global_config == global_config
    assert builder.output_dir == output_dir
    assert builder.assertions_path == assertions_path
    assert builder.base_dir == pathlib.Path.cwd()
    assert builder.config_dir == pathlib.Path.cwd()


@mock.patch("tools.build.DataformBuilder._discover_modules")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.shutil.rmtree")
@mock.patch("tools.build.shutil.copytree")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.pathlib.Path.mkdir")
@mock.patch("tools.build.google.auth.default")
@mock.patch("builtins.open", new_callable=mock.mock_open)
def test_build_success(
    mock_file_open,
    mock_google_auth_default,
    mock_mkdir,
    mock_exists,
    mock_copytree,
    mock_rmtree,
    mock_load_yaml,
    mock_discover_modules,
    mock_config_content,
    mock_manifest_content,
):
    global_config = GlobalConfig(**mock_config_content)
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=pathlib.Path("output"),
        base_dir=pathlib.Path.cwd(),
        config_dir=pathlib.Path.cwd(),
    )
    # Mock exists to avoid missing config error
    mock_exists.return_value = True

    mock_google_auth_default.return_value = (None, "mock_project_id")

    # Setup mock_discover_modules
    mock_manifest = ManifestConfig(**mock_manifest_content)
    mock_discover_modules.return_value = {
        "cortex.sap.foundations.sap": {
            "physical_dir": pathlib.Path("/tmp"),
            "module_dir_name": "module_dir",
            "builder_key": None,
            "category": "data_foundation",
            "manifest": mock_manifest,
            "namespace": "cortex",
        }
    }

    # load_yaml is called for workflow settings
    mock_load_yaml.side_effect = [{}]

    # Mock successful process module to skip actual module loading
    builder._process_module = mock.MagicMock(return_value=True)  # type: ignore[method-assign]

    result = builder.build()

    assert result is True
    # Ensures that Dataform dependencies like workflow settings were processed
    builder._process_module.assert_called()
    mock_google_auth_default.assert_called_once()


@mock.patch("tools.build.ConfigLoader")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_success(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_loader, mock_config_content
):
    mock_build.return_value = True
    mock_exists.return_value = True
    mock_loader.load_and_validate.return_value = (GlobalConfig(**mock_config_content), [])
    mock_checker.return_value.validate_all.return_value = True
    try:
        main(["--config", "config.yaml"])
    except SystemExit:
        pytest.fail("main() unexpectedly exited")

    mock_build.assert_called_once()
    mock_checker.return_value.validate_all.assert_called_once()


@mock.patch("tools.build.ConfigLoader")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_failure(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_loader, mock_config_content
):
    mock_build.return_value = False
    mock_exists.return_value = True
    mock_loader.load_and_validate.return_value = (GlobalConfig(**mock_config_content), [])
    mock_checker.return_value.validate_all.return_value = True

    with pytest.raises(SystemExit) as excinfo:
        main(["--config", "config.yaml"])
    assert excinfo.value.code == 1


@mock.patch("tools.build.ConfigLoader")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_env_check_failure(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_loader, mock_config_content
):
    mock_exists.return_value = True
    mock_loader.load_and_validate.return_value = (GlobalConfig(**mock_config_content), [])
    mock_checker.return_value.validate_all.side_effect = CortexGcpError("GCP check failed")

    with pytest.raises(SystemExit) as excinfo:
        main(["--config", "config.yaml"])
    assert excinfo.value.code == 1


@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_process_module_filtering(mock_discover_modules, mock_config_content):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig(**mock_config_content)
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=pathlib.Path("/tmp/test_output"),
        base_dir=pathlib.Path.cwd(),
        config_dir=pathlib.Path.cwd(),
    )

    # Setup state for filtering
    builder.required_tables_by_foundation = {"test_foundation": {"req_table"}}

    foundation_settings_yaml = """
common:
  - source:
      tableName: req_table
    target:
      tableName: req_table_tgt
  - source:
      tableName: unreq_table
    target:
      tableName: unreq_table_tgt
"""

    mock_plugin = mock.MagicMock(spec=FoundationBuilder)
    builder._get_builder = mock.MagicMock(return_value=mock_plugin)  # type: ignore[method-assign]

    builder.module_registry = {
        "cortex.sap.foundations.sap": {
            "physical_dir": pathlib.Path("/tmp/fnd"),
            "module_dir_name": "sap_fnd",
            "builder_key": None,
            "category": "data_foundation",
            "manifest": ManifestConfig.model_validate({"category": "foundation", "type": "sap"}),
            "namespace": "cortex",
        }
    }

    foundation_config = global_config.data.modules.foundation[0]

    # Mock open to return our YAML string
    with (
        mock.patch("builtins.open", mock.mock_open(read_data=foundation_settings_yaml)),
        mock.patch("tools.build.pathlib.Path.exists", return_value=True),
    ):
        builder._process_module(foundation_config, Category.FOUNDATION)

    called_args, called_kwargs = mock_plugin.build.call_args

    mock_plugin.build.assert_called_once()

    assert "required_tables" in called_kwargs
    assert called_kwargs["required_tables"] == {"req_table"}
    assert "table_settings_file" in called_kwargs


def test_generate_centralized_sources_path_traversal_project(tmp_path):
    """Verifies that path traversal attempts in project IDs are blocked."""

    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path,
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    # Add a malicious source to registry
    builder.sources_registry.add(Source(project="../../../pwned", dataset="sap_cdc", table="mara"))

    with pytest.raises(CortexBuildError) as excinfo:
        builder._generate_centralized_sources()
    assert "Invalid project ID" in str(excinfo.value)


def test_generate_centralized_sources_path_traversal_dataset(tmp_path):
    """Verifies that path traversal attempts in dataset IDs are blocked."""

    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path,
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    # Add a source with a valid project but malicious dataset to registry
    builder.sources_registry.add(
        Source(project="valid-project", dataset="../../../pwned", table="mara")
    )

    with pytest.raises(CortexBuildError) as excinfo:
        builder._generate_centralized_sources()
    assert "Invalid dataset ID" in str(excinfo.value)


def test_generate_centralized_sources_valid(tmp_path):
    """Verifies that valid project/dataset IDs work correctly."""

    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path,
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    builder.sources_registry.add(
        Source(project="valid-project", dataset="valid_dataset", table="mara")
    )

    builder._generate_centralized_sources()

    expected_file = tmp_path / "definitions" / "sources" / "valid-project_valid_dataset_sources.js"
    assert expected_file.exists()


def test_generate_centralized_sources_injection_escaped(tmp_path):
    """Verifies that quotes and injection payloads in table names are properly JSON-escaped."""

    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path,
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    malicious_table = (
        'mara"}); console.log("PWNED"); declare({ database: "sap", schema: "raw", name: "mara'
    )
    builder.sources_registry.add(
        Source(project="valid-project", dataset="valid_dataset", table=malicious_table)
    )

    builder._generate_centralized_sources()

    expected_file = tmp_path / "definitions" / "sources" / "valid-project_valid_dataset_sources.js"
    assert expected_file.exists()
    content = expected_file.read_text(encoding="utf-8")
    assert json.dumps(malicious_table) in content
    assert 'name: "mara"}); console.log("PWNED");' not in content


@mock.patch("tools.build.shutil.rmtree")
@mock.patch("tools.build.shutil.copytree")
@mock.patch("tools.build.shutil.copy2")
@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_build_with_assertions_success(
    mock_discover_modules, mock_copy2, mock_copytree, mock_rmtree, tmp_path
):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )

    assertions_file = tmp_path / "assertions.sqlx"
    assertions_file.touch()

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        base_dir=tmp_path,
        config_dir=tmp_path,
        assertions_path=assertions_file,
    )

    builder._prepare_workspace()

    expected_dest = tmp_path / "output" / "definitions" / "assertions" / "assertions.sqlx"
    mock_copy2.assert_called_once_with(assertions_file, expected_dest)


@mock.patch("tools.build.shutil.rmtree")
@mock.patch("tools.build.shutil.copytree")
@mock.patch("tools.build.shutil.copy2")
@mock.patch("tools.build._logger.error")
@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_build_with_assertions_directory_failure(
    mock_discover_modules, mock_log_error, mock_copy2, mock_copytree, mock_rmtree, tmp_path
):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [],
                "modules": {"foundation": [], "product": []},
            }
        }
    )

    assertions_dir = tmp_path / "assertions"
    assertions_dir.mkdir()

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        base_dir=tmp_path,
        config_dir=tmp_path,
        assertions_path=assertions_dir,
    )

    builder._prepare_workspace()

    mock_log_error.assert_called_once_with("Assertions path must be a file, not a directory.")
    mock_copy2.assert_not_called()


@mock.patch("tools.build._logger.error")
@mock.patch("tools.build._logger.exception")
@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_process_module_cortex_error_clean_logging(
    mock_discover, mock_log_exception, mock_log_error, tmp_path
):
    mock_discover.return_value = {}
    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [
                    {
                        "id": "mock_target",
                        "projectId": "test-project",
                        "datasetId": "test_dataset",
                    }
                ],
                "modules": {"foundation": [], "product": []},
            }
        }
    )
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    mock_module_config = mock.MagicMock()
    mock_module_config.module_id = "test_mod"
    mock_module_config._namespace = "cortex"
    mock_module_config._module_type = "test_type"
    mock_module_config.namespaced_type = "cortex.test_type"
    mock_module_config.table_settings = None
    mock_module_config.data_target_id = "mock_target"

    mock_plugin = mock.MagicMock(spec=FoundationBuilder)
    mock_plugin.build.side_effect = CortexConfigError("Invalid config YAML", hint="Fix YAML syntax")

    builder.module_registry["cortex.test_type"] = {
        "manifest": mock.MagicMock(),
        "physical_dir": tmp_path,
    }
    builder._get_module_context = mock.MagicMock(  # type: ignore[method-assign]
        return_value=(mock_plugin, tmp_path / "out", tmp_path / "ann", "test_type")
    )

    result = builder._process_module(mock_module_config, Category.FOUNDATION)

    assert result is False
    mock_log_error.assert_called_once()
    mock_log_exception.assert_not_called()


def test_execute_all_modules_build_order(tmp_path):
    """Verify that _execute_all_modules processes modules in correct category order."""
    global_config = GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "datasets": [
                    {"id": "s", "projectId": "p", "datasetId": "d"},
                    {"id": "t", "projectId": "p", "datasetId": "d"},
                ],
                "modules": {
                    "catalogs": [
                        {
                            "id": "cat_mod",
                            "type": "lakehouse_delta_share",
                            "enabled": True,
                            "connectionSettings": {
                                "catalogId": "cat_phys",
                                "projectId": "p",
                                "location": "l",
                                "shares": [],
                            },
                        }
                    ],
                    "foundation": [
                        {
                            "moduleId": "fnd_mod",
                            "modulePath": "cortex.generic.foundations.dummy",
                            "moduleType": "generic",
                            "dataSourceId": "s",
                            "dataTargetId": "t",
                        }
                    ],
                    "product": [
                        {
                            "moduleId": "prod_mod",
                            "modulePath": "cortex.sap.foundations.sap",
                            "moduleType": "sap",
                            "dataTargetId": "t",
                        }
                    ],
                },
            }
        }
    )
    with mock.patch("tools.build.DataformBuilder._discover_modules") as mock_discover:
        mock_discover.return_value = {}
        builder = DataformBuilder(
            global_config=global_config,
            output_dir=tmp_path / "output",
            base_dir=tmp_path,
            config_dir=tmp_path,
        )

    execution_order = []

    def mock_process_module(module_config, category):
        execution_order.append(
            (getattr(module_config, "module_id", getattr(module_config, "id", "")), category)
        )
        return True

    builder._process_module = mock_process_module

    assert builder._execute_all_modules() is True
    assert execution_order == [
        ("cat_mod", Category.CATALOG),
        ("fnd_mod", Category.FOUNDATION),
        ("prod_mod", Category.PRODUCT),
    ]


@mock.patch("common.services.external_module_provider.BigLakeDeltaSharingClient")
@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_generate_config_js_content_catalog_dependency(
    mock_discover_modules, mock_client_cls, tmp_path
):
    """Verifies that _generate_config_js_content handles products depending on catalog shares."""
    mock_client = mock.MagicMock()
    mock_client_cls.return_value = mock_client

    def list_schemas_mock(project, location, catalog, share):
        if share == "customer_v1":
            return [{"name": "customer"}]
        elif share == "salesorder_v1":
            return [{"name": "salesorder"}]
        return []

    mock_client.list_schemas.side_effect = list_schemas_mock
    mock_client.list_tables.return_value = [{"name": "table_1"}]

    config_dict = {
        "data": {
            "bigQueryLocation": "US",
            "datasets": [
                {"id": "target_bdc", "projectId": "target_proj", "datasetId": "target_dataset"}
            ],
            "modules": {
                "catalogs": [
                    {
                        "id": "sap_catalog_bdc_test",
                        "type": "lakehouse_delta_share",
                        "enabled": True,
                        "bindsNamespaces": ["sap_bdc"],
                        "connectionSettings": {
                            "catalogId": "sap_bdc_catalog",
                            "projectId": "catalog_proj",
                            "location": "europe-west3",
                            "shares": [
                                {"shareId": "customer_v1"},
                                {"shareId": "salesorder_v1"},
                            ],
                        },
                    }
                ],
                "foundation": [],
                "product": [
                    {
                        "enabled": True,
                        "modulePath": "cortex_samples.sap_bdc.products.sales_performance",
                        "moduleId": "sap_bdc_sales_performance",
                        "dependencyBindings": {
                            "sapBdcCustomer": "sap_catalog_bdc_test.customer",
                            "sapBdcSalesOrder": "sap_catalog_bdc_test.salesorder",
                        },
                        "dataTargetId": "target_bdc",
                        "moduleType": "sap_bdc_product",
                    }
                ],
            },
        }
    }

    mock_manifest = ManifestConfig.model_validate(
        {
            "category": "foundation",
            "type": "sap",
            "dependencies": {
                "sapBdcCustomer": {"modulePath": "sap_bdc.customer"},
                "sapBdcSalesOrder": {"modulePath": "sap_bdc.salesorder"},
            },
        }
    )

    mock_discover_modules.return_value = {
        "cortex_samples.sap_bdc.products.sales_performance": {
            "physical_dir": tmp_path,
            "module_dir_name": "sales_performance",
            "builder_key": "sap_bdc_product",
            "category": "product",
            "manifest": mock_manifest,
            "namespace": "cortex_samples",
        }
    }

    global_config = GlobalConfig.model_validate(config_dict)
    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    content = builder._generate_config_js_content()
    assert content is not None
    assert "sap_bdc_sales_performance" in content["product"]
    sources = content["product"]["sap_bdc_sales_performance"]["sources"]
    assert "sapBdcCustomer" in sources
    assert "sapBdcSalesOrder" in sources
    assert sources["sapBdcCustomer"]["datasetId"].value == "sap_bdc_catalog.customer_v1.customer"
    assert sources["sapBdcCustomer"]["projectId"].value == "catalog_proj"
    assert (
        sources["sapBdcSalesOrder"]["datasetId"].value == "sap_bdc_catalog.salesorder_v1.salesorder"
    )
    assert sources["sapBdcSalesOrder"]["projectId"].value == "catalog_proj"

    assert sources["sapBdcCustomer"]["datasetId"].fallbacks == [
        "cortex_catalogs_sap_catalog_bdc_test_sapBdcCustomer_datasetId",
        "cortex_catalogs_sap_catalog_bdc_test_datasetId",
    ]
    assert sources["sapBdcSalesOrder"]["datasetId"].fallbacks == [
        "cortex_catalogs_sap_catalog_bdc_test_sapBdcSalesOrder_datasetId",
        "cortex_catalogs_sap_catalog_bdc_test_datasetId",
    ]

    collected_vars = {}
    from tools.build import dict_to_js_with_vars

    dict_to_js_with_vars(content, [], collected_vars)
    assert (
        collected_vars["cortex_catalogs_sap_catalog_bdc_test_sapBdcCustomer_datasetId"]
        == "sap_bdc_catalog.customer_v1.customer"
    )
    assert (
        collected_vars["cortex_catalogs_sap_catalog_bdc_test_sapBdcSalesOrder_datasetId"]
        == "sap_bdc_catalog.salesorder_v1.salesorder"
    )


def test_get_module_context_windows_paths(tmp_path, mock_config_content):
    """Verify that _get_module_context correctly resolves Windows paths.

    This ensures that backslashes in Windows paths are correctly converted
    to dots in Python module paths.
    """
    import pathlib
    from unittest.mock import MagicMock, patch

    from common.schemas.config_schema import GlobalConfig
    from tools.build import DataformBuilder

    # Use PureWindowsPath to simulate Windows path structure
    rel_dir_win = pathlib.PureWindowsPath("sap/foundations/sap")

    # Mock GlobalConfig setup
    global_config = GlobalConfig(**mock_config_content)

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        base_dir=tmp_path,
        config_dir=tmp_path,
    )

    # Populate module_registry with Windows paths
    builder.module_registry = {
        "cortex.sap_foundation": {
            "physical_dir": tmp_path / "sap" / "foundations" / "sap",
            "module_dir_name": "sap",
            "builder_key": None,
            "category": "data_foundation",
            "manifest": MagicMock(),
            "namespace": "cortex",
            "ns_path": "cortex",
            "rel_dir": rel_dir_win,
        }
    }

    mock_module_config = MagicMock()
    mock_module_config.module_id = "sap_foundation"
    mock_module_config.namespaced_type = "cortex.sap_foundation"

    mock_get_builder = MagicMock()
    builder._get_builder = mock_get_builder

    with patch("tools.build.pathlib.Path.exists", return_value=True):
        builder._get_module_context(mock_module_config, Category.FOUNDATION)

    # Verify that _get_builder was called with the correct converted local_module_path
    mock_get_builder.assert_called_once()
    called_kwargs = mock_get_builder.call_args.kwargs

    # Expected: data_modules.cortex.sap.foundations.sap.builder
    # (Notice all dots, no backslashes)
    assert called_kwargs["local_module_path"] == "data_modules.cortex.sap.foundations.sap.builder"
