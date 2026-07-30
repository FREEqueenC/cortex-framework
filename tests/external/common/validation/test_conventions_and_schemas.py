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
from typing import Any, TypedDict
from unittest.mock import Mock

import pytest
import yaml

from common.clients.lakehouse import BigLakeDeltaSharingClient
from common.schemas.config_schema import DataformTargetSettings, GlobalConfig, NamespaceConfig
from common.schemas.manifest_schema import ManifestConfig, SapDependencyInfo
from common.services.config_validator import ConfigValidator
from common.services.external_module_provider import ExternalModuleProvider
from common.services.internal_module_provider import InternalModuleProvider
from common.services.unified_module_provider import UnifiedModuleProvider


def test_naming_conventions(repo_root: pathlib.Path):
    """
    Validates that all files and directories in src/data_modules/
    follow snake_case naming conventions to avoid cross-OS file system case sensitivity bugs.
    """
    data_modules_dir = repo_root / "src" / "data_modules"
    target_dirs = [d for d in data_modules_dir.iterdir() if d.is_dir()]

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
        repo_root / "config" / "config.yaml.example",
    ] + list(repo_root.glob("tests/**/config*.yaml"))

    for config_path in config_files:
        if config_path.exists():
            try:
                with open(config_path) as f:
                    config_data = yaml.safe_load(f) or {}

                raw_modules = config_data.get("data", {}).get("modules", {})
                for group in ("foundation", "foundations", "product", "products"):
                    for mod in raw_modules.get(group, []):
                        if isinstance(mod, dict) and "moduleType" not in mod:
                            mod["moduleType"] = "sap"

                GlobalConfig(**config_data)
            except Exception as e:
                errors.append(f"Failed to parse config '{config_path.relative_to(repo_root)}': {e}")

    # 2. Validate all Manifests in all data_modules namespaces
    data_modules_dir = repo_root / "src" / "data_modules"

    for namespace_path in data_modules_dir.iterdir():
        if not namespace_path.is_dir():
            continue

        for manifest_path in namespace_path.rglob("manifest.yaml"):
            try:
                with open(manifest_path) as f:
                    manifest_data = yaml.safe_load(f) or {}

                ManifestConfig(**manifest_data)
            except Exception as e:
                errors.append(
                    f"Failed to parse manifest '{manifest_path.relative_to(repo_root)}': {e}"
                )

    if errors:
        error_msg = "\n".join(["Schema conformance violations found:"] + errors)
        pytest.fail(error_msg)


def test_table_settings_yaml_parsing(repo_root: pathlib.Path):
    """
    Validates that all table_settings.default.yaml files across all modules
    can be successfully parsed as valid YAML, preventing syntax errors from
    breaking the build pipeline.
    """
    data_modules_dir = repo_root / "src" / "data_modules"
    errors = []

    for path in data_modules_dir.rglob("table_settings.default.yaml"):
        try:
            with open(path) as f:
                yaml.safe_load(f)
        except yaml.YAMLError as e:
            errors.append(f"Failed to parse YAML for '{path.relative_to(repo_root)}':\n{e}")

    if errors:
        error_msg = "\n\n".join(["table_settings.default.yaml parsing errors found:"] + errors)
        pytest.fail(error_msg)


def test_foundation_table_settings_alphabetical_sorting(repo_root: pathlib.Path):
    """
    Validates that in all foundation table_settings.default.yaml files, table definitions
    within each section (e.g. s4, ecc, common) are sorted alphabetically by tableName.
    """
    data_modules_dir = repo_root / "src" / "data_modules"
    errors = []

    for path in data_modules_dir.rglob("table_settings.default.yaml"):
        if "foundations" not in path.parts:
            continue

        try:
            with open(path) as f:
                data = yaml.safe_load(f) or {}

            if not isinstance(data, dict):
                continue

            for section_name, section_items in data.items():
                if not isinstance(section_items, list):
                    continue

                table_names = []
                for item in section_items:
                    if (
                        isinstance(item, dict)
                        and "source" in item
                        and isinstance(item["source"], dict)
                    ):
                        t_name = item["source"].get("tableName")
                        if t_name:
                            table_names.append(str(t_name))

                sorted_table_names = sorted(table_names, key=str.lower)
                if table_names != sorted_table_names:
                    discrepancies = []
                    for actual, expected in zip(table_names, sorted_table_names, strict=True):
                        if actual.lower() != expected.lower():
                            discrepancies.append(f"found '{actual}', expected '{expected}'")
                    errors.append(
                        f"Foundation table settings '{path.relative_to(repo_root)}' "
                        f"section '{section_name}' is not alphabetically sorted by tableName. "
                        f"Discrepancies: {', '.join(discrepancies[:3])}"
                    )
        except Exception as e:
            errors.append(f"Error reading '{path.relative_to(repo_root)}': {e}")

    if errors:
        error_msg = "\n\n".join(
            ["Foundation table_settings.default.yaml sorting errors found:"] + errors
        )
        pytest.fail(error_msg)


