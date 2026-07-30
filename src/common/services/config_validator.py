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

import difflib
import pathlib
from typing import Any

import yaml

from common import errors as common_errors
from common.schemas import config_schema, manifest_schema
from common.schemas.config_schema import GlobalConfig
from common.services.base_module_provider import LocalWorkspaceProvider
from common.utils.file_utils import load_yaml


def _get_enabled_tables_from_settings(settings_dict: dict[str, Any]) -> set[str]:
    """Extracts and normalizes table names enabled within foundation or product table settings.

    Args:
        settings_dict: Dictionary parsed from tableSettings YAML file.

    Returns:
        Set of lowercase table names enabled in the settings.
    """
    enabled_tables: set[str] = set()
    for section in ("ecc", "s4", "common"):
        items = settings_dict.get(section, [])
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    src = item.get("source", {})
                    tgt = item.get("target", {})
                    t_name = (tgt.get("tableName") if isinstance(tgt, dict) else None) or (
                        src.get("tableName") if isinstance(src, dict) else None
                    )
                    if t_name:
                        enabled_tables.add(t_name.lower())
        elif isinstance(items, dict):
            for t_name, item_val in items.items():
                if isinstance(item_val, dict):
                    if item_val.get("enabled", True):
                        enabled_tables.add(t_name.lower())
                else:
                    enabled_tables.add(t_name.lower())
    return enabled_tables


