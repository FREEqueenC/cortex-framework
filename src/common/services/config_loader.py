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

"""Configuration loader and schema validation service.

Responsible for orchestrating the configuration loading pipeline:
1. Loads YAML from disk.
2. Applies preprocessing and variable substitution.
3. Initializes module discovery providers.
4. Performs Pydantic schema validation.
5. Invokes business rule validation.
"""

import pathlib
import types
from typing import Annotated, Any, Union, get_args, get_origin

import pydantic
import yaml

from common.schemas.config_schema import CatalogConfig, GlobalConfig, NamespaceConfig
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.config_validator import ConfigValidator
from common.services.external_module_provider import ExternalModuleProvider
from common.services.internal_module_provider import InternalModuleProvider
from common.services.unified_module_provider import UnifiedModuleProvider

# When validating lists containing different types of modules (e.g., sap, generic, dataform),
# the validation engine automatically inserts the module subtype tag into the error path.
# We filter these tags out so that error messages match the developer's actual YAML structure.
_MODULE_SUBTYPE_TAGS = {"generic", "sap", "dataform", "dashboard", "purchasing", "roi"}


def format_parent_path(error_path: tuple) -> str:
    """Formats a validation error path tuple into a human-readable YAML configuration path.

    Error path is a tuple of strings and integers representing the path to the error.
    This function converts it into a human-readable YAML configuration path.

    Example:
        ("data", "sources", 0) -> "data -> sources[0]"

    Args:
        error_path: Tuple of strings and integers representing the path to the error.

    Returns:
        Human-readable YAML configuration path.
    """
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


def _extract_models(annotation: Any) -> list[type[pydantic.BaseModel]]:
    """Unwraps annotations (Annotated, Union, list, dict) to discover Pydantic models.

    Args:
        annotation: Type annotation to unwrap.

    Returns:
        List of Pydantic model classes.
    """
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


def find_models_for_error_path(
    model_class: type[pydantic.BaseModel], error_path: tuple
) -> list[type[pydantic.BaseModel]]:
    """Traverses the Pydantic schema along an error path to locate target model classes.

    Args:
        model_class: Root Pydantic model class to traverse.
        error_path: Tuple of strings and integers representing the path to the error.

    Returns:
        List of Pydantic model classes at the error path.
    """
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


def build_known_keys_map(
    model_class: type[pydantic.BaseModel],
    path: list[str] | None = None,
    result_map: dict[str, set[str]] | None = None,
) -> dict[str, str]:
    """Recursively constructs a global mapping of field aliases to their expected parent path.

    This map is used during validation to detect misplaced fields and suggest correct indentation.

    Args:
        model_class: Root Pydantic model class to inspect.
        path: Current path hierarchy during recursion.
        result_map: Accumulator dictionary mapping field names to valid parent paths.

    Returns:
        Dictionary mapping field aliases to formatted parent path strings.
    """
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


def snake_to_camel(name: str) -> str:
    """Converts a snake_case string to camelCase.

    Args:
        name: Snake_case string to convert.

    Returns:
        CamelCase formatted string.
    """
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class ConfigLoader:
    """Configuration loader orchestrator."""

    @classmethod
    def load_and_validate(
        cls,
        config_filepath: pathlib.Path,
        module_provider: UnifiedModuleProvider | None = None,
    ) -> tuple[GlobalConfig | None, list[str]]:
        """Loads, parses, and validates the configuration file.

        Args:
            config_filepath: Path to the config.yaml file.
            module_provider: Optional pre-initialized module provider.

        Returns:
            Tuple[GlobalConfig | None, List[str]]: A tuple of
                (parsed_config_or_none, list_of_error_messages).
        """
        # 1. Load raw YAML and handle syntax errors
        try:
            with open(config_filepath, encoding="utf-8") as f:
                raw_dict = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return None, [
                f"YAML syntax error in '{config_filepath}': {e}\n"
                "Please check that the file format is valid YAML."
            ]
        except FileNotFoundError:
            return None, [f"Config file not found at '{config_filepath}'."]
        except Exception as e:
            return None, [f"Unexpected error loading config file: {e}"]

        return cls.load_and_validate_dict(raw_dict, config_filepath.parent, module_provider)

    @classmethod
    def load_and_validate_dict(
        cls,
        raw_dict: dict[str, Any] | None,
        config_dir: pathlib.Path | None = None,
        module_provider: UnifiedModuleProvider | None = None,
    ) -> tuple[GlobalConfig | None, list[str]]:
        """Parses and validates a raw configuration dictionary.

        Args:
            raw_dict: The raw configuration dictionary to validate.
            config_dir: Optional base directory for resolving relative paths (defaults to cwd).
            module_provider: Optional pre-initialized module provider.

        Returns:
            Tuple[GlobalConfig | None, List[str]]: A tuple of
                (parsed_config_or_none, list_of_error_messages).
        """
        errors: list[str] = []
        if config_dir is None:
            config_dir = pathlib.Path.cwd()

        if not raw_dict:
            return None, ["Config dictionary is empty."]

        if not isinstance(raw_dict, dict):
            return None, ["Config must be a dictionary."]

        # 2. Preprocess variables before schema validation
        try:
            processed_dict = ConfigPreprocessor().process(raw_dict)
        except Exception as e:
            errors.append(f"Failed to preprocess configuration: {e}")
            return None, errors

        # 3. Pydantic schema constraints and custom model validation
        global_config = None
        unified_provider = None
        try:
            data_dict = processed_dict.get("data", {})

            # Step 1: Pre-parse namespaces to build the internal module provider (Two-pass)
            raw_namespaces = data_dict.get("namespaces", [])

            namespaces = [NamespaceConfig.model_validate(ns) for ns in raw_namespaces]

            if module_provider is not None:
                unified_provider = module_provider
            else:
                internal_provider = InternalModuleProvider(
                    namespaces,
                    config_dir,
                )
                internal_provider.discover_modules()
                raw_catalogs = data_dict.get("modules", {}).get("catalogs", [])

                catalogs = [CatalogConfig.model_validate(c) for c in raw_catalogs]
                ext_provider = ExternalModuleProvider(catalogs)
                unified_provider = UnifiedModuleProvider(
                    internal_provider=internal_provider,
                    external_provider=ext_provider,
                )

            src_dir = pathlib.Path(__file__).resolve().parent.parent.parent
            ctx = {
                "config_dir": config_dir,
                "data_modules_dir": src_dir / "data_modules",
                "module_provider": unified_provider,
            }

            if unified_provider:
                raw_modules = data_dict.get("modules", {})
                for group in ("foundation", "foundations", "product", "products"):
                    group_list = raw_modules.get(group)
                    if isinstance(group_list, list):
                        for mod in group_list:
                            if (
                                isinstance(mod, dict)
                                and "modulePath" in mod
                                and "moduleType" not in mod
                            ):
                                manifest = unified_provider.get_manifest(mod["modulePath"])
                                if manifest and manifest.type:
                                    mod["moduleType"] = manifest.type
                                else:
                                    mod["moduleType"] = "generic"

            # Step 2: Parse GlobalConfig (which includes DataConfig)
            global_config = GlobalConfig.model_validate(processed_dict, context=ctx)
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

        if global_config:
            try:
                business_errors = ConfigValidator.validate_business_rules(
                    global_config, unified_provider, config_dir
                )
                errors.extend(business_errors)

                manifest_errors = ConfigValidator.validate_manifest_contracts(
                    global_config, unified_provider, config_dir
                )
                errors.extend(manifest_errors)
            except Exception as e:
                errors.append(f"Unexpected validation error: {e}")

        return global_config if not errors else None, errors