def test_sap_foundation_table_settings_annotations_exist(repo_root: pathlib.Path):
    """
    Validates that for each table in a SAP foundation module's table_settings.default.yaml,
    a corresponding annotation file exists in the annotations directory, and vice versa.
    """
    data_modules_dir = repo_root / "src" / "data_modules"
    errors = []

    for path in data_modules_dir.rglob("table_settings.default.yaml"):
        manifest_path = path.parent / "manifest.yaml"
        if not manifest_path.exists():
            continue

        try:
            with open(manifest_path) as f:
                manifest_data = yaml.safe_load(f) or {}
            if manifest_data.get("type") != "sap" or manifest_data.get("category") != "foundation":
                continue
        except Exception:
            continue

        annotations_dir = path.parent / "annotations"

        try:
            with open(path) as f:
                settings_data = yaml.safe_load(f) or {}

            if not isinstance(settings_data, dict):
                continue

            defined_tables_by_section: dict[str, dict[str, str]] = {}
            all_defined_tables = set()

            for section_name, section_items in settings_data.items():
                if not isinstance(section_items, list):
                    continue
                defined_tables_by_section[section_name] = {}
                for item in section_items:
                    if (
                        isinstance(item, dict)
                        and "source" in item
                        and isinstance(item["source"], dict)
                    ):
                        table_name = item["source"].get("tableName")
                        if table_name:
                            t_lower = str(table_name).lower()
                            defined_tables_by_section[section_name][t_lower] = str(table_name)
                            all_defined_tables.add(t_lower)

            # Check for missing annotations
            for section_name, tables in defined_tables_by_section.items():
                for t_lower, t_orig in tables.items():
                    exact_annotation_path = annotations_dir / f"{t_lower}.yaml"
                    scoped_annotation_path = annotations_dir / section_name / f"{t_lower}.yaml"

                    if not exact_annotation_path.exists() and not scoped_annotation_path.exists():
                        errors.append(
                            f"[{path.parent.name}] Missing annotation file for "
                            f"table '{t_orig}' defined in section '{section_name}' "
                            f"of {path.relative_to(repo_root)}"
                        )

            # Check for orphaned annotations
            if annotations_dir.exists():
                for anno_file in annotations_dir.rglob("*.yaml"):
                    rel_path = anno_file.relative_to(annotations_dir)
                    anno_stem = rel_path.stem.lower()

                    if len(rel_path.parts) == 1:
                        if anno_stem not in all_defined_tables:
                            errors.append(
                                f"[{path.parent.name}] Orphaned annotation file "
                                f"'{anno_file.relative_to(repo_root)}' found, but "
                                f"table '{anno_stem}' is not defined in any section."
                            )
                    elif len(rel_path.parts) == 2:
                        section = rel_path.parts[0]
                        section_tables = defined_tables_by_section.get(section, {})
                        if anno_stem not in section_tables:
                            errors.append(
                                f"[{path.parent.name}] Orphaned annotation file "
                                f"'{anno_file.relative_to(repo_root)}' found in section "
                                f"'{section}', but table '{anno_stem}' is not defined "
                                f"in that section."
                            )
                    else:
                        errors.append(
                            f"[{path.parent.name}] Invalid nested annotation file "
                            f"'{anno_file.relative_to(repo_root)}'."
                        )

        except Exception as e:
            errors.append(f"Error processing {path.relative_to(repo_root)}: {e}")

    if errors:
        error_msg = "\n".join(["Missing or orphaned annotation files found:"] + errors)
        pytest.fail(error_msg)


