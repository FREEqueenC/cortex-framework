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
import re
from typing import TypedDict

import pytest
import yaml

from common.schemas.config_schema import GlobalConfig
from common.schemas.manifest_schema import ManifestConfig


def test_naming_conventions(repo_root: pathlib.Path):
    """
    Validates that all files and directories in src/data_modules/cortex/data_foundation,
    src/data_modules/cortex/data_product, and src/data_modules/cortex/includes
    follow snake_case naming conventions to avoid cross-OS file system case sensitivity bugs.
    """
    src_dir = repo_root / "src" / "data_modules" / "cortex"
    target_dirs = [
        src_dir / "data_foundation",
        src_dir / "data_product",
        src_dir / "includes",
    ]

    # regex for snake_case: lowercase letters, numbers, and underscores.
    # also allow standard file extensions
    snake_case_pattern = re.compile(r"^[a-z0-9_]+(\.[a-z0-9]+)*$")

    errors = []

    for t_dir in target_dirs:
        if not t_dir.exists():
            continue

        for path in t_dir.rglob("*"):
            # skip hidden files/dirs like .DS_Store or __pycache__
            if path.name.startswith(".") or "__" in path.name or path.parts[-2] == "__pycache__":
                continue

            # allow README.md
            if path.name == "README.md":
                continue

            if not snake_case_pattern.match(path.name):
                errors.append(
                    f"Invalid name '{path.name}' at '{path.relative_to(repo_root)}'. "
                    f"Must be snake_case."
                )

    if errors:
        error_msg = "\n".join(["Naming convention violations found:"] + errors)
        pytest.fail(error_msg)


def test_schema_conformance(repo_root: pathlib.Path):
    """
    Validates that config/config.yaml and all manifest.yaml files
    can be strictly parsed by their respective Pydantic schemas.
    """
    errors = []
    # 1. Validate Main Configs
    config_files = [
        repo_root / "tests" / "internal" / "config.unittest.yaml",
        repo_root / "config" / "config.yaml.example",
    ]

    for config_path in config_files:
        if config_path.exists():
            try:
                with open(config_path) as f:
                    config_data = yaml.safe_load(f) or {}
                # Parse it using GlobalConfig
                GlobalConfig(**config_data)
            except Exception as e:
                errors.append(f"Failed to parse config '{config_path.relative_to(repo_root)}': {e}")

    # 2. Validate all Manifests in 'cortex' namespace
    cortex_dir = repo_root / "src" / "data_modules" / "cortex"

    for manifest_path in cortex_dir.rglob("manifest.yaml"):
        try:
            with open(manifest_path) as f:
                manifest_data = yaml.safe_load(f) or {}

            ManifestConfig(**manifest_data)
        except Exception as e:
            errors.append(f"Failed to parse manifest '{manifest_path.relative_to(repo_root)}': {e}")

    if errors:
        error_msg = "\n".join(["Schema conformance violations found:"] + errors)
        pytest.fail(error_msg)


def test_global_config_referential_integrity():
    """Test that GlobalConfig raises ValueError for invalid source/target references."""

    # Valid base data
    valid_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "src1", "projectId": "p", "datasetId": "d"}],
            "targets": [{"id": "tgt1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "type": "cortex.sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [],
            },
        }
    }

    # 1. Test Valid
    config = GlobalConfig.model_validate(valid_data)
    assert config is not None

    # 2. Test Invalid Source
    invalid_source_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [],  # Empty sources
            "targets": [{"id": "tgt1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "type": "cortex.sap",
                        "dataSourceId": "unknown_src",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        }
    }
    with pytest.raises(ValueError, match="references unknown data source"):
        GlobalConfig.model_validate(invalid_source_data)

    # 3. Test Invalid Target (Foundation)
    invalid_target_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "src1", "projectId": "p", "datasetId": "d"}],
            "targets": [],  # Empty targets
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "type": "cortex.sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "unknown_tgt",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        }
    }
    with pytest.raises(ValueError, match="references unknown data target"):
        GlobalConfig.model_validate(invalid_target_data)

    # 4. Test Invalid Target (Product)
    invalid_prod_target_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [],
            "targets": [],
            "modules": {
                "foundation": [],
                "product": [
                    {
                        "moduleId": "prod1",
                        "type": "cortex.sales",
                        "dataTargetId": "unknown_tgt",
                    }
                ],
            },
        }
    }
    with pytest.raises(ValueError, match="references unknown data target"):
        GlobalConfig.model_validate(invalid_prod_target_data)


def test_global_config_dataset_uniqueness_foundation():
    """Test that GlobalConfig raises ValueError for duplicate datasets
    in foundation modules of the same type.
    """
    data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [{"id": "src1", "projectId": "p", "datasetId": "d"}],
            "targets": [{"id": "tgt1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc_1",
                        "type": "cortex.sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    },
                    {
                        "moduleId": "sap_ecc_2",
                        "type": "cortex.sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    },
                ]
            },
        }
    }
    with pytest.raises(ValueError, match="shares target dataset"):
        GlobalConfig.model_validate(data)