class ConfigValidator:
    """Validation service for config.yaml."""

    @staticmethod
    def _load_module_manifest(
        global_config: GlobalConfig, module_config: Any, config_dir: pathlib.Path | None = None
    ) -> manifest_schema.ManifestConfig | None:
        manifest_path = None
        try:
            mod_type_str = module_config.namespaced_type
            module_dir = global_config.data.get_module_physical_dir(
                mod_type_str, config_dir=config_dir
            )
            manifest_path = module_dir / "manifest.yaml"
            if not manifest_path.exists():
                return None
            manifest_data = load_yaml(manifest_path) or {}
            return manifest_schema.ManifestConfig(**manifest_data)
        except Exception as e:
            path_str = f" at '{manifest_path}'" if manifest_path else ""
            raise common_errors.CortexConfigError(f"Failed to parse manifest{path_str}: {e}") from e

    @staticmethod
    def _discover_modules(
        modules_config: Any,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        all_modules: dict[str, Any] = {}
        enabled_modules: dict[str, Any] = {}

        for f_mod in modules_config.foundation:
            all_modules[f_mod.module_id] = f_mod
            if f_mod.enabled:
                enabled_modules[f_mod.module_id] = f_mod

        for p_mod in modules_config.product:
            all_modules[p_mod.module_id] = p_mod
            if p_mod.enabled:
                enabled_modules[p_mod.module_id] = p_mod

        return all_modules, enabled_modules

    @staticmethod
    def _build_dependency_graph(enabled_modules: dict[str, Any]) -> dict[str, list[str]]:
        graph: dict[str, list[str]] = {}
        for mod_id, mod in enabled_modules.items():
            graph[mod_id] = [
                target_id
                for target_id in mod.dependency_bindings.values()
                if target_id in enabled_modules
            ]
        return graph

    @staticmethod
    def _find_circular_dependencies(
        graph: dict[str, list[str]], enabled_modules: dict[str, Any]
    ) -> list[str]:
        visited: dict[str, int] = {mod_id: 0 for mod_id in enabled_modules}
        path: list[str] = []
        cycle_found: list[str] = []

        def dfs(node: str) -> bool:
            visited[node] = 1
            path.append(node)

            for neighbor in graph.get(node, []):
                if visited.get(neighbor, 0) == 1:
                    cycle_start_index = path.index(neighbor)
                    cycle_found.extend(path[cycle_start_index:] + [neighbor])
                    return True
                if visited.get(neighbor, 0) == 0 and dfs(neighbor):
                    return True

            path.pop()
            visited[node] = 2
            return False

        for mod_id in enabled_modules:
            if visited[mod_id] == 0 and dfs(mod_id):
                return cycle_found

        return []

    @staticmethod
    def _validate_module_dependencies(
        modules_config: Any,
        all_modules: dict[str, Any],
        enabled_modules: dict[str, Any],
        unified_provider: Any,
    ) -> list[str]:

        errors: list[str] = []
        catalog_ids = {c.id: c.enabled for c in modules_config.catalogs}
        for mod_id, mod in enabled_modules.items():
            category = "Foundation" if mod in modules_config.foundation else "Product"

            for dep_key, target_mod_id in mod.dependency_bindings.items():
                cat_match = next(
                    (cat_id for cat_id in catalog_ids if target_mod_id.startswith(f"{cat_id}.")),
                    None,
                )
                if cat_match is not None:
                    if not catalog_ids[cat_match]:
                        errors.append(
                            f"{category} module '{mod_id}' dependencyBindings key '{dep_key}' "
                            f"maps to catalog '{cat_match}' which is disabled. "
                            f"Please set 'enabled: true' "
                            f"for catalog '{cat_match}' in 'config.yaml' or update "
                            f"'dependencyBindings -> {dep_key}'."
                        )
                    continue

                if target_mod_id not in all_modules:
                    matches = difflib.get_close_matches(target_mod_id, list(all_modules.keys()))
                    suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                    errors.append(
                        f"{category} module '{mod_id}' dependencyBindings key '{dep_key}' maps to "
                        f"unknown module ID '{target_mod_id}'.{suggestion} Please define "
                        f"module '{target_mod_id}' in 'data -> modules' or update "
                        f"'dependencyBindings -> {dep_key}'."
                    )
                elif target_mod_id not in enabled_modules:
                    errors.append(
                        f"{category} module '{mod_id}' dependencyBindings key '{dep_key}' maps to "
                        f"module '{target_mod_id}' which is disabled. Please set 'enabled: true' "
                        f"for module '{target_mod_id}' in 'config.yaml' or update "
                        f"'dependencyBindings -> {dep_key}'."
                    )

            mod_type = mod.namespaced_type
            manifest = None
            if mod_type and isinstance(unified_provider, LocalWorkspaceProvider):
                manifest = unified_provider.get_manifest(mod_type)

            if manifest and manifest.dependencies:
                for req_dep_key in manifest.dependencies:
                    if req_dep_key not in mod.dependency_bindings:
                        errors.append(
                            f"{category} module '{mod_id}' (type '{mod_type}') requires "
                            f"dependency '{req_dep_key}' declared in its manifest, but "
                            f"'{req_dep_key}' is missing from 'dependencyBindings' "
                            f"in 'config.yaml'. "
                            f"Please add 'dependencyBindings -> {req_dep_key}: <target_module_id>' "
                            f"under module '{mod_id}'."
                        )
        return errors

    @staticmethod
    def validate_business_rules(
        global_config: GlobalConfig, unified_provider: Any, config_dir: pathlib.Path
    ) -> list[str]:

        errors: list[str] = []

        id_occurrences: dict[str, list[str]] = {}
        for index, dataset in enumerate(global_config.data.datasets):
            id_occurrences.setdefault(dataset.id, []).append(f"data -> datasets[{index}]")
        for index, f_module in enumerate(global_config.data.modules.foundation):
            loc = f"data -> modules -> foundation[{index}]"
            id_occurrences.setdefault(f_module.module_id, []).append(loc)
        for index, p_module in enumerate(global_config.data.modules.product):
            loc = f"data -> modules -> product[{index}]"
            id_occurrences.setdefault(p_module.module_id, []).append(loc)
        for index, c_module in enumerate(global_config.data.modules.catalogs):
            loc = f"data -> modules -> catalogs[{index}]"
            id_occurrences.setdefault(c_module.id, []).append(loc)

        for id_value, locations in id_occurrences.items():
            if len(locations) > 1:
                errors.append(
                    f"Duplicate ID '{id_value}' found across the configuration at: "
                    f"{', '.join(locations)}. Each ID in 'datasets' and "
                    "'modules' must be unique."
                )

        dataset_ids = {d.id for d in global_config.data.datasets}

        for f_module in global_config.data.modules.foundation:
            module_id = f_module.module_id
            data_source_id = f_module.data_source_id
            if data_source_id and data_source_id not in dataset_ids:
                matches = difflib.get_close_matches(data_source_id, list(dataset_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Foundation module '{module_id}' references unknown "
                    f"dataSourceId '{data_source_id}'.{suggestion} Please check "
                    "spelling or define this source ID in 'data -> datasets'. "
                    "(references unknown data source)"
                )

            data_target_id = f_module.data_target_id
            is_external = getattr(f_module, "external", False)
            if not is_external and not data_target_id:
                errors.append(
                    f"Foundation module '{module_id}' is not external and "
                    "must specify a 'dataTargetId'."
                )
            elif is_external and data_target_id:
                errors.append("dataTargetId should not be set for external foundations")
            elif data_target_id and data_target_id not in dataset_ids:
                matches = difflib.get_close_matches(data_target_id, list(dataset_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Foundation module '{module_id}' references unknown "
                    f"dataTargetId '{data_target_id}'.{suggestion} Please check "
                    "spelling or define this target ID in 'data -> datasets'. "
                    "(references unknown data target)"
                )

        for p_module in global_config.data.modules.product:
            module_id = p_module.module_id
            data_target_id = p_module.data_target_id
            if data_target_id and data_target_id not in dataset_ids:
                matches = difflib.get_close_matches(data_target_id, list(dataset_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Product module '{module_id}' references unknown "
                    f"dataTargetId '{data_target_id}'.{suggestion} Please check "
                    "spelling or define this target ID in 'data -> datasets'. "
                    "(references unknown data target)"
                )

        dataset_by_type: dict[str, set[tuple[str, str]]] = {}
        for f_module in global_config.data.modules.foundation:
            if getattr(f_module, "external", False) or not f_module.data_target_id:
                continue
            if f_module.data_target_id in dataset_ids:
                try:
                    target = global_config.get_dataset(f_module.data_target_id)
                    target_key = (target.project_id, target.dataset_id)
                    module_type = f_module.module_path
                    if module_type not in dataset_by_type:
                        dataset_by_type[module_type] = set()
                    if target_key in dataset_by_type[module_type]:
                        errors.append(
                            f"Foundation module '{f_module.module_id}' of type '{module_type}' "
                            f"shares target dataset '{target.project_id}.{target.dataset_id}' "
                            f"with another module of the same type."
                        )
                    dataset_by_type[module_type].add(target_key)
                except ValueError:
                    pass

        dataset_by_type.clear()
        for p_module in global_config.data.modules.product:
            if not p_module.data_target_id:
                continue
            if p_module.data_target_id in dataset_ids:
                try:
                    target = global_config.get_dataset(p_module.data_target_id)
                    target_key = (target.project_id, target.dataset_id)
                    module_type = p_module.module_path
                    if module_type not in dataset_by_type:
                        dataset_by_type[module_type] = set()
                    if target_key in dataset_by_type[module_type]:
                        errors.append(
                            f"Product module '{p_module.module_id}' of type '{module_type}' "
                            f"shares target dataset '{target.project_id}.{target.dataset_id}' "
                            f"with another module of the same type."
                        )
                    dataset_by_type[module_type].add(target_key)
                except ValueError:
                    pass

        for f_module in global_config.data.modules.foundation:
            module_id = f_module.module_id
            table_settings = f_module.table_settings
            if getattr(f_module, "_table_settings_explicit", False) and table_settings:
                file_path = pathlib.Path(table_settings)
                if not file_path.is_absolute():
                    file_path = config_dir / file_path
                try:
                    load_yaml(file_path)
                except (FileNotFoundError, common_errors.CortexConfigError):
                    errors.append(
                        f"Foundation module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that does not exist at '{file_path}'. "
                        "Please verify the path is correct and the file exists."
                    )
                except yaml.YAMLError as e:
                    errors.append(
                        f"Foundation module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that has invalid YAML syntax: {e}"
                    )
                except Exception as e:
                    errors.append(
                        f"Foundation module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' could not be loaded: {e}"
                    )

        for p_module in global_config.data.modules.product:
            module_id = p_module.module_id
            table_settings = p_module.table_settings
            if getattr(p_module, "_table_settings_explicit", False) and table_settings:
                file_path = pathlib.Path(table_settings)
                if not file_path.is_absolute():
                    file_path = config_dir / file_path
                try:
                    load_yaml(file_path)
                except (FileNotFoundError, common_errors.CortexConfigError):
                    errors.append(
                        f"Product module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that does not exist at '{file_path}'. "
                        "Please verify the path is correct and the file exists."
                    )
                except yaml.YAMLError as e:
                    errors.append(
                        f"Product module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that has invalid YAML syntax: {e}"
                    )
                except Exception as e:
                    errors.append(
                        f"Product module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' could not be loaded: {e}"
                    )

        all_modules, enabled_modules = ConfigValidator._discover_modules(global_config.data.modules)
        errors.extend(
            ConfigValidator._validate_module_dependencies(
                global_config.data.modules,
                all_modules,
                enabled_modules,
                unified_provider,
            )
        )
        graph = ConfigValidator._build_dependency_graph(enabled_modules)
        cycle_found = ConfigValidator._find_circular_dependencies(graph, enabled_modules)
        if cycle_found:
            cycle_str = " -> ".join(cycle_found)
            errors.append(
                f"Circular dependency detected in module configuration: {cycle_str}. "
                "Please resolve the circular dependency by updating 'dependencyBindings' "
                "mappings in 'config.yaml'."
            )

        if unified_provider:
            for mod in global_config.data.modules.foundation + global_config.data.modules.product:
                if not mod.enabled:
                    continue
                full_type = mod.namespaced_type

                if not unified_provider.is_valid_module_type(full_type):
                    valid_types = list(unified_provider.get_module_types())
                    matches = difflib.get_close_matches(full_type, valid_types)
                    suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                    errors.append(
                        f"Module '{mod.module_id}' has invalid or undiscoverable type "
                        f"'{full_type}'.{suggestion} Please verify the directory path, "
                        "spelling, or manifest.yaml configuration."
                    )

        return errors

    @staticmethod
    def validate_manifest_contracts(
        global_config: GlobalConfig,
        module_provider: Any = None,
        config_dir: pathlib.Path | None = None,
    ) -> list[str]:
        """Validates dependencyBindings and manifest table contracts for product modules.

        Args:
            global_config: Global configuration model instance.
            module_provider: Optional pre-initialized module provider.
            config_dir: Directory containing config.yaml, used to resolve relative paths.

        Returns:
            List of validation error message strings.
        """
        errors: list[str] = []
        virtual_module_types = module_provider.get_module_types() if module_provider else set()

        enabled_modules: dict[str, Any] = {}
        for f_mod in global_config.data.modules.foundation:
            if f_mod.enabled:
                enabled_modules[f_mod.module_id] = f_mod
        for p_mod in global_config.data.modules.product:
            if p_mod.enabled:
                enabled_modules[p_mod.module_id] = p_mod

        src_dir = pathlib.Path(__file__).resolve().parent.parent.parent
        for p_mod in global_config.data.modules.product:
            if not p_mod.enabled:
                continue

            full_type = p_mod.namespaced_type
            manifest_config = None
            if isinstance(module_provider, LocalWorkspaceProvider):
                manifest_config = module_provider.get_manifest(full_type)

            if manifest_config is None:
                module_dir = global_config.data.get_module_physical_dir(
                    full_type, config_dir=config_dir
                )
                manifest_path = module_dir / "manifest.yaml"
                if not manifest_path.exists():
                    errors.append(
                        f"Manifest file is missing for product module "
                        f"'{p_mod.module_id}' at '{manifest_path}'."
                    )
                    continue

                try:
                    manifest_data = load_yaml(manifest_path) or {}
                    manifest_config = manifest_schema.ManifestConfig(**manifest_data)
                except Exception as e:
                    errors.append(
                        f"Failed to load manifest for product module '{p_mod.module_id}': {e}"
                    )
                    continue

            sap_versions: set[manifest_schema.SapVersion] = set()
            for dep_key, dep_info in manifest_config.dependencies.items():
                dep_val = p_mod.dependency_bindings.get(dep_key)
                if not dep_val:
                    continue

                if dep_val in enabled_modules:
                    upstream_mod = enabled_modules[dep_val]
                    try:
                        upstream_manifest = None
                        if isinstance(module_provider, LocalWorkspaceProvider):
                            upstream_manifest = module_provider.get_manifest(
                                upstream_mod.namespaced_type
                            )

                        if upstream_manifest is None:
                            upstream_manifest = ConfigValidator._load_module_manifest(
                                global_config, upstream_mod, config_dir
                            )
                    except Exception as e:
                        errors.append(
                            f"Product module '{p_mod.module_id}' depends on module '{dep_val}', "
                            f"but its manifest is invalid: {e}"
                        )
                        continue

                    if upstream_manifest is None:
                        mod_type_str = upstream_mod.namespaced_type
                        module_dir = global_config.data.get_module_physical_dir(
                            mod_type_str, config_dir=config_dir
                        )
                        manifest_path = module_dir / "manifest.yaml"
                        errors.append(
                            f"Product module '{p_mod.module_id}' depends on module '{dep_val}', "
                            f"but its manifest file is missing at '{manifest_path}'."
                        )
                        continue
                    cat_prod = manifest_schema.ModuleCategory.FOUNDATIONAL_PRODUCT
                    cat_found = manifest_schema.ModuleCategory.FOUNDATION
                    if (
                        upstream_manifest
                        and manifest_config.category == cat_prod
                        and upstream_manifest.category != cat_found
                    ):
                        up_cat = (
                            upstream_manifest.category.value
                            if upstream_manifest.category
                            else "none"
                        )
                        errors.append(
                            f"Foundational product module '{p_mod.module_id}' cannot depend on "
                            f"non-foundation module '{dep_val}' (which has category "
                            f"'{up_cat}')."
                        )

                    if isinstance(dep_info, manifest_schema.SapDependencyInfo):
                        if not isinstance(upstream_mod, config_schema.SAPModuleConfig):
                            mod_type = str(getattr(upstream_mod, "module_type", "unknown"))
                            errors.append(
                                f"Product module '{p_mod.module_id}' dependency '{dep_key}' "
                                f"expects a module providing SAP-specific capabilities, but the "
                                f"provided module '{upstream_mod.module_id}' is configured as "
                                f"type '{mod_type}'."
                            )
                            continue

                        sap_version = upstream_mod.module_settings.sap_version
                        if sap_version not in dep_info.supported_versions:
                            supported_strs = [v.value for v in dep_info.supported_versions]
                            errors.append(
                                f"Product module '{p_mod.module_id}' depends on foundation "
                                f"'{upstream_mod.module_id}' with SAP version "
                                f"'{sap_version.value}', but this product only supports: "
                                f"{supported_strs}."
                            )
                            continue

                    req_tables = dep_info.get_required_tables()
                    if req_tables:
                        table_settings_path = upstream_mod.table_settings
                        file_path = None

                        if not table_settings_path and isinstance(
                            module_provider, LocalWorkspaceProvider
                        ):
                            # If not explicitly provided, try to resolve via the
                            # internal module provider
                            mod_dir = module_provider.get_module_dir(upstream_mod.namespaced_type)
                            if mod_dir:
                                file_path = mod_dir / "table_settings.default.yaml"

                        if not file_path and not table_settings_path:
                            raise common_errors.CortexConfigError(
                                f"Module '{upstream_mod.module_id}' does not specify "
                                f"tableSettings required by product module '{p_mod.module_id}'."
                            )

                        if not file_path and table_settings_path:
                            file_path = pathlib.Path(table_settings_path)
                            if not file_path.is_absolute():
                                if (
                                    getattr(upstream_mod, "_table_settings_explicit", False)
                                    and config_dir
                                ):
                                    file_path = config_dir / file_path
                                else:
                                    file_path = src_dir.parent / file_path

                        if not file_path or not file_path.exists():
                            raise common_errors.CortexConfigError(
                                f"Table settings file '{file_path}' for module "
                                f"'{upstream_mod.module_id}' does not exist."
                            )
                        try:
                            settings_data = load_yaml(file_path) or {}
                            enabled_tables = _get_enabled_tables_from_settings(settings_data)
                            for req_table in req_tables:
                                if req_table.lower() not in enabled_tables:
                                    raise common_errors.CortexConfigError(
                                        f"Product module '{p_mod.module_id}' requires table "
                                        f"'{req_table}' from dependency '{dep_key}' ({dep_val}), "
                                        f"but it is missing or disabled in '{file_path}'.",
                                        hint=(
                                            f"Enable or add '{req_table}' in the tableSettings "
                                            f"for module '{dep_val}'."
                                        ),
                                    )
                        except common_errors.CortexConfigError:
                            raise
                        except Exception as e:
                            errors.append(
                                f"Failed to inspect table settings '{file_path}' for "
                                f"module '{upstream_mod.module_id}': {e}"
                            )
                elif (
                    dep_val in virtual_module_types
                    or any(
                        dep_val.startswith(f"{c.id}.") for c in global_config.data.modules.catalogs
                    )
                    or (module_provider and module_provider.is_valid_module_type(dep_val))
                ):
                    provided_types_raw = []
                    if module_provider:
                        provided_types_raw = module_provider.get_provided_types_for_module(dep_val)
                    if provided_types_raw:
                        expected_type = dep_info.module_path
                        matched = False
                        for provided_type_raw in provided_types_raw:
                            if provided_type_raw == expected_type:
                                matched = True
                                break
                        if not matched:
                            raise common_errors.CortexConfigError(
                                f"Product module '{p_mod.module_id}' expects dependency "
                                f"'{dep_key}' to be of type '{expected_type}', but the "
                                f"external catalog share '{dep_val}' is configured to "
                                f"provide types: {provided_types_raw}.",
                                hint=(
                                    f"Update the bindsNamespaces field in config.yaml for "
                                    f"catalog share '{dep_val}' to match the expected type."
                                ),
                            )

                    req_tables = dep_info.get_required_tables()
                    if req_tables:
                        tables_raw = []
                        if module_provider:
                            tables_raw = module_provider.get_tables_for_module(dep_val)
                        available_tables = {t.lower() for t in tables_raw}
                        for req_table in req_tables:
                            if req_table.lower() not in available_tables:
                                raise common_errors.CortexConfigError(
                                    f"Product module '{p_mod.module_id}' requires table "
                                    f"'{req_table}' from external catalog dependency '{dep_key}' "
                                    f"({dep_val}), but the table was not found in the external "
                                    "catalog share.",
                                    hint=(
                                        "Verify that the required table exists in the external "
                                        "share and that the share is properly configured in "
                                        "your catalog."
                                    ),
                                )
                else:
                    raise common_errors.CortexConfigError(
                        f"Product module '{p_mod.module_id}' references dependency '{dep_key}' "
                        f"with value '{dep_val}' which is neither an enabled module ID nor "
                        "a valid external catalog schema.",
                        hint=(
                            "Ensure the target module is enabled or check the spelling of "
                            "the virtual module type (<catalog>.<share>.<schema>)."
                        ),
                    )

            if len(sap_versions) > 1:
                ver_strs = [v.value for v in sap_versions]
                errors.append(
                    f"Product module '{p_mod.module_id}' depends on multiple foundation modules "
                    f"with different SAP versions: {ver_strs}. "
                    "All SAP foundation dependencies must use the same SAP version."
                )

        return errors
