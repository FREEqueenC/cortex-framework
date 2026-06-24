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

"""Configuration validation service.

Performs deep validation of global config file content to detect common errors
and provide helpful, developer-friendly feedback.
"""

import pathlib
import types
from typing import Annotated, Any, Union, get_args, get_origin

import pydantic
import yaml

from common.schemas.config_schema import GlobalConfig
from common.services.config_preprocessor import ConfigPreprocessor

# When validating lists containing different types of modules (e.g., sap, generic, dataform),
# the validation engine automatically inserts the module subtype tag into the error path.
# We filter these tags out so that error messages match the developer's actual YAML structure.
_MODULE_SUBTYPE_TAGS = {"generic", "sap", "dataform", "dashboard", "purchasing", "roi"}


# Formats a validation error path tuple into a human-readable YAML configuration path.
# Example: ("data", "sources", 0) -> "data -> sources[0]"
def format_parent_path(error_path: tuple) -> str:
    if not error_path:
        return "root"
    parts: list[str] = []
    for x in error_path:
        if isinstance(x, int):
            # Integers represent list indices. Instead of creating a new path step,
            # attach index directly to preceding element (e.g., 'sources' -> 'sources[0]').
            if parts:
                parts[-1] = f"{parts[-1]}[{x}]"
        elif x in _MODULE_SUBTYPE_TAGS and parts and parts[-1].endswith("]"):
            # Skip internal module subtype tags that follow list indices (e.g.,
            # 'foundation[1] -> generic') to align with the user's YAML structure.
            continue
        else:
            # Regular field names are appended as separate steps in the path hierarchy.
            parts.append(str(x))
    return " -> ".join(parts)


# Unwraps type annotations (Annotated, Union, list, dict) to discover Pydantic model classes.
def _extract_models(annotation: Any) -> list[type[pydantic.BaseModel]]:
    if annotation is None:
        return []
    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is Annotated:
        return _extract_models(args[0])

    if origin in (Union, types.UnionType):
        models = []
        for arg in args:
            models.extend(_extract_models(arg))
        return models

    if origin is list:
        return _extract_models(args[0])

    if origin is dict:
        return _extract_models(args[1]) if len(args) > 1 else []

    if isinstance(annotation, type) and issubclass(annotation, pydantic.BaseModel):
        return [annotation]

    return []


# Traverses the Pydantic schema hierarchy along an error path to locate target model classes.
def find_models_for_error_path(
    model_class: type[pydantic.BaseModel], error_path: tuple
) -> list[type[pydantic.BaseModel]]:
    current_models = [model_class]
    for part in error_path:
        # List indices and module subtype tags do not represent model attribute names,
        # so skip them during traversal.
        if isinstance(part, int) or part in _MODULE_SUBTYPE_TAGS:
            continue
        next_models = []
        for m in current_models:
            for field_name, field_info in m.model_fields.items():
                # Match against field's explicit alias (camelCase) or attribute name (snake_case)
                if (field_info.alias or field_name) == part or field_name == part:
                    next_models.extend(_extract_models(field_info.annotation))
        current_models = next_models
        if not current_models:
            break
    return current_models


# Recursively constructs a global mapping of field aliases to their expected parent path.
# This map is used during validation to detect misplaced fields and suggest correct indentation.
def build_known_keys_map(
    model_class: type[pydantic.BaseModel],
    path: list[str] | None = None,
    result_map: dict[str, set[str]] | None = None,
) -> dict[str, str]:
    if path is None:
        path = []
    if result_map is None:
        result_map = {}

    parent_str = " -> ".join(path) or "root"
    for field_name, field_info in model_class.model_fields.items():
        alias = field_info.alias or field_name
        result_map.setdefault(alias, set()).add(parent_str)

        sub_models = _extract_models(field_info.annotation)
        for sub_model in sub_models:
            build_known_keys_map(sub_model, path + [alias], result_map)

    return {k: " OR ".join(sorted(v)) for k, v in result_map.items()}