def test_global_config_dataset_uniqueness_product():
    """Test that GlobalConfig raises ValueError for duplicate datasets
    in product modules of the same type.
    """
    data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [],
            "targets": [{"id": "tgt1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [],
                "product": [
                    {
                        "moduleId": "prod1",
                        "type": "cortex.sales",
                        "dataTargetId": "tgt1",
                    },
                    {
                        "moduleId": "prod2",
                        "type": "cortex.sales",
                        "dataTargetId": "tgt1",
                    },
                ],
            },
        }
    }
    with pytest.raises(ValueError, match="shares target dataset"):
        GlobalConfig.model_validate(data)


class ModuleMeta(TypedDict):
    category: str
    manifest: ManifestConfig


def test_config_modules_referential_integrity(repo_root: pathlib.Path):
    """
    Verifies that all modules in standard config files have valid types
    (found in workspace manifests) and that their dependencies resolve correctly.
    Fails if a manifest is missing the 'type' field.
    """
    # 1. Discover valid modules from manifests in 'cortex' namespace
    valid_modules: dict[str, ModuleMeta] = {}
    cortex_dir = repo_root / "src" / "data_modules" / "cortex"

    for category in ["data_foundation", "data_product"]:
        category_dir = cortex_dir / category
        if not category_dir.exists():
            continue
        for module_dir in category_dir.iterdir():
            if not module_dir.is_dir():
                continue
            manifest_path = module_dir / "manifest.yaml"
            if manifest_path.exists():
                with open(manifest_path) as f:
                    manifest_data = yaml.safe_load(f) or {}

                # Enforce strict type checking
                manifest_type = manifest_data.get("type")
                if not manifest_type:
                    rel_path = manifest_path.relative_to(repo_root)
                    pytest.fail(f"Manifest missing 'type' field at {rel_path}")

                manifest_config = ManifestConfig(**manifest_data)
                # Full namespaced type
                full_type = f"cortex.{manifest_type}"
                valid_modules[full_type] = {"category": category, "manifest": manifest_config}

    # 2. Validate standard configuration files
    config_files = [
        repo_root / "tests" / "internal" / "config.unittest.yaml",
        repo_root / "config" / "config.yaml.example",
    ]

    referential_errors = []

    for config_path in config_files:
        if not config_path.exists():
            continue
        with open(config_path) as f:
            config_data = yaml.safe_load(f) or {}

        try:
            config = GlobalConfig(**config_data)
        except Exception as e:
            rel_path = config_path.relative_to(repo_root)
            referential_errors.append(f"Config '{rel_path}' failed schema validation: {e}")
            continue

        foundation_lookup = {mod.module_id: mod for mod in config.data.modules.foundation}

        for prod_mod in config.data.modules.product:
            # Reconstruct full type for lookup
            full_type = f"{prod_mod._namespace}.{prod_mod._module_type}"
            if full_type not in valid_modules:
                referential_errors.append(
                    f"Config '{config_path.relative_to(repo_root)}' module '{prod_mod.module_id}' "
                    f"uses unknown type '{full_type}'."
                )
                continue

            module_meta = valid_modules[full_type]
            if module_meta["category"] != "data_product":
                rel_path = config_path.relative_to(repo_root)
                referential_errors.append(
                    f"Config '{rel_path}' module '{prod_mod.module_id}' uses type "
                    f"'{full_type}' which is from category '{module_meta['category']}', "
                    f"expected 'data_product'."
                )

            manifest_config = module_meta["manifest"]

            # Check dependencies
            for dep_key, foundation_id in prod_mod.depends_on.items():
                rel_path = config_path.relative_to(repo_root)
                if dep_key not in manifest_config.dependencies:
                    referential_errors.append(
                        f"Config '{rel_path}' module '{prod_mod.module_id}' references unknown "
                        f"dependency key '{dep_key}' for type '{full_type}'."
                    )

                if foundation_id not in foundation_lookup:
                    referential_errors.append(
                        f"Config '{rel_path}' module '{prod_mod.module_id}' depends on "
                        f"foundation '{foundation_id}' which is missing or disabled."
                    )
                    continue

                expected_type = manifest_config.dependencies[dep_key].type
                f_mod = foundation_lookup[foundation_id]
                # Compare using base type
                if f_mod._module_type != expected_type:
                    referential_errors.append(
                        f"Config '{rel_path}' module '{prod_mod.module_id}' depends on "
                        f"foundation '{foundation_id}' which is base type '{f_mod._module_type}' "
                        f"(expected '{expected_type}')."
                    )

    if referential_errors:
        error_msg = "\n".join(
            ["Referential integrity errors found in configs:"] + referential_errors
        )
        pytest.fail(error_msg)


def test_dataform_target_settings_optional_service_account():
    """Test that DataformTargetSettings allows service_account to be missing or empty."""

    from common.schemas.config_schema import DataformTargetSettings

    # Succeeds when missing
    settings = DataformTargetSettings(
        repositoryProjectId="p",
        repositoryRegion="r",
        repositoryName="n",
        workspaceName="w",
    )
    assert settings.service_account is None

    # Succeeds when empty string
    settings_empty = DataformTargetSettings(
        repositoryProjectId="p",
        repositoryRegion="r",
        repositoryName="n",
        workspaceName="w",
        serviceAccount="",
    )
    assert settings_empty.service_account is None

    # Succeeds when present
    settings_present = DataformTargetSettings(
        repositoryProjectId="p",
        repositoryRegion="r",
        repositoryName="n",
        workspaceName="w",
        serviceAccount="foo@bar.iam.gserviceaccount.com",
    )
    assert settings_present.service_account == "foo@bar.iam.gserviceaccount.com"
