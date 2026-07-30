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

import pytest
import yaml


def test_annotations_have_descriptions(repo_root: pathlib.Path):
    """
    Validates that all annotation YAML files in data_foundation and data_product
    have descriptions at both the top level and for each field.
    """
    data_modules_dir = repo_root / "src" / "data_modules"
    target_dirs = [d for d in data_modules_dir.iterdir() if d.is_dir()]

    missing_descriptions = []

    for target in target_dirs:
        if not target.exists():
            continue

        # Find all YAML files that are inside an 'annotations' directory (or subdirectory of it)
        for yaml_file in target.rglob("*.yaml"):
            if "annotations" in yaml_file.parts:
                try:
                    with open(yaml_file, encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                except Exception as e:
                    missing_descriptions.append(
                        f"Failed to parse {yaml_file.relative_to(repo_root)}: {e}"
                    )
                    continue

                if not isinstance(data, dict):
                    continue

                # Check top-level description
                if "description" not in data or not data["description"]:
                    missing_descriptions.append(
                        f"{yaml_file.relative_to(repo_root)}: Top-level description is missing."
                    )

                # Check fields
                fields = data.get("fields", [])
                if isinstance(fields, list):
                    for field in fields:
                        if not isinstance(field, dict):
                            continue
                        if "description" not in field or not field["description"]:
                            name = field.get("name", "UNKNOWN_FIELD")
                            missing_descriptions.append(
                                f"{yaml_file.relative_to(repo_root)}: Field '{name}' "
                                f"is missing a description."
                            )

    if missing_descriptions:
        error_msg = "\n".join(
            ["The following annotations are missing descriptions:"] + missing_descriptions
        )
        pytest.fail(error_msg)
