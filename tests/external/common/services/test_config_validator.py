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

import pytest
import yaml

from common.services.config_validator import ConfigValidator


@pytest.fixture
def temp_config_path(tmp_path) -> pathlib.Path:
    """Fixture to provide a temporary config file path."""
    return tmp_path / "config.yaml"


def test_config_validator_valid(temp_config_path):
    """Test ConfigValidator with a completely valid configuration."""
    valid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "purchasing",
                        "type": "cortex.purchasing",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(valid_config, f)

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert is_valid
    assert not errors


def test_config_validator_indentation_error(temp_config_path):
    """Test ConfigValidator detects indentation errors (e.g. data inside buildEnvironment)."""
    bad_config = {
        "buildEnvironment": {
            "buildProjectId": "my-build-project",
            # 'data' is nested inside buildEnvironment
            "data": {
                "bigQueryLocation": "US",
                "namespaces": [{"name": "cortex", "path": "cortex"}],
            },
        }
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(bad_config, f)

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any("incorrectly indented" in err for err in errors)
    assert any("Did you mean to place it under 'root'?" in err for err in errors)


def test_config_validator_duplicate_ids(temp_config_path):
    """Test ConfigValidator detects duplicate IDs across sources, targets, and modules."""
    config_with_duplicates = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "duplicate_id", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [{"id": "duplicate_id", "projectId": "tgt-proj", "datasetId": "tgt-ds"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "duplicate_id",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any("Duplicate ID 'duplicate_id'" in err for err in errors)


def test_config_validator_referential_integrity(temp_config_path):
    """Test ConfigValidator detects unknown references with spelling suggestions."""
    config_with_bad_refs = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw_correct", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [
                {"id": "sap_foundation_correct", "projectId": "tgt-proj", "datasetId": "tgt-ds"}
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
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
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [{"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
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
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [{"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
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
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [{"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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
    is_valid, errors = ConfigValidator.validate(config_path)
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
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [{"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any("specifies a tableSettings file" in err for err in errors)


def test_config_validator_snake_case_error(temp_config_path):
    """Test ConfigValidator rejects snake_case keys and recommends camelCase."""
    snake_case_config = {
        "build_environment": {  # snake_case
            "buildProjectId": "my-build-project"
        },
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                # 'project_id' in snake_case
                {"id": "sap_raw", "project_id": "raw-proj", "datasetId": "raw-ds"}
            ],
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(snake_case_config, f)

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any(
        "Invalid key casing: 'build_environment' under 'root'. "
        "Please use camelCase format: 'buildEnvironment'." in err
        for err in errors
    )
    assert any(
        "Invalid key casing: 'project_id' under 'data -> sources[0]'. "
        "Please use camelCase format: 'projectId'." in err
        for err in errors
    )


def test_config_validator_missing_required_fields(temp_config_path):
    """Test ConfigValidator detects missing required fields at various levels."""
    incomplete_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        # 'data' is present but missing 'bigQueryLocation' and 'modules'
        "data": {
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                # missing 'projectId'
                {"id": "sap_raw", "datasetId": "raw-ds"}
            ],
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(incomplete_config, f)

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any("Missing required field 'bigQueryLocation' under 'data'." in err for err in errors)
    assert any("Missing required field 'modules' under 'data'." in err for err in errors)
    assert any(
        "Missing required field 'projectId' under 'data -> sources[0]'." in err for err in errors
    )


def test_config_validator_multiple_sources_targets_modules(temp_config_path):
    """Test ConfigValidator with complex configurations."""
    complex_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                {"id": "sap_raw", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
                {"id": "marketing_raw", "projectId": "raw-proj-2", "datasetId": "raw-ds-2"},
            ],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                {"id": "marketing_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-2"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "type": "cortex.generic",
                        "dataSourceId": "marketing_raw",
                        "dataTargetId": "marketing_foundation",
                    },
                ],
                "product": [
                    {
                        "moduleId": "sap_purchasing",
                        "type": "cortex.purchasing",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "marketing_roi",
                        "type": "cortex.roi",
                        "dependsOn": {"marketingModule": "ads"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "consolidated_dashboard",
                        "type": "cortex.dashboard",
                        "dependsOn": {
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert is_valid
    assert not errors


def test_config_validator_multiple_sources_targets_modules_structural_errors(temp_config_path):
    """Test ConfigValidator with multiple structural errors across multiple components."""
    complex_error_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                {"id": "raw_1", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
            ],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                # missing datasetId
                {"id": "marketing_foundation", "projectId": "tgt-proj"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
                        "dataSourceId": "raw_1",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "type": "cortex.generic",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    print("DEBUG ERRORS:", errors)
    assert not is_valid
    assert any(
        "Missing required field 'datasetId' under 'data -> targets[1]'." in err for err in errors
    )
    assert any(
        "Unexpected field 'buildProjectId' under 'data -> modules -> foundation[1]'." in err
        for err in errors
    )


def test_config_validator_multiple_sources_targets_modules_business_rule_errors(temp_config_path):
    """Test ConfigValidator with multiple business rule errors across multiple components."""
    complex_error_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                # duplicate ID (erp matches moduleId erp!)
                {"id": "erp", "projectId": "raw-proj-1", "datasetId": "raw-ds-1"},
                {"id": "marketing_raw", "projectId": "raw-proj-2", "datasetId": "raw-ds-2"},
            ],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-1"},
                {"id": "marketing_foundation", "projectId": "tgt-proj", "datasetId": "fnd-ds-2"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
                        "dataSourceId": "erp",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "s4", "mandt": "100"},
                    },
                    {
                        "moduleId": "ads",
                        "type": "cortex.generic",
                        "dataSourceId": "marketing_raw",
                        "dataTargetId": "marketing_foundation",
                    },
                ],
                "product": [
                    {
                        "moduleId": "sap_purchasing",
                        "type": "cortex.purchasing",
                        "dependsOn": {"sapModule": "erp"},
                        # references non-existent target
                        "dataTargetId": "product_target_typo",
                    }
                ],
            },
        },
    }

    with open(temp_config_path, "w", encoding="utf-8") as f:
        yaml.dump(complex_error_config, f)

    is_valid, errors = ConfigValidator.validate(temp_config_path)
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
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert is_valid
    assert not errors


def test_config_validator_build_environment_timeout_invalid_type(temp_config_path):
    """Test ConfigValidator rejects timeout field if it is not an integer."""
    invalid_config = {
        "buildEnvironment": {"buildProjectId": "my-build-project", "timeout": "not-an-integer"},
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "sap_raw", "projectId": "raw-proj", "datasetId": "raw-ds"}],
            "targets": [
                {"id": "sap_foundation", "projectId": "tgt-proj", "datasetId": "tgt-ds"},
                {"id": "product_target", "projectId": "tgt-proj", "datasetId": "prod-ds"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
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

    is_valid, errors = ConfigValidator.validate(temp_config_path)
    assert not is_valid
    assert any("Input should be a valid integer" in err for err in errors)