_KNOWN_KEYS_PARENT_MAP = build_known_keys_map(GlobalConfig)


# Converts a snake_case string to camelCase.
def snake_to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class ConfigValidator:
    """Validation service for config.yaml."""

    @staticmethod
    def validate(config_filepath: pathlib.Path) -> tuple[bool, list[str]]:
        """Validates the configuration file.

        Returns:
            Tuple[bool, List[str]]: A tuple of (is_valid, list_of_error_messages).
        """
        errors: list[str] = []

        # 1. Load raw YAML and handle syntax errors
        try:
            with open(config_filepath, encoding="utf-8") as f:
                raw_dict = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return False, [
                f"YAML syntax error in '{config_filepath}': {e}\n"
                "Please check that the file format is valid YAML."
            ]
        except FileNotFoundError:
            return False, [f"Config file not found at '{config_filepath}'."]
        except Exception as e:
            return False, [f"Unexpected error loading config file: {e}"]

        if not raw_dict:
            return False, ["Config file is empty."]

        if not isinstance(raw_dict, dict):
            return False, ["Config file must contain a YAML dictionary."]

        # 2. Preprocess variables before schema validation
        try:
            processed_dict = ConfigPreprocessor().process(raw_dict)
        except Exception as e:
            errors.append(f"Failed to preprocess configuration: {e}")
            return False, errors

        # 3. Pydantic schema constraints and custom model validation
        try:
            repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
            ctx = {
                "external_validation": True,
                "config_dir": config_filepath.parent,
                "repo_root": repo_root,
            }
            GlobalConfig.model_validate(processed_dict, context=ctx)
        except pydantic.ValidationError as e:
            for error in e.errors():
                error_path = error["loc"]
                raw_msg = error["msg"]
                msg = (
                    raw_msg[len("Value error, ") :]
                    if raw_msg.startswith("Value error, ")
                    else raw_msg
                )
                error_type = error["type"]

                # If there are multiple errors joined by newline, split them and process each
                sub_msgs = msg.split("\n")
                for sub_msg in sub_msgs:
                    if error_type == "missing":
                        field_name_str = str(error_path[-1])
                        parent_path = format_parent_path(error_path[:-1])
                        errors.append(
                            f"Missing required field '{field_name_str}' under '{parent_path}'."
                        )
                    elif error_type == "extra_forbidden":
                        key = str(error_path[-1])
                        parent_path = format_parent_path(error_path[:-1])

                        # Inspect for casing error
                        parent_models = find_models_for_error_path(GlobalConfig, error_path[:-1])
                        casing_alias = None
                        for m in parent_models:
                            for f_name, f_info in m.model_fields.items():
                                alias = f_info.alias or f_name
                                if f_name == key and alias != key:
                                    casing_alias = alias
                                    break
                            if casing_alias:
                                break

                        if casing_alias:
                            errors.append(
                                f"Invalid key casing: '{key}' under '{parent_path}'. "
                                f"Please use camelCase format: '{casing_alias}'."
                            )
                        else:
                            # Inspect for indentation error
                            camel_key = snake_to_camel(key)
                            suggested_parent = _KNOWN_KEYS_PARENT_MAP.get(key) or (
                                _KNOWN_KEYS_PARENT_MAP.get(camel_key)
                            )
                            if suggested_parent:
                                errors.append(
                                    f"Unexpected field '{key}' under '{parent_path}'. "
                                    "This field is likely incorrectly indented. "
                                    f"Did you mean to place it under '{suggested_parent}'?"
                                )
                            else:
                                errors.append(
                                    f"Unknown or unexpected field '{key}' "
                                    f"found under '{parent_path}'."
                                )
                    else:
                        if len(sub_msgs) > 1:
                            errors.append(sub_msg)
                        else:
                            loc_path = " -> ".join(str(x) for x in error_path)
                            inp = error.get("input")
                            errors.append(
                                f"Schema validation failed at '{loc_path}': "
                                f"{sub_msg}. Provided value: {inp}."
                            )

        return len(errors) == 0, errors