def test_global_config_referential_integrity():
    """Test that GlobalConfig raises ValueError for invalid source/target references."""

    # Valid base data
    valid_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "src1", "projectId": "p", "datasetId": "d"},
                {"id": "tgt1", "projectId": "p", "datasetId": "d"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
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
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [{"id": "tgt1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "unknown_src",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        }
    }
    config = GlobalConfig.model_validate(invalid_source_data)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("references unknown data source" in e for e in errors)

    # 3. Test Invalid Target (Foundation)
    invalid_target_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [{"id": "src1", "projectId": "p", "datasetId": "d"}],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "unknown_tgt",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ]
            },
        }
    }
    config = GlobalConfig.model_validate(invalid_target_data)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("references unknown data target" in e for e in errors)

    # 4. Test Invalid Target (Product)
    invalid_prod_target_data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [],
            "modules": {
                "foundation": [],
                "product": [
                    {
                        "moduleId": "prod1",
                        "modulePath": "cortex.sap.products.sales_documents",
                        "moduleType": "sap",
                        "dataTargetId": "unknown_tgt",
                    }
                ],
            },
        }
    }
    config = GlobalConfig.model_validate(invalid_prod_target_data)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("references unknown data target" in e for e in errors)


def test_global_config_dataset_uniqueness_foundation():
    """Test that GlobalConfig raises ValueError for duplicate datasets
    in foundation modules of the same type.
    """
    data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "src1", "projectId": "p", "datasetId": "d"},
                {"id": "tgt1", "projectId": "p", "datasetId": "d"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "sap_ecc_1",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    },
                    {
                        "moduleId": "sap_ecc_2",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "src1",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    },
                ]
            },
        }
    }
    config = GlobalConfig.model_validate(data)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("shares target dataset" in e for e in errors)


def test_global_config_dataset_uniqueness_product():
    """Test that GlobalConfig raises ValueError for duplicate datasets
    in product modules of the same type.
    """
    data = {
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [{"name": "cortex", "path": "../src/data_modules/cortex"}],
            "datasets": [
                {"id": "sap_raw", "projectId": "p", "datasetId": "raw"},
                {"id": "tgt1", "projectId": "p", "datasetId": "d"},
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "moduleType": "sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "tgt1",
                        "moduleSettings": {"sapVersion": "ecc", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "prod1",
                        "modulePath": "cortex.sap.products.sales_documents",
                        "moduleType": "sap",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "tgt1",
                    },
                    {
                        "moduleId": "prod2",
                        "modulePath": "cortex.sap.products.sales_documents",
                        "moduleType": "sap",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "tgt1",
                    },
                ],
            },
        }
    }
    config = GlobalConfig.model_validate(data)
    errors = ConfigValidator.validate_business_rules(config, None, pathlib.Path.cwd())
    assert any("shares target dataset" in e for e in errors)


class ModuleMeta(TypedDict):
    category: str
    manifest: ManifestConfig


