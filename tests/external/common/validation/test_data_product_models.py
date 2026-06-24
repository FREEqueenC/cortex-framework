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

"""
test_data_product_models.py

This module contains unit tests to validate the naming conventions and structure
of data product models within the Cortex Framework V7. It ensures that fields
defined in Dataform JavaScript definitions and their corresponding YAML annotations
adhere to strict SAP-oriented naming conventions (e.g., PascalCase_UPPERCASE)
and that there is consistency between the explicit fields generated in JS
and the documentation provided in YAML.
"""

import pathlib
import re

import pytest
import yaml


def extract_explicit_aliases_from_js(js_content: str) -> set[str]:
    """
    Extracts explicit field aliases defined in the main SELECT block of a Dataform JS file.

    Dataform definitions often use `SELECT * EXCEPT(...)` along with explicitly declared
    fields and aliases (e.g., `AS FieldName`). This function uses regular expressions to
    parse out these explicit `AS` aliases, rather than attempting to securely parse
    the full JavaScript AST or execute the Dataform compilation step.

    Args:
        js_content (str): The raw string content of the Dataform .js file.

    Returns:
        set[str]: A set containing all explicit field names declared with an `AS` alias.
    """
    # Isolate the main SELECT block. We assume the main SELECT is the last one in the file.
    matches = re.findall(r"\bSELECT\b(.*?)\bFROM\b", js_content, re.IGNORECASE | re.DOTALL)
    if not matches:
        return set()

    select_block = matches[-1]
    fields = set()

    select_block = re.sub(r"##.*", "", select_block)
    select_block = re.sub(r"--.*", "", select_block)

    # Extract all identifiers immediately following an 'as' keyword.
    # The negative lookahead (?!\s*\)) ensures we don't capture types from CAST(... AS TYPE).
    aliases = re.findall(r"\bas\s+([A-Za-z0-9_]+)\b(?!\s*\))", select_block, re.IGNORECASE)
    fields.update(aliases)

    return fields


def validate_naming_convention(field_name: str) -> bool:
    """
    Validates whether a given field name adheres to the Cortex 7 naming conventions.

    Expected conventions include:
    - snake_case (e.g., `delivery_schedule_line_counter_etenr`)
    """
    technical_fields = {"recordstamp", "source_last_updated_at", "bq_loaded_at"}
    if field_name in technical_fields:
        return True

    # Expect snake_case (lowercase letters, numbers, and underscores).
    return bool(re.match(r"^[a-z0-9_]+$", field_name))


