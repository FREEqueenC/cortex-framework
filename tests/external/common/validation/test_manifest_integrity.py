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

import pytest
import yaml

from common.schemas.manifest_schema import ManifestConfig


def get_all_manifests(src_dir: pathlib.Path) -> dict[str, Any]:
    """Finds all manifest files and their module info within data_modules."""
    manifests: dict[str, Any] = {}
    if not src_dir.exists():
        return manifests

    for manifest_path in src_dir.rglob("manifest.yaml"):
        module_dir = manifest_path.parent
        with open(manifest_path) as f:
            manifest_data = yaml.safe_load(f) or {}

        manifest_config = ManifestConfig(**manifest_data)
        # Match the resolution logic in build.py:
        # If type is defined in manifest, use it. Otherwise fallback to the directory name.
        manifest_type = manifest_config.type or module_dir.name
        manifests[module_dir.name] = {
            "type": manifest_type,
            "config": manifest_config,
            "path": manifest_path,
        }
    return manifests


def test_manifest_referential_integrity(repo_root: pathlib.Path):
    """
    Validates that every dependency type declared in any manifest
    exists as a valid module type across data_modules.
    """
    src_dir = repo_root / "src" / "data_modules"
    all_manifests = get_all_manifests(src_dir)
    valid_types = {info["type"] for info in all_manifests.values()}
    for dir_name, info in all_manifests.items():
        valid_types.add(dir_name)
        try:
            rel_parts = info["path"].parent.relative_to(src_dir).parts
            valid_types.add(".".join(rel_parts))
        except ValueError:
            pass

    # Discover external catalog namespaces (e.g. sap_bdc)
    valid_types.add("sap_bdc")
    for config_file in repo_root.rglob("config*.yaml"):
        try:
            with open(config_file) as f:
                cfg_data = yaml.safe_load(f) or {}
            catalogs = cfg_data.get("data", {}).get("modules", {}).get("catalogs", [])
            for cat in catalogs:
                if isinstance(cat, dict):
                    for ns in cat.get("bindsNamespaces", []):
                        valid_types.add(ns)
        except Exception:
            pass

    errors = []

    for module_name, m_info in all_manifests.items():
        manifest_config: ManifestConfig = m_info["config"]
        path: pathlib.Path = m_info["path"]

        for _dep_name, dep_info in manifest_config.dependencies.items():
            declared_type = dep_info.module_path
            base_type = declared_type.rsplit(".", 1)[-1]
            ns_prefix = declared_type.split(".", 1)[0] if "." in declared_type else ""
            if (
                declared_type not in valid_types
                and base_type not in valid_types
                and ns_prefix not in valid_types
            ):
                errors.append(
                    f"Invalid dependency type '{declared_type}' declared in "
                    f"product '{module_name}' ({path}). "
                    f"Valid types are: {', '.join(sorted(valid_types))}."
                )
    if errors:
        error_msg = "\n".join(["Referential integrity errors found in manifests:"] + errors)
        pytest.fail(error_msg)