def test_config_modules_referential_integrity(repo_root: pathlib.Path):
    """
    Verifies that all modules in standard config files have valid types
    (found in workspace manifests) and that their dependencies resolve correctly.
    Fails if a manifest is missing the 'type' field.
    """
    # 1. Discover valid modules from manifests using InternalModuleProvider
    master_namespaces = [
        NamespaceConfig(name="cortex", path="../src/data_modules/cortex"),
        NamespaceConfig(name="cortex_samples", path="../src/data_modules/cortex_samples"),
        NamespaceConfig(
            name="cortex_v6_compatibility", path="../src/data_modules/cortex_v6_compatibility"
        ),
    ]
    master_module_provider = InternalModuleProvider(master_namespaces, repo_root / "config")
    master_module_provider.discover_modules()

    valid_modules: dict[str, ModuleMeta] = {}
    for mod_type in master_module_provider.get_module_types():
        manifest = master_module_provider.get_manifest(mod_type)
        mod_dir = master_module_provider.get_module_dir(mod_type)
        if not manifest or not manifest.type:
            pytest.fail(f"Manifest missing 'type' field for module '{mod_type}'")
        category = (
            "data_foundation"
            if (mod_dir and ("foundations" in mod_dir.parts or "data_foundation" in mod_dir.parts))
            else "data_product"
        )
        valid_modules[mod_type] = {"category": category, "manifest": manifest}

    # 2. Validate standard configuration files
    config_files = [
        repo_root / "config" / "config.yaml.example",
    ] + list(repo_root.glob("tests/**/config*.yaml"))

    referential_errors = []

    for config_path in config_files:
        if not config_path.exists():
            continue
        with open(config_path) as f:
            config_data = yaml.safe_load(f) or {}

        try:
            unified_provider = UnifiedModuleProvider(
                master_module_provider, ExternalModuleProvider([])
            )
            raw_modules = config_data.get("data", {}).get("modules", {})
            for group in ("foundation", "foundations", "product", "products"):
                for mod in raw_modules.get(group, []):
                    if isinstance(mod, dict) and "modulePath" in mod and "moduleType" not in mod:
                        discovered_manifest = unified_provider.get_manifest(mod["modulePath"])
                        if discovered_manifest and discovered_manifest.type:
                            mod["moduleType"] = discovered_manifest.type

            config = GlobalConfig.model_validate(
                config_data,
                context={
                    "config_dir": config_path.parent,
                    "module_provider": unified_provider,
                },
            )
        except Exception as e:
            rel_path = config_path.relative_to(repo_root)
            referential_errors.append(f"Config '{rel_path}' failed schema validation: {e}")
            continue

        foundation_lookup: dict[str, Any] = {
            mod.module_id: mod for mod in config.data.modules.foundation
        }
        foundation_lookup.update({mod.module_id: mod for mod in config.data.modules.product})
        mock_client = Mock(spec=BigLakeDeltaSharingClient)

        def list_schemas_side_effect(project, location, catalog, share):
            schema_name = share.split("_v1")[0] if "_v1" in share else share
            return [{"name": schema_name}]

        mock_client.list_schemas.side_effect = list_schemas_side_effect
        mock_client.list_tables.return_value = [{"name": "table1"}]
        ext_provider = ExternalModuleProvider(config.data.modules.catalogs, client=mock_client)
        for meta in ext_provider.fetch_all_metadata():
            cat_key_3part = f"{meta.internal_catalog_id}.{meta.share_name}.{meta.schema_name}"
            cat_key_2part = f"{meta.internal_catalog_id}.{meta.schema_name}"
            mock_fnd = Mock(
                module_name=meta.schema_name,
                module_path=f"sap_bdc.{meta.schema_name}",
                namespaced_type=f"sap_bdc.{meta.schema_name}",
            )
            foundation_lookup[cat_key_3part] = mock_fnd
            foundation_lookup[cat_key_2part] = mock_fnd

        for prod_mod in config.data.modules.product:
            full_type = prod_mod.namespaced_type
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
            for dep_key, foundation_id in prod_mod.dependency_bindings.items():
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

                expected_type = manifest_config.dependencies[dep_key].module_path
                f_mod = foundation_lookup[foundation_id]
                # Compare using module_type, namespaced_type or base module_path
                if (
                    f_mod.module_name != expected_type
                    and f_mod.module_path != expected_type
                    and f_mod.namespaced_type != expected_type
                    and not expected_type.endswith(f_mod.module_name)
                ):
                    referential_errors.append(
                        f"Config '{rel_path}' module '{prod_mod.module_id}' depends on "
                        f"foundation '{foundation_id}' which is module_name '{f_mod.module_name}' "
                        f"(expected '{expected_type}')."
                    )

    if referential_errors:
        error_msg = "\n".join(
            ["Referential integrity errors found in configs:"] + referential_errors
        )
        pytest.fail(error_msg)


def test_dataform_target_settings_optional_service_account():
    """Test that DataformTargetSettings allows service_account to be missing or empty."""

    # Succeeds when missing
    settings = DataformTargetSettings.model_validate(
        {
            "repositoryProjectId": "p",
            "repositoryRegion": "r",
            "repositoryName": "n",
            "workspaceName": "w",
        }
    )
    assert settings.service_account is None

    # Succeeds when empty string
    settings_empty = DataformTargetSettings.model_validate(
        {
            "repositoryProjectId": "p",
            "repositoryRegion": "r",
            "repositoryName": "n",
            "workspaceName": "w",
            "serviceAccount": "",
        }
    )
    assert settings_empty.service_account is None

    # Succeeds when present
    settings_present = DataformTargetSettings.model_validate(
        {
            "repositoryProjectId": "p",
            "repositoryRegion": "r",
            "repositoryName": "n",
            "workspaceName": "w",
            "serviceAccount": "foo@bar.iam.gserviceaccount.com",
        }
    )
    assert settings_present.service_account == "foo@bar.iam.gserviceaccount.com"


