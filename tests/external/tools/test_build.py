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
from unittest import mock

import pytest

from common.builders.base import FoundationBuilder
from common.schemas.config_schema import GlobalConfig
from common.schemas.enums import ModuleCategory
from common.schemas.manifest_schema import ManifestConfig
from tools.build import DataformBuilder, main

# Add an empty config and manifest dictionary definitions to use in tests.


@pytest.fixture
def mock_config_content():
    return {
        "data": {
            "bigQueryLocation": "US",
            "sources": [
                {"id": "source_1", "projectId": "source_project", "datasetId": "source_dataset"}
            ],
            "targets": [
                {"id": "target_1", "projectId": "target_project", "datasetId": "target_dataset"},
                {"id": "target_2", "projectId": "target_project", "datasetId": "target_dataset"},
            ],
            "modules": {
                "foundation": [
                    {
                        "enabled": True,
                        "type": "cortex.sap",
                        "moduleId": "test_foundation",
                        "dataSourceId": "source_1",
                        "dataTargetId": "target_1",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "enabled": True,
                        "type": "cortex.sap",
                        "moduleId": "test_product",
                        "dependsOn": {"sap_foundation": "test_foundation"},
                        "dataTargetId": "target_2",
                    }
                ],
            },
        }
    }


@pytest.fixture
def mock_manifest_content():
    return {
        "dependencies": {
            "sap_foundation": {
                "type": "cortex.sap",
                "module": "test_foundation",
                "supportedVersions": ["ecc", "s4"],
                "tables": {"common": ["mock_table"]},
            }
        }
    }


