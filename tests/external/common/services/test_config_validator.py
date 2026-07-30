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

"""Unit tests for ConfigValidator."""

import pathlib
from unittest.mock import MagicMock, patch

import pytest
import yaml

from common.schemas.manifest_schema import ManifestConfig
from common.services.config_loader import ConfigLoader
from common.services.unified_module_provider import UnifiedModuleProvider


@pytest.fixture
def temp_config_path(tmp_path) -> pathlib.Path:
    """Fixture to provide a temporary config file path."""
    return tmp_path / "config.yaml"


@pytest.fixture(autouse=True)
def mock_module_discoverability():
    """Mock module discoverability checks to accept dummy module types in unit tests."""

    original_is_valid = UnifiedModuleProvider.is_valid_module_type
    original_get_module_dir = UnifiedModuleProvider.get_module_dir

    def mock_is_valid(self, module_type: str) -> bool:
        allowed_dummies = {
            "cortex.sap.foundations.sap",
            "cortex.sap.products.purchasing",
            "cortex.generic.foundations.dummy",
            "cortex.generic.products.roi",
            "cortex.generic.products.dashboard",
            "cortex.sap.products.my_prod_type",
        }
        if module_type in allowed_dummies:
            return True
        return original_is_valid(self, module_type)

    def mock_get_manifest(self, module_type: str) -> ManifestConfig | None:
        if "sap" in module_type:
            engine = "sap"
        elif "generic" in module_type:
            engine = "generic"
        else:
            engine = "sap"  # Default for tests

        category = "source_aligned_product" if "products" in module_type else "foundation"
        return ManifestConfig.model_validate({"type": engine, "category": category})

    def mock_get_module_dir(self, module_type: str) -> pathlib.Path | None:
        if mock_is_valid(self, module_type):
            return pathlib.Path(f"/mock/cortex/{module_type.replace('.', '/')}")
        return original_get_module_dir(self, module_type)

    with (
        patch.object(UnifiedModuleProvider, "is_valid_module_type", mock_is_valid),
        patch.object(UnifiedModuleProvider, "get_manifest", mock_get_manifest),
        patch.object(UnifiedModuleProvider, "get_module_dir", mock_get_module_dir),
    ):
        yield


def test_config_validator_valid(temp_config_path):
    """Test ConfigValidator with a completely valid configuration."""
    valid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "purchasing",
                        "modulePath": "cortex.sap.products.purchasing",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(valid_config, f)

    mock_manifests = {
        "purchasing": {
            "modulePath": "purchasing",
            "dependencies": {
                "sapModule": {
                    "modulePath": "cortex.sap.foundations.sap",
                    "tables": {"common": ["dummy_table"]},
                    "supportedVersions": ["ecc", "s4"],
                }
            },
        },
        "sap": {"modulePath": "cortex.sap.foundations.sap", "category": "foundation"},
    }

    original_exists = pathlib.Path.exists

    def side_effect_exists(self):
        if self.name in ("manifest.yaml", "table_settings.default.yaml"):
            return True
        return original_exists(self)

    def side_effect_load_yaml(path, *args, **kwargs):
        if path.name == "manifest.yaml":
            dir_name = path.parent.name
            if dir_name in mock_manifests:
                return mock_manifests[dir_name]
            return {}
        else:
            return {"common": [{"source": {"tableName": "dummy_table"}}]}

    with (
        patch.object(pathlib.Path, "exists", autospec=True, side_effect=side_effect_exists),
        patch("common.services.config_validator.load_yaml", side_effect=side_effect_load_yaml),
    ):
        is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)

    print("ERRORS:", errors)
    assert is_valid, f"Validation failed with errors: {errors}"
    assert not errors