def test_all_cortex_modules_are_configured(repo_root: pathlib.Path):
    """
    Verifies that all modules discovered in the 'cortex' namespace are included
    in config/config.yaml.example and tests/config.unittest.yaml.
    """
    config_files = [
        repo_root / "config" / "config.yaml.example",
        repo_root / "tests" / "config.unittest.yaml",
    ]

    missing_errors = []

    for config_path in config_files:
        if not config_path.exists():
            continue

        with open(config_path) as f:
            config_data = yaml.safe_load(f) or {}

        try:
            namespaces_data = config_data.get("data", {}).get("namespaces", [])
            if not namespaces_data:
                master_namespaces = [
                    NamespaceConfig(name="cortex", path="../src/data_modules/cortex")
                ]
            else:
                target_ns = {"cortex", "cortex_v6_compatibility"}
                master_namespaces = [
                    NamespaceConfig(**ns) for ns in namespaces_data if ns.get("name") in target_ns
                ]

            master_module_provider = InternalModuleProvider(master_namespaces, repo_root / "config")
            master_module_provider.discover_modules()
            unified_provider = UnifiedModuleProvider(
                master_module_provider, ExternalModuleProvider([])
            )

            raw_modules = config_data.get("data", {}).get("modules", {})
            for group in ("foundation", "foundations", "product", "products"):
                for mod in raw_modules.get(group, []):
                    if isinstance(mod, dict) and "modulePath" in mod and "moduleType" not in mod:
                        discovered_manifest = unified_provider.get_manifest(mod["modulePath"])
                        if discovered_manifest and discovered_manifest.type:
                            mod["moduleType"] = discovered_manifest.type

            config = GlobalConfig.model_validate(
                config_data,
                context={
                    "config_dir": config_path.parent,
                    "module_provider": unified_provider,
                },
            )
        except Exception as e:
            missing_errors.append(
                f"Config '{config_path.relative_to(repo_root)}' failed validation: {e}"
            )
            continue

        valid_module_types = {}
        for mod_type in master_module_provider.get_module_types():
            manifest = master_module_provider.get_manifest(mod_type)
            module_dir = master_module_provider.get_module_dir(mod_type)

            if manifest.type and manifest.type != module_dir.name:
                # Check architectural rule: manifest type MUST be the last segment
                pytest.fail(
                    f"Manifest type '{manifest.type}' in module '{mod_type}' "
                    f"does not match the last segment of its module path '{module_dir.name}'."
                )

            supported_versions = []
            if manifest.dependencies:
                sap_dep = manifest.dependencies.get("sapModule")
                if isinstance(sap_dep, SapDependencyInfo):
                    supported_versions = [v.value for v in sap_dep.supported_versions]
            valid_module_types[mod_type] = supported_versions

        configured_types = set()
        for f_mod in config.data.modules.foundation:
            configured_types.add(f_mod.namespaced_type)

        for p_mod in config.data.modules.product:
            configured_types.add(p_mod.namespaced_type)

        expected_types = set()

        # Determine if we should enforce everything (e.g., example config or
        # exhaustive unittest config). If the config explicitly defines both
        # or it's meant to be exhaustive. But generally, we only expect
        # modules supported by the configured foundation.
        config_dump = config.model_dump()
        foundation_modules = config_dump.get("data", {}).get("modules", {}).get("foundation", [])
        has_ecc = any(
            f.get("moduleSettings", {}).get("sapVersion") == "ecc" for f in foundation_modules
        )
        has_s4 = any(
            f.get("moduleSettings", {}).get("sapVersion") == "s4" for f in foundation_modules
        )

        # Some configs might not have an SAP foundation at all (e.g. SFDC only).
        has_sap = has_ecc or has_s4

        for mod_type, supported_versions in valid_module_types.items():
            if not supported_versions:
                # No specific SAP version requirements (or not an SAP module)
                expected_types.add(mod_type)
            elif not has_sap:
                # If no SAP foundation is configured at all, we don't expect SAP products
                # (unless they are foundation themselves).
                if mod_type == "cortex.sap.foundations.sap":
                    expected_types.add(mod_type)
                pass
            else:
                # Configured for SAP, check if the module supports the configured version
                if has_s4 and "s4" in supported_versions or has_ecc and "ecc" in supported_versions:
                    expected_types.add(mod_type)
                elif config_path.name == "config.yaml.example":
                    # For the example config, we want developers to see all modules
                    # even if they are commented out or disabled in the template.
                    expected_types.add(mod_type)

        missing_types = expected_types - configured_types
        if missing_types:
            missing_errors.append(
                f"Config '{config_path.relative_to(repo_root)}' is missing the following modules: "
                f"{', '.join(sorted(missing_types))}"
            )

    if missing_errors:
        pytest.fail("\n".join(missing_errors))