@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_dataform_builder_initialization(mock_discover_modules, mock_config_content):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig(**mock_config_content)
    output_dir = pathlib.Path("/tmp/test_output")
    assertions_path = pathlib.Path("/tmp/assertions.sqlx")

    builder = DataformBuilder(
        global_config=global_config, output_dir=output_dir, assertions_path=assertions_path
    )

    assert builder.global_config == global_config
    assert builder.output_dir == output_dir
    assert builder.assertions_path == assertions_path
    assert builder.base_dir == pathlib.Path.cwd()


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
    builder = DataformBuilder(global_config=global_config, output_dir=pathlib.Path("output"))
    # Mock exists to avoid missing config error
    mock_exists.return_value = True

    mock_google_auth_default.return_value = (None, "mock_project_id")

    # Setup mock_discover_modules
    mock_manifest = ManifestConfig(**mock_manifest_content)
    mock_discover_modules.return_value = {
        "cortex.sap": {
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
    builder._process_module = mock.MagicMock(return_value=True)

    result = builder.build()

    assert result is True
    # Ensures that Dataform dependencies like workflow settings were processed
    builder._process_module.assert_called()
    mock_google_auth_default.assert_called_once()


@mock.patch("tools.build.ConfigValidator")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_success(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_validator, mock_config_content
):
    mock_build.return_value = True
    mock_exists.return_value = True
    mock_load_yaml.return_value = mock_config_content
    mock_checker.return_value.validate_all.return_value = True
    mock_validator.validate.return_value = (True, [])
    try:
        main(["--config", "config.yaml"])
    except SystemExit:
        pytest.fail("main() unexpectedly exited")

    mock_build.assert_called_once()
    mock_checker.return_value.validate_all.assert_called_once()


@mock.patch("tools.build.ConfigValidator")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_failure(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_validator, mock_config_content
):
    mock_build.return_value = False
    mock_exists.return_value = True
    mock_load_yaml.return_value = mock_config_content
    mock_checker.return_value.validate_all.return_value = True
    mock_validator.validate.return_value = (True, [])

    with pytest.raises(SystemExit) as excinfo:
        main(["--config", "config.yaml"])
    assert excinfo.value.code == 1


@mock.patch("tools.build.ConfigValidator")
@mock.patch("tools.build.GcpEnvironmentChecker")
@mock.patch("tools.build.load_yaml")
@mock.patch("tools.build.pathlib.Path.exists")
@mock.patch("tools.build.DataformBuilder.build")
def test_main_env_check_failure(
    mock_build, mock_exists, mock_load_yaml, mock_checker, mock_validator, mock_config_content
):
    mock_exists.return_value = True
    mock_load_yaml.return_value = mock_config_content
    mock_checker.return_value.validate_all.return_value = False
    mock_validator.validate.return_value = (True, [])

    with pytest.raises(SystemExit) as excinfo:
        main(["--config", "config.yaml"])
    assert excinfo.value.code == 1


@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_process_module_filtering(mock_discover_modules, mock_config_content):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig(**mock_config_content)
    builder = DataformBuilder(
        global_config=global_config, output_dir=pathlib.Path("/tmp/test_output")
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
    builder._get_builder = mock.MagicMock(return_value=mock_plugin)

    builder.module_registry = {
        "cortex.sap": {
            "physical_dir": pathlib.Path("/tmp/fnd"),
            "module_dir_name": "sap_fnd",
            "builder_key": None,
            "category": "data_foundation",
            "manifest": ManifestConfig(),
            "namespace": "cortex",
        }
    }

    foundation_config = global_config.data.modules.foundation[0]

    # Mock open to return our YAML string
    with (
        mock.patch("builtins.open", mock.mock_open(read_data=foundation_settings_yaml)),
        mock.patch("tools.build.pathlib.Path.exists", return_value=True),
    ):
        builder._process_module(foundation_config, ModuleCategory.FOUNDATION)

    called_args, called_kwargs = mock_plugin.build.call_args

    mock_plugin.build.assert_called_once()

    assert "required_tables" in called_kwargs
    assert called_kwargs["required_tables"] == {"req_table"}
    assert "table_settings_file" in called_kwargs


@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_generate_config_js_content_version_mismatch(
    mock_discover_modules, mock_config_content, mock_manifest_content
):
    """Verifies that building fails if a product depends on an incompatible SAP version."""
    mock_manifest_content_ecc = mock_manifest_content.copy()
    # Restrict product to ECC only
    mock_manifest_content_ecc["dependencies"]["sap_foundation"]["supportedVersions"] = ["ecc"]

    global_config = GlobalConfig(**mock_config_content)

    mock_manifest = ManifestConfig(**mock_manifest_content_ecc)
    mock_discover_modules.return_value = {
        "cortex.sap": {
            "physical_dir": pathlib.Path("/tmp"),
            "module_dir_name": "module_dir",
            "builder_key": None,
            "category": "data_foundation",
            "manifest": mock_manifest,
            "namespace": "cortex",
        }
    }

    builder = DataformBuilder(global_config=global_config, output_dir=pathlib.Path("output"))

    # Config has foundation in "s4" version, while product requires "ecc".
    result = builder._generate_config_js_content()

    assert result is None


def test_generate_centralized_sources_path_traversal_project(tmp_path):
    """Verifies that path traversal attempts in project IDs are blocked."""
    from common.builders.base import Source

    global_config = GlobalConfig(
        data={
            "bigQueryLocation": "US",
            "sources": [],
            "targets": [],
            "modules": {"foundation": [], "product": []},
        }
    )
    builder = DataformBuilder(global_config=global_config, output_dir=tmp_path)

    # Add a malicious source to registry
    builder.sources_registry.add(Source(project="../../../pwned", dataset="sap_cdc", table="mara"))

    with pytest.raises(ValueError) as excinfo:
        builder._generate_centralized_sources()
    assert "Invalid project ID" in str(excinfo.value)


def test_generate_centralized_sources_path_traversal_dataset(tmp_path):
    """Verifies that path traversal attempts in dataset IDs are blocked."""
    from common.builders.base import Source

    global_config = GlobalConfig(
        data={
            "bigQueryLocation": "US",
            "sources": [],
            "targets": [],
            "modules": {"foundation": [], "product": []},
        }
    )
    builder = DataformBuilder(global_config=global_config, output_dir=tmp_path)

    # Add a source with a valid project but malicious dataset to registry
    builder.sources_registry.add(
        Source(project="valid-project", dataset="../../../pwned", table="mara")
    )

    with pytest.raises(ValueError) as excinfo:
        builder._generate_centralized_sources()
    assert "Invalid dataset ID" in str(excinfo.value)


def test_generate_centralized_sources_valid(tmp_path):
    """Verifies that valid project/dataset IDs work correctly."""
    from common.builders.base import Source

    global_config = GlobalConfig(
        data={
            "bigQueryLocation": "US",
            "sources": [],
            "targets": [],
            "modules": {"foundation": [], "product": []},
        }
    )
    builder = DataformBuilder(global_config=global_config, output_dir=tmp_path)

    builder.sources_registry.add(
        Source(project="valid-project", dataset="valid_dataset", table="mara")
    )

    builder._generate_centralized_sources()

    expected_file = tmp_path / "definitions" / "sources" / "valid-project_valid_dataset_sources.js"
    assert expected_file.exists()


@mock.patch("tools.build.shutil.rmtree")
@mock.patch("tools.build.shutil.copytree")
@mock.patch("tools.build.shutil.copy2")
@mock.patch("tools.build.DataformBuilder._discover_modules")
def test_build_with_assertions_success(
    mock_discover_modules, mock_copy2, mock_copytree, mock_rmtree, tmp_path
):
    mock_discover_modules.return_value = {}
    global_config = GlobalConfig(
        data={
            "bigQueryLocation": "US",
            "sources": [],
            "targets": [],
            "modules": {"foundation": [], "product": []},
        }
    )

    assertions_file = tmp_path / "assertions.sqlx"
    assertions_file.touch()

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
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
    global_config = GlobalConfig(
        data={
            "bigQueryLocation": "US",
            "sources": [],
            "targets": [],
            "modules": {"foundation": [], "product": []},
        }
    )

    assertions_dir = tmp_path / "assertions"
    assertions_dir.mkdir()

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=tmp_path / "output",
        assertions_path=assertions_dir,
    )

    builder._prepare_workspace()

    mock_log_error.assert_called_once_with("Assertions path must be a file, not a directory.")
    mock_copy2.assert_not_called()