def test_config_validator_indentation_error(temp_config_path):
    """Test ConfigValidator detects indentation errors (e.g. data inside buildEnvironment)."""
    bad_config = {
        "buildEnvironment": {
            "buildProjectId": "my-build-project",
            # 'data' is nested inside buildEnvironment
            "data": {
                "bigQueryLocation": "US",
                "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            },
        }
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(bad_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("incorrectly indented" in err for err in errors)
    assert any("Did you mean to place it under 'root'?" in err for err in errors)


def test_config_validator_duplicate_ids(temp_config_path):
    """Test ConfigValidator detects duplicate IDs across sources, targets, and modules."""
    config_with_duplicates = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "duplicate_id", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "duplicate_id", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "duplicate_id",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "duplicate_id",
                        "dataTargetId": "duplicate_id",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_duplicates, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("Duplicate ID 'duplicate_id'" in err for err in errors)


def test_config_validator_referential_integrity(temp_config_path):
    """Test ConfigValidator detects unknown references with spelling suggestions."""
    config_with_bad_refs = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw_correct", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation_correct", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        # 'sap_raw_typo' instead of 'sap_raw_correct'
                        "dataSourceId": "sap_raw_typo",
                        "dataTargetId": "sap_foundation_correct",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_bad_refs, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("references unknown dataSourceId 'sap_raw_typo'" in err for err in errors)
    assert any("Did you mean one of these" in err for err in errors)
    assert any("sap_raw_correct" in err for err in errors)


def test_config_validator_nonexistent_explicit_table_settings(temp_config_path, tmp_path):
    """Test ConfigValidator detects missing explicit table settings files."""
    non_existent_settings_file = tmp_path / "non_existent_table_settings.yaml"

    config_with_missing_settings = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                        # Pointing to non-existent file
                        "tableSettings": str(non_existent_settings_file),
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_missing_settings, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("specifies a tableSettings file" in err for err in errors)
    assert any("does not exist" in err for err in errors)


def test_config_validator_valid_explicit_table_settings(temp_config_path, tmp_path):
    """Test ConfigValidator successfully validates an existing explicit table settings file."""
    valid_settings_file = tmp_path / "valid_table_settings.yaml"
    with open(valid_settings_file, "w", encoding="utf-8") as sf:
        yaml.dump({"common": []}, sf)

    config_with_valid_settings = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                        "tableSettings": str(valid_settings_file),
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_valid_settings, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    print("ERRORS:", errors)
    assert is_valid
    assert not errors


def test_config_validator_relative_table_settings(tmp_path, monkeypatch):
    """Test ConfigValidator correctly resolves relative table settings.

    It must resolve them against the config file directory instead of CWD.
    """
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    config_path = config_dir / "config.yaml"

    relative_settings_file = config_dir / "my_table_settings.yaml"
    with open(relative_settings_file, "w", encoding="utf-8") as sf:
        yaml.dump({"common": []}, sf)

    config_with_relative_settings = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                        "tableSettings": "my_table_settings.yaml",
                    }
                ]
            },
        },
    }

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_relative_settings, f)

    monkeypatch.chdir(tmp_path)
    is_valid, errors = ConfigLoader.load_and_validate(config_path)
    print("ERRORS:", errors)
    assert is_valid
    assert not errors


def test_config_validator_invalid_yaml_table_settings(temp_config_path, tmp_path):
    """Test ConfigValidator catches invalid YAML in explicit table settings files."""
    invalid_settings_file = tmp_path / "invalid_table_settings.yaml"
    with open(invalid_settings_file, "w", encoding="utf-8") as sf:
        sf.write("invalid: [yaml: content")

    config_with_invalid_settings = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                        "tableSettings": str(invalid_settings_file),
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_with_invalid_settings, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("specifies a tableSettings file" in err for err in errors)
    assert any("has invalid YAML syntax" in err for err in errors)


