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


def get_manifests_in_dir(directory: pathlib.Path) -> dict[str, Any]:
    """Finds all manifest files and their module info within a directory."""
    manifests: dict[str, Any] = {}
    if not directory.exists():
        return manifests

    for module_dir in directory.iterdir():
        if not module_dir.is_dir():
            continue

        manifest_path = module_dir / "manifest.yaml"
        if manifest_path.exists():
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
    Validates that every dependency type declared in a data_product manifest
    exists as a valid module type in data_foundation.
    """
    src_dir = repo_root / "src" / "data_modules" / "cortex"

    foundation_dir = src_dir / "data_foundation"
    product_dir = src_dir / "data_product"

    foundation_manifests = get_manifests_in_dir(foundation_dir)
    product_manifests = get_manifests_in_dir(product_dir)

    # Extract the set of all valid foundation types
    valid_foundation_types = {info["type"] for info in foundation_manifests.values()}

    errors = []

    for product_name, p_info in product_manifests.items():
        manifest_config: ManifestConfig = p_info["config"]
        path: pathlib.Path = p_info["path"]

        for _dep_name, dep_info in manifest_config.dependencies.items():
            declared_type = dep_info.type
            if declared_type not in valid_foundation_types:
                errors.append(
                    f"Invalid dependency type '{declared_type}' declared in "
                    f"product '{product_name}' ({path}). "
                    f"Valid types are: {', '.join(sorted(valid_foundation_types))}."
                )
    if errors:
        error_msg = "\n".join(["Referential integrity errors found in manifests:"] + errors)
        pytest.fail(error_msg)