def test_data_product_models(repo_root: pathlib.Path):
    """
    Validates data product annotations and definitions for naming convention
    compliance and ensures consistency between fields explicitly declared in JS
    and those documented in YAML annotations.
    """
    src_dir = repo_root / "src" / "data_modules" / "cortex" / "data_product"

    if not src_dir.exists():
        pytest.skip("No data_product directory found.")

    errors = []

    # These technical fields are often auto-generated or injected by framework templates,
    # so we do not strictly enforce their presence in the YAML annotations.
    exempt_missing_yaml_fields = {"recordstamp", "source_last_updated_at", "bq_loaded_at"}

    # Iterate through each data product directory.
    for product_dir in src_dir.iterdir():
        if not product_dir.is_dir():
            continue

        annotations_dir = product_dir / "annotations"
        definitions_dir = product_dir / "definitions"

        # Skip directories that lack both annotations and definitions.
        if not annotations_dir.exists() and not definitions_dir.exists():
            continue

        js_files = list(definitions_dir.rglob("*.js")) if definitions_dir.exists() else []
        yaml_files = list(annotations_dir.rglob("*.yaml")) if annotations_dir.exists() else []

        yaml_to_js_map: dict[pathlib.Path, list[pathlib.Path]] = {}
        # Pre-populate map with all existing YAML files
        for yaml_path in yaml_files:
            yaml_to_js_map[yaml_path] = []

        # Map each JS definition to its expected YAML annotation
        for js_path in js_files:
            rel_js_path = js_path.relative_to(definitions_dir)
            table_name = js_path.stem

            exact_yaml_path = annotations_dir / rel_js_path.with_suffix(".yaml")
            root_yaml_path = annotations_dir / f"{table_name}.yaml"

            matched_yaml_path: pathlib.Path | None = None
            if exact_yaml_path.exists():
                matched_yaml_path = exact_yaml_path
            elif root_yaml_path.exists():
                matched_yaml_path = root_yaml_path

            if not matched_yaml_path:
                errors.append(
                    f"[{product_dir.name}/{rel_js_path}] "
                    "Missing YAML annotation file for JS definition."
                )
                continue

            if matched_yaml_path not in yaml_to_js_map:
                yaml_to_js_map[matched_yaml_path] = []
            yaml_to_js_map[matched_yaml_path].append(js_path)

        # Check each YAML file and its mapped JS definitions
        for yaml_path, mapped_js_files in yaml_to_js_map.items():
            if not mapped_js_files:
                errors.append(
                    f"[{product_dir.name}/{yaml_path.relative_to(annotations_dir)}] "
                    "Missing JS definition for YAML annotation."
                )
                continue

            yaml_fields = set()
            try:
                with open(yaml_path) as f:
                    data = yaml.safe_load(f)
                    if data and data.get("fields"):
                        for field in data["fields"]:
                            field_name = field["name"]
                            yaml_fields.add(field_name)

                            if not validate_naming_convention(field_name):
                                errors.append(
                                    f"[{product_dir.name}/"
                                    f"{yaml_path.relative_to(annotations_dir)}] "
                                    f"Invalid naming convention: '{field_name}'. "
                                    "Must be snake_case."
                                )
            except Exception as e:
                errors.append(f"Failed to parse {yaml_path.relative_to(repo_root)}: {e}")

            all_js_explicit_aliases = set()
            all_js_identifiers = set()

            for js_path in mapped_js_files:
                try:
                    js_content = js_path.read_text()
                    js_explicit_aliases = extract_explicit_aliases_from_js(js_content)
                    all_js_explicit_aliases.update(js_explicit_aliases)

                    select_matches = re.findall(
                        r"\bSELECT\b(.*?)\bFROM\b", js_content, re.IGNORECASE | re.DOTALL
                    )
                    if select_matches:
                        select_block = select_matches[-1]
                        select_block = re.sub(r"##.*", "", select_block)
                        select_block = re.sub(r"--.*", "", select_block)
                        identifiers = re.findall(r"\b[A-Za-z0-9_]+\b", select_block)
                        all_js_identifiers.update(identifiers)

                    for field_name in js_explicit_aliases:
                        is_valid = validate_naming_convention(field_name)
                        if field_name not in exempt_missing_yaml_fields and not is_valid:
                            errors.append(
                                f"[{product_dir.name}/{js_path.relative_to(definitions_dir)}] "
                                f"Invalid naming convention for JS alias: '{field_name}'"
                            )

                    js_to_verify = js_explicit_aliases - exempt_missing_yaml_fields
                    yaml_fields_cleaned = yaml_fields - exempt_missing_yaml_fields

                    missing_in_yaml = js_to_verify - yaml_fields_cleaned
                    if missing_in_yaml:
                        missing_str = ", ".join(sorted(missing_in_yaml))
                        rel_js_path = js_path.relative_to(definitions_dir)
                        errors.append(
                            f"[{product_dir.name}/{rel_js_path}] Fields explicitly "
                            f"defined in JS but MISSING in YAML: {missing_str}"
                        )

                except Exception as e:
                    errors.append(f"Failed to process {js_path.relative_to(repo_root)}: {e}")

            yaml_fields_cleaned = yaml_fields - exempt_missing_yaml_fields
            all_js_to_verify = all_js_identifiers - exempt_missing_yaml_fields
            missing_in_all_js = yaml_fields_cleaned - all_js_to_verify
            if missing_in_all_js:
                missing_str = ", ".join(sorted(missing_in_all_js))
                errors.append(
                    f"[{product_dir.name}/{yaml_path.relative_to(annotations_dir)}] "
                    "Fields documented in "
                    f"YAML but MISSING in all JS definitions: {missing_str}"
                )

    # Fail the test if any violations were collected.
    if errors:
        error_msg = "\n".join(["Data Product Model violations found:"] + errors)
        pytest.fail(error_msg)