def test_config_validator_snake_case_error(temp_config_path):
    """Test ConfigValidator rejects snake_case keys and recommends camelCase."""
    snake_case_config = {
        "build_environment": {  # snake_case
            "buildProjectId": "my-build-project"
        },
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                # 'project_id' in snake_case
                {"id": "sap_raw", "project_id": "raw-proj", "datasetId": "raw-ds"}
            ],
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(snake_case_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any(
        "Invalid key casing: 'build_environment' under 'root'. "
        "Please use camelCase format: 'buildEnvironment'." in err
        for err in errors
    )
    assert any(
        "Invalid key casing: 'project_id' under 'data -> datasets[0]'. "
        "Please use camelCase format: 'projectId'." in err
        for err in errors
    )


def test_config_validator_missing_required_fields(temp_config_path):
    """Test ConfigValidator detects missing required fields at various levels."""
    incomplete_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        # 'data' is present but missing 'bigQueryLocation' and 'modules'
        "data": {
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                # missing 'projectId'
                {"id": "sap_raw", "datasetId": "raw-ds"}
            ],
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(incomplete_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("Missing required field 'bigQueryLocation' under 'data'." in err for err in errors)
    assert any("Missing required field 'modules' under 'data'." in err for err in errors)
    assert any(
        "Missing required field 'projectId' under 'data -> datasets[0]'." in err for err in errors
    )


def test_config_validator_multiple_sources_targets_modules(temp_config_path):
    """Test ConfigValidator with complex configurations."""
    complex_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
                {"id": "marketing_raw", "projectId": "raw-proj-2", "datasetId": "raw-ds-2"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                {"id": "marketing_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-2"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dataSourceId": "marketing_raw",
                        "dataTargetId": "marketing_foundation",
                    },
                ],
                "product": [
                    {
                        "moduleId": "sap_purchasing",
                        "modulePath": "cortex.sap.products.purchasing",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "marketing_roi",
                        "modulePath": "cortex.generic.products.roi",
                        "dependencyBindings": {"marketingModule": "ads"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "consolidated_dashboard",
                        "modulePath": "cortex.generic.products.dashboard",
                        "dependencyBindings": {
                            "purchasingModule": "sap_purchasing",
                            "roiModule": "marketing_roi",
                        },
                        "dataTargetId": "product_target",
                    },
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(complex_config, f)

    mock_manifests = {
        "purchasing": {
            "modulePath": "purchasing",
            "dependencies": {
                "sapModule": {
                    "modulePath": "cortex.sap.foundations.sap",
                    "tables": {"common": ["dummy_table"]},
                    "supportedVersions": ["ecc", "s4"],
                }
            },
        },
        "roi": {
            "modulePath": "roi",
            "dependencies": {
                "marketingModule": {
                    "modulePath": "cortex.generic.foundations.dummy",
                    "tables": ["dummy_table"],
                }
            },
        },
        "dashboard": {
            "modulePath": "dashboard",
            "dependencies": {
                "purchasingModule": {"modulePath": "cortex.sap.products.purchasing"},
                "roiModule": {"modulePath": "cortex.generic.products.roi"},
            },
        },
        "sap": {"modulePath": "cortex.sap.foundations.sap", "category": "foundation"},
        "generic": {"type": "generic", "category": "foundation"},
    }

    original_exists = pathlib.Path.exists

    def side_effect_exists(self):
        if self.name in ("manifest.yaml", "table_settings.default.yaml"):
            return True
        return original_exists(self)

    def side_effect_load_yaml(path, *args, **kwargs):
        if path.name == "manifest.yaml":
            dir_name = path.parent.name
            if dir_name in mock_manifests:
                return mock_manifests[dir_name]
            return {}
        else:
            return {"common": [{"source": {"tableName": "dummy_table"}}]}

    with (
        patch.object(pathlib.Path, "exists", autospec=True, side_effect=side_effect_exists),
        patch("common.services.config_validator.load_yaml", side_effect=side_effect_load_yaml),
    ):
        is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)

    print("ERRORS:", errors)
    assert is_valid, f"Validation failed with errors: {errors}"
    assert not errors


def test_config_validator_multiple_sources_targets_modules_structural_errors(temp_config_path):
    """Test ConfigValidator with multiple structural errors across multiple components."""
    complex_error_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "raw_1", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                # missing datasetId
                {"id": "marketing_foundation", "projectId": "tgt-proj"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "raw_1",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dataSourceId": "raw_1",
                        "dataTargetId": "sap_foundation",
                        # Unexpected field (misplaced from top-level!)
                        "buildProjectId": "misplaced-id",
                    },
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(complex_error_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    print("DEBUG ERRORS:", errors)
    assert not is_valid
    assert any(
        "Missing required field 'datasetId' under 'data -> datasets[2]'." in err for err in errors
    )
    assert any(
        "Unexpected field 'buildProjectId'" in err and "data -> modules -> foundation" in err
        for err in errors
    )


def test_config_validator_multiple_sources_targets_modules_business_rule_errors(temp_config_path):
    """Test ConfigValidator with multiple business rule errors across multiple components."""
    complex_error_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                # duplicate ID (erp matches moduleId erp!)
                {"id": "erp", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
                {"id": "marketing_raw", "projectId": "raw-proj-2", "datasetId": "raw-ds-2"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                {"id": "marketing_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-2"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "erp",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dataSourceId": "marketing_raw",
                        "dataTargetId": "marketing_foundation",
                    },
                ],
                "product": [
                    {
                        "moduleId": "sap_purchasing",
                        "modulePath": "cortex.sap.products.purchasing",
                        "dependencyBindings": {"sapModule": "erp"},
                        # references non-existent target
                        "dataTargetId": "product_target_typo",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(complex_error_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("Duplicate ID 'erp' found across the configuration" in err for err in errors)
    assert any(
        "Product module 'sap_purchasing' references unknown "
        "dataTargetId 'product_target_typo'." in err
        for err in errors
    )


def test_config_validator_build_environment_timeout_valid(temp_config_path):
    """Test ConfigValidator accepts timeout field with integer value."""
    valid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project", "timeout": 120},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(valid_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    print("ERRORS:", errors)
    assert is_valid
    assert not errors


def test_config_validator_build_environment_timeout_invalid_type(temp_config_path):
    """Test ConfigValidator rejects timeout field if it is not an integer."""
    invalid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project", "timeout": "not-an-integer"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(invalid_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("Input should be a valid integer" in err for err in errors)


def test_config_validator_nonexistent_dependency(temp_config_path):
    """Test ConfigValidator detects dependencies mapping to non-existent module IDs."""
    invalid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "purchasing",
                        "modulePath": "cortex.sap.products.purchasing",
                        "dependencyBindings": {"sapModule": "nonexistent_module_id"},
                        "dataTargetId": "product_target",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(invalid_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any(
        "Product module 'purchasing' dependencyBindings key 'sapModule' maps to unknown module ID "
        "'nonexistent_module_id'" in err
        for err in errors
    )


def test_config_validator_disabled_dependency(temp_config_path):
    """Test ConfigValidator detects dependencies mapping to disabled module IDs."""
    invalid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "enabled": False,
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "purchasing",
                        "modulePath": "cortex.sap.products.purchasing",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(invalid_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any(
        "Product module 'purchasing' dependencyBindings key 'sapModule' maps to module 'erp' "
        "which is disabled" in err
        for err in errors
    )


def test_config_validator_circular_dependency(temp_config_path):
    """Test ConfigValidator detects circular dependencies between enabled modules."""
    circular_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "product": [
                    {
                        "moduleId": "module_a",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dependencyBindings": {"dep_b": "module_b"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "module_b",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dependencyBindings": {"dep_c": "module_c"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "module_c",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dependencyBindings": {"dep_a": "module_a"},
                        "dataTargetId": "product_target",
                    },
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(circular_config, f)

    is_valid, errors = ConfigLoader.load_and_validate(temp_config_path)
    assert not is_valid
    assert any("Circular dependency detected in module configuration" in err for err in errors)


def test_validate_external_catalog_dependency_valid(temp_config_path):
    """Verify passing validation when product depends on existing catalog schema and tables."""

    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "catalogs": [
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
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"extShare": "my_catalog.share_1.schema_1"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = {"my_catalog.share_1.schema_1"}
    mock_provider.get_tables_for_module.return_value = {"table_a", "table_b"}
    mock_provider.get_provided_types_for_module.return_value = []

    mock_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "extShare": {
                    "modulePath": "my_catalog.share_1.schema_1",
                    "tables": ["table_a", "table_b"],
                }
            },
        }
    )
    mock_provider.get_manifest.return_value = mock_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    print("ERRORS:", errors)
    assert is_valid
    assert not errors


def test_validate_external_catalog_dependency_missing_table(temp_config_path):
    """Verify validation failure when a manifest requires a table not present in catalog."""

    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "catalogs": [
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
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"extShare": "my_catalog.share_1.schema_1"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = {"my_catalog.share_1.schema_1"}
    mock_provider.get_tables_for_module.return_value = {"table_a"}
    mock_provider.get_provided_types_for_module.return_value = []

    mock_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "extShare": {
                    "modulePath": "my_catalog.share_1.schema_1",
                    "tables": ["table_a", "table_b"],
                }
            },
        }
    )
    mock_provider.get_manifest.return_value = mock_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    assert not is_valid
    assert any(
        "requires table 'table_b'" in err and "was not found in the external catalog share" in err
        for err in errors
    )


def test_validate_standard_dependency_missing_table(temp_config_path, tmp_path):
    """Verify validation failure when a manifest requires a table missing in standard dependency."""

    table_settings_file = tmp_path / "ts.yaml"
    with open(table_settings_file, "w", encoding="utf-8") as sf:
        yaml.dump({"common": [{"source": {"tableName": "table_a"}, "target": {}}]}, sf)

    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "fnd_tgt", "projectId": "tgt-proj", "datasetId": "fnd-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "fnd_mod",
                        "modulePath": "cortex.generic.foundations.dummy",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "fnd_tgt",
                        "tableSettings": str(table_settings_file),
                    }
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"fndDep": "fnd_mod"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = set()

    prod_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "fndDep": {
                    "modulePath": "cortex.generic.foundations.dummy",
                    "tables": ["table_a", "table_missing"],
                }
            },
        }
    )
    fnd_manifest = ManifestConfig.model_validate(
        {
            "type": "generic",
            "category": "foundation",
        }
    )

    def side_effect_get_manifest(module_type):
        if "product" in module_type or "my_prod_type" in module_type:
            return prod_manifest
        return fnd_manifest

    mock_provider.get_manifest.side_effect = side_effect_get_manifest

    def side_effect_load_yaml(path, *args, **kwargs):
        if "ts.yaml" in str(path):
            return {"common": [{"source": {"tableName": "table_a"}, "target": {}}]}
        raise ValueError(f"Unexpected load_yaml call for {path}")

    with patch("common.services.config_validator.load_yaml", side_effect=side_effect_load_yaml):
        is_valid, errors = ConfigLoader.load_and_validate(
            temp_config_path, module_provider=mock_provider
        )

    assert not is_valid
    print("DEBUG ERRORS:", errors)
    assert any(
        "requires table 'table_missing'" in err and "missing or disabled" in err for err in errors
    )


def test_validate_external_catalog_dependency_type_valid(temp_config_path):
    """Verify validation passes when catalog providesNamespace matches expected type."""

    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "catalogs": [
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
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"extShare": "my_catalog.share_1.sales"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = {"my_catalog.share_1.sales"}
    mock_provider.get_tables_for_module.return_value = {"table_a"}
    mock_provider.get_provided_types_for_module.return_value = ["sap.bdc.sales"]

    mock_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "extShare": {
                    "modulePath": "sap.bdc.sales",
                    "tables": ["table_a"],
                }
            },
        }
    )
    mock_provider.get_manifest.return_value = mock_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    print("ERRORS:", errors)
    assert is_valid
    assert not errors


def test_validate_external_catalog_dependency_type_invalid(temp_config_path):
    """Verify validation fails when catalog providesNamespace does not match expected type."""

    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "catalogs": [
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
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"extShare": "my_catalog.share_1.sales"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = {"my_catalog.share_1.sales"}
    mock_provider.get_tables_for_module.return_value = {"table_a"}
    mock_provider.get_provided_types_for_module.return_value = ["sap.bdc.sales"]

    mock_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "extShare": {
                    "modulePath": "sap.bdc.marketing",
                    "tables": ["table_a"],
                }
            },
        }
    )
    mock_provider.get_manifest.return_value = mock_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    assert not is_valid
    assert any(
        (
            "expects dependency 'extShare' to be of type 'sap.bdc.marketing'" in err
            or "expects dependency 'extShare' to be of type 'bdc.marketing'" in err
        )
        and "is configured to provide types: ['sap.bdc.sales']" in err
        for err in errors
    )


def test_validate_sap_dependency_with_generic_foundation(temp_config_path):
    """Verify validation fails when a product expects SAP but the foundation is generic."""
    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "my_generic_found",
                        "moduleType": "generic",
                        "modulePath": "cortex.generic.foundations.some_found",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "prod_tgt",
                    }
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"sapFound": "my_generic_found"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = set()
    mock_provider.get_tables_for_module.return_value = {"table_a"}

    # Mock product manifest with SAP dependency
    prod_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "sapFound": {
                    "modulePath": "cortex.sap.foundations.sap",
                    "supportedVersions": ["ecc", "s4"],
                    "tables": {"ecc": ["table_a"], "s4": ["table_a"]},
                }
            },
        }
    )

    found_manifest = ManifestConfig.model_validate(
        {
            "type": "generic",
            "category": "foundation",
        }
    )

    def mock_get_manifest(mod_type):
        if "products" in mod_type:
            return prod_manifest
        return found_manifest

    mock_provider.get_manifest.side_effect = mock_get_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    assert not is_valid
    assert any("expects a module providing SAP-specific capabilities" in err for err in errors)


def test_validate_sap_dependency_version_mismatch(temp_config_path):
    """Verify validation fails when a product expects SAP S4 but the foundation is ECC."""
    config_dict = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"},
                {"id": "prod_tgt", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "my_sap_found",
                        "moduleType": "sap",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "prod_tgt",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "my_prod",
                        "modulePath": "cortex.sap.products.my_prod_type",
                        "dataTargetId": "prod_tgt",
                        "dependencyBindings": {"sapFound": "my_sap_found"},
                    }
                ],
            },
        },
    }
    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f)

    mock_provider = MagicMock(spec=UnifiedModuleProvider)
    mock_provider.get_module_types.return_value = set()
    mock_provider.get_tables_for_module.return_value = {"table_a"}
    mock_provider.get_module_dir.return_value = None

    # Mock product manifest with SAP S4 dependency
    prod_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "source_aligned_product",
            "dependencies": {
                "sapFound": {
                    "modulePath": "cortex.sap.foundations.sap",
                    "supportedVersions": ["s4"],
                    "tables": {"s4": ["table_a"]},
                }
            },
        }
    )

    found_manifest = ManifestConfig.model_validate(
        {
            "type": "sap",
            "category": "foundation",
        }
    )

    def mock_get_manifest(mod_type):
        if "products" in mod_type:
            return prod_manifest
        return found_manifest

    mock_provider.get_manifest.side_effect = mock_get_manifest

    is_valid, errors = ConfigLoader.load_and_validate(
        temp_config_path, module_provider=mock_provider
    )

    print(f"ACTUAL ERRORS: {errors}")
    assert not is_valid
    assert any(
        "depends on foundation 'my_sap_found' with SAP version 'ecc'" in err for err in errors
    )
