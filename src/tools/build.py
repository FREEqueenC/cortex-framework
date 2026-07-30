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

import argparse
import datetime
import importlib.util
import inspect
import json
import logging
import pathlib
import re
import shutil
import sys
import uuid
from collections.abc import Callable
from typing import Any, NamedTuple

import google.auth
import yaml
from google.auth import exceptions

from common.builders.base import BaseBuilder, FoundationBuilder, ProductBuilder, Source
from common.errors import CortexBuildError, CortexConfigError, CortexError
from common.registry import auto_discover_plugins, builder_registry
from common.schemas.config_schema import DataFoundationModuleConfig, GlobalConfig
from common.schemas.enums import Category, ModuleCategory
from common.schemas.manifest_schema import ManifestConfig
from common.services.config_loader import ConfigLoader
from common.services.external_module_provider import ExternalModuleProvider
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.services.internal_module_provider import InternalModuleProvider
from common.services.telemetry.telemetry_logger import EventLogger
from common.services.unified_module_provider import UnifiedModuleProvider
from common.utils.file_utils import load_yaml
from common.utils.logging import setup_logging

_logger = logging.getLogger(__name__)


class DataformVar:
    """Wrapper to specify explicit fallback variables for a config value."""

    def __init__(self, value: Any, fallbacks: list[str]):
        self.value = value
        self.fallbacks = fallbacks


def dict_to_js_with_vars(
    d: Any, path: list[str], collected_vars: dict[str, Any] | None = None
) -> str:
    """Recursively converts python types to JS code strings.

    Supports safe bracket notation and type casting.
    """
    if collected_vars is None:
        collected_vars = {}

    if isinstance(d, dict):
        items = [
            f"{json.dumps(k)}: {dict_to_js_with_vars(v, path + [k], collected_vars)}"
            for k, v in d.items()
        ]
        return "{\n" + ",\n".join(items) + "\n}"

    if isinstance(d, list):
        items = [dict_to_js_with_vars(v, path + [str(i)], collected_vars) for i, v in enumerate(d)]
        return "[\n" + ",\n".join(items) + "\n]"

    if isinstance(d, DataformVar):
        fallbacks = d.fallbacks
        value = d.value
    else:
        fallbacks = []
        if path:
            leaf = path[-1]
            fallbacks.append("cortex_" + "_".join(path))
            if len(path) > 2:
                fallbacks.append("cortex_" + path[0] + "_" + leaf)
            if len(path) > 1:
                fallbacks.append("cortex_" + leaf)
            fallbacks = list(dict.fromkeys(fallbacks))
        value = d

    for f in fallbacks:
        if f not in collected_vars:
            collected_vars[f] = value

    chain = " || ".join([f"vars[{json.dumps(v)}]" for v in fallbacks])

    if not chain:
        return json.dumps(value)

    if isinstance(value, bool):
        return f'((v => v === "true" ? true : v === "false" ? false : v)({chain}))'
    elif isinstance(value, (int, float)):
        return f"Number({chain})"
    elif value is None:
        return f"({chain})"
    else:
        return f"({chain})"


class DatasetIdentifier(NamedTuple):
    """Represents a dataset identifier for grouping."""

    project: str
    dataset: str


class DataformBuilder:
    def __init__(
        self,
        global_config: GlobalConfig,
        output_dir: pathlib.Path,
        config_dir: pathlib.Path,
        base_dir: pathlib.Path | None = None,
        src_dir: pathlib.Path | None = None,
        builder_factory: Callable[[str], BaseBuilder | None] | None = None,
        default_project: str | None = None,
        assertions_path: pathlib.Path | None = None,
    ):
        self.global_config = global_config
        self.output_dir = output_dir
        # src_dir is still the python source root
        self.src_dir = src_dir or pathlib.Path(__file__).resolve().parent.parent
        self.base_dir = base_dir or self.src_dir.parent
        self.config_dir = config_dir
        self.data_modules_dir = self.src_dir / "data_modules"
        self.builder_factory = builder_factory
        self.default_project = default_project
        self.assertions_path = assertions_path
        self.sources_registry: set[Source] = set()

        if str(self.src_dir) not in sys.path:
            sys.path.insert(0, str(self.src_dir))

        if str(self.data_modules_dir) not in sys.path:
            sys.path.insert(0, str(self.data_modules_dir))

        self.required_tables_by_foundation: dict[str, set[str]] = {}

        # Instantiate module providers to centralize module discovery
        self.internal_module_provider = InternalModuleProvider(
            namespaces=self.global_config.data.namespaces,
            config_dir=self.config_dir,
        )
        self.external_module_provider = ExternalModuleProvider(
            catalogs=self.global_config.data.modules.catalogs,
        )
        self.module_provider = UnifiedModuleProvider(
            self.internal_module_provider, self.external_module_provider
        )

        # Build dynamic module registry mapping from namespaced_type -> module metadata
        self.module_registry = self._discover_modules()

        # Auto-discover plugins for each namespace
        for ns_config in self.global_config.data.namespaces:
            ns_path = self.global_config.data.get_namespace_path(ns_config.name, self.config_dir)
            try:
                rel_to_dm = ns_path.resolve().relative_to(self.data_modules_dir.resolve())
                package_path = ".".join(rel_to_dm.parts) + ".common.builders"
            except ValueError:
                package_path = f"{ns_config.name}.common.builders"

            builder_registry.set_discovery_namespace(ns_config.name)
            auto_discover_plugins(package_path)
        builder_registry.set_discovery_namespace(None)

        # Auto-discover global builders
        auto_discover_plugins("common.builders")

    def _discover_modules(self) -> dict[str, dict[str, Any]]:
        """Builds a registry of available modules based on InternalModuleProvider and catalogs."""
        registry = {}
        for full_type in self.internal_module_provider.get_module_types():
            module_dir = self.internal_module_provider.get_module_dir(full_type)
            manifest_config = self.internal_module_provider.get_manifest(full_type)
            if not module_dir or not manifest_config:
                continue

            parts = full_type.split(".", 1)
            namespace = parts[0]
            rel_str = parts[1] if len(parts) > 1 else ""
            rel_parts = rel_str.split(".")

            ns_path = self.global_config.data.get_namespace_path(namespace, self.config_dir)
            try:
                rel_to_dm = ns_path.resolve().relative_to(self.data_modules_dir.resolve())
                clean_ns_path = ".".join(rel_to_dm.parts)
            except ValueError:
                clean_ns_path = namespace

            rel_dir = pathlib.Path(*rel_parts)

            # Determine category (foundation vs product) from manifest or folder name
            if manifest_config.category == ModuleCategory.FOUNDATION:
                category = Category.FOUNDATION
            elif manifest_config.category in (
                ModuleCategory.FOUNDATIONAL_PRODUCT,
                ModuleCategory.COMPOSITE_PRODUCT,
            ):
                category = Category.PRODUCT
            elif "foundations" in rel_parts or "data_foundation" in rel_parts:
                category = Category.FOUNDATION
            else:
                category = Category.PRODUCT

            registry[full_type] = {
                "physical_dir": module_dir,
                "module_dir_name": module_dir.name,
                "builder_key": manifest_config.builder,
                "category": category,
                "manifest": manifest_config,
                "namespace": namespace,
                "base_type": rel_str,
                "ns_path": clean_ns_path,
                "rel_dir": rel_dir,
            }

        for catalog_config in self.global_config.data.modules.catalogs:
            full_type = catalog_config.namespaced_type
            registry[full_type] = {
                "physical_dir": self.config_dir,
                "module_dir_name": "catalog",
                "builder_key": catalog_config.type,
                "category": Category.CATALOG,
                "manifest": ManifestConfig(
                    category=ModuleCategory.FOUNDATION, type=catalog_config.type
                ),
                "namespace": None,
                "base_type": catalog_config._module_type,
                "ns_path": None,
            }
        return registry

    def build(self) -> bool:
        """Executes the Dataform build orchestrator."""
        if self.global_config is None:
            _logger.error("GlobalConfig not provided to DataformBuilder")
            return False

        _logger.info("Starting Dataform build in %s", self.output_dir)

        self._prepare_workspace()

        config_js_content = self._generate_config_js_content()
        if config_js_content is None:
            return False  # Validation or processing failed

        collected_vars: dict[str, Any] = {}
        js_code = dict_to_js_with_vars(config_js_content, [], collected_vars)

        self._setup_workflow_and_credentials(collected_vars)
        self._write_build_info()

        if not self._execute_all_modules():
            _logger.error("Build completed with errors in one or more modules.")
            return False

        # --- Finalize and Write config.js ---
        with open(self.output_dir / "includes" / "config.js", "w") as f:
            f.write(
                "const vars = (dataform.projectConfig && dataform.projectConfig.vars) "
                "? dataform.projectConfig.vars : {};\n"
            )
            f.write(f"module.exports = {js_code};\n")

        self._generate_centralized_sources()

        _logger.info("Dataform build completed successfully.")
        EventLogger.wait_for_telemetry()
        return True

    def _prepare_workspace(self) -> None:
        """Cleans the output directory and sets up the workspace structure."""
        if self.output_dir.exists():
            _logger.info("Cleaning old dist directory...")
            shutil.rmtree(self.output_dir)

        (self.output_dir / "definitions").mkdir(parents=True, exist_ok=True)
        (self.output_dir / "includes").mkdir(parents=True, exist_ok=True)

        # Copy Global Includes
        global_includes_dir = self.base_dir / "src" / "dataform_includes"
        if global_includes_dir.exists() and global_includes_dir.is_dir():
            _logger.info("Copying global includes from %s", global_includes_dir)
            shutil.copytree(global_includes_dir, self.output_dir / "includes", dirs_exist_ok=True)

        # Copy Namespaced Includes
        for ns_config in self.global_config.data.namespaces:
            namespace = ns_config.name
            ns_path = self.global_config.data.get_namespace_path(namespace, self.config_dir)
            ns_includes_dir = ns_path / "includes"
            dest_ns_includes_dir = self.output_dir / "includes"

            if ns_includes_dir.exists() and ns_includes_dir.is_dir():
                _logger.info("Copying includes for namespace %s to includes dir", namespace)
                shutil.copytree(ns_includes_dir, dest_ns_includes_dir, dirs_exist_ok=True)

        # Copy Assertions
        if self.assertions_path:
            if self.assertions_path.is_dir():
                _logger.error("Assertions path must be a file, not a directory.")
                return

            dest_assertions_dir = self.output_dir / "definitions" / "assertions"
            dest_assertions_dir.mkdir(parents=True, exist_ok=True)

            _logger.info("Copying assertions file %s", self.assertions_path)
            # Always name it assertions.sqlx in the destination
            shutil.copy2(self.assertions_path, dest_assertions_dir / "assertions.sqlx")

    def _generate_config_js_content(self) -> dict[str, Any] | None:
        """Parses configs to generate the content for includes/config.js. Returns None on error."""
        config_js_content: dict[str, Any] = {"foundation": {}, "product": {}}
        enabled_modules: dict[str, Any] = {}

        foundation_modules = self.global_config.data.modules.foundation
        for mod_config in foundation_modules:
            mod_id = mod_config.module_id
            if mod_config.enabled:
                enabled_modules[mod_id] = mod_config
                if mod_config.external:
                    continue
                if not mod_config.data_target_id:
                    continue
                target = self.global_config.get_dataset(mod_config.data_target_id)
                source = self.global_config.get_dataset(mod_config.data_source_id)
                config_js_content["foundation"][mod_id] = {
                    "targetProjectId": DataformVar(
                        target.project_id, [f"cortex_datasets_{target.id}_projectId"]
                    ),
                    "targetDatasetId": DataformVar(
                        target.dataset_id, [f"cortex_datasets_{target.id}_datasetId"]
                    ),
                    "sourceProjectId": DataformVar(
                        source.project_id, [f"cortex_datasets_{source.id}_projectId"]
                    ),
                    "sourceDatasetId": DataformVar(
                        source.dataset_id, [f"cortex_datasets_{source.id}_datasetId"]
                    ),
                }

        product_modules = self.global_config.data.modules.product
        enabled_modules.update({m.module_id: m for m in product_modules if m.enabled})
        for prod_config in product_modules:
            if not prod_config.enabled:
                continue

            module_id = prod_config.module_id
            full_type = prod_config.namespaced_type
            module_meta = self.module_registry.get(full_type)

            if not module_meta:
                _logger.error(f"Cannot process {module_id}: Unknown product type '{full_type}'.")
                return None

            manifest_config = module_meta["manifest"]
            module_meta["module_dir_name"]

            sources: dict[str, Any] = {}
            for dep_key, dep_info in manifest_config.dependencies.items():
                expected_type = dep_info.module_path
                dep_module_id = prod_config.dependency_bindings.get(dep_key)

                if not dep_module_id:
                    _logger.error(
                        "Product %s depends on %s but no module maps to it.",
                        module_id,
                        dep_key,
                    )
                    return None

                f_config = enabled_modules.get(dep_module_id)
                if not f_config:
                    catalog_id = dep_module_id.split(".", 1)[0]
                    cat_match = next(
                        (
                            cat
                            for cat in self.global_config.data.modules.catalogs
                            if cat.id == catalog_id
                        ),
                        None,
                    )
                    if cat_match:
                        if not cat_match.enabled:
                            _logger.error(
                                "Product %s maps %s to catalog %s which is disabled.",
                                module_id,
                                dep_key,
                                cat_match.id,
                            )
                            return None
                        resolved = self.external_module_provider.resolve_catalog_schema(
                            dep_module_id
                        )
                        if not resolved:
                            _logger.error(
                                "Product %s maps %s to external catalog schema '%s'"
                                " which was not found.",
                                module_id,
                                dep_key,
                                dep_module_id,
                            )
                            return None
                        sources[dep_key] = {
                            "projectId": DataformVar(
                                resolved.project_id,
                                [
                                    f"cortex_catalogs_{cat_match.id}_{dep_key}_projectId",
                                    f"cortex_catalogs_{cat_match.id}_projectId",
                                ],
                            ),
                            "datasetId": DataformVar(
                                resolved.physical_dataset_id,
                                [
                                    f"cortex_catalogs_{cat_match.id}_{dep_key}_datasetId",
                                    f"cortex_catalogs_{cat_match.id}_datasetId",
                                ],
                            ),
                        }
                        continue

                    _logger.error(
                        "Product %s maps %s to module %s which is not enabled/exists.",
                        module_id,
                        dep_key,
                        dep_module_id,
                    )
                    return None

                # Strict comparison using module_path or namespaced_type
                if (
                    f_config.module_path != expected_type
                    and f_config.namespaced_type != expected_type
                ):
                    _logger.error(
                        "Product %s dependency %s expects type %s, but module %s is type %s.",
                        module_id,
                        dep_key,
                        expected_type,
                        dep_module_id,
                        f_config.module_path,
                    )
                    return None

                if isinstance(f_config, DataFoundationModuleConfig) and f_config.external:
                    f_source = self.global_config.get_dataset(f_config.data_source_id)
                    sources[dep_key] = {
                        "projectId": DataformVar(
                            f_source.project_id, [f"cortex_datasets_{f_source.id}_projectId"]
                        ),
                        "datasetId": DataformVar(
                            f_source.dataset_id, [f"cortex_datasets_{f_source.id}_datasetId"]
                        ),
                    }
                else:
                    if not f_config.data_target_id:
                        raise CortexConfigError(
                            f"dataTargetId is missing for module '{f_config.module_id}'",
                            hint=(
                                "Verify that 'dataTargetId' is set for this module "
                                "in your config.yaml."
                            ),
                        )
                    f_target = self.global_config.get_dataset(f_config.data_target_id)
                    sources[dep_key] = {
                        "projectId": DataformVar(
                            f_target.project_id, [f"cortex_datasets_{f_target.id}_projectId"]
                        ),
                        "datasetId": DataformVar(
                            f_target.dataset_id, [f"cortex_datasets_{f_target.id}_datasetId"]
                        ),
                    }

            prod_target = self.global_config.get_dataset(prod_config.data_target_id)
            config_js_content["product"][module_id] = {
                "targetProjectId": DataformVar(
                    prod_target.project_id, [f"cortex_datasets_{prod_target.id}_projectId"]
                ),
                "targetDatasetId": DataformVar(
                    prod_target.dataset_id, [f"cortex_datasets_{prod_target.id}_datasetId"]
                ),
                "sources": sources,
            }

        return config_js_content

    def _setup_workflow_and_credentials(self, collected_vars: dict[str, Any]) -> None:
        """Sets up Dataform workflow settings and local credentials."""
        location = self.global_config.data.big_query_location
        src_workflow_settings = self.src_dir / "workflow_settings.yaml"
        dest_workflow_settings = self.output_dir / "workflow_settings.yaml"

        if src_workflow_settings.exists():
            settings_yaml = load_yaml(src_workflow_settings)
            settings_yaml["defaultLocation"] = location

            vars_dict = settings_yaml.setdefault("vars", {})
            for k, v in collected_vars.items():
                vars_dict[k] = v

            with open(dest_workflow_settings, "w") as f:
                yaml.dump(settings_yaml, f)

            # Local Dataform runs expect `.df-credentials.json` for GCP credentials
            credentials_file = self.output_dir / ".df-credentials.json"
            execution_project = self.default_project
            if not self.default_project:
                try:
                    _, current_project = google.auth.default()
                    if current_project:
                        execution_project = current_project
                except exceptions.DefaultCredentialsError as e:
                    _logger.warning(
                        "Could not determine current project for local Dataform "
                        "execution via google.auth: %s",
                        e,
                    )

            with open(credentials_file, "w") as f:
                json.dump({"projectId": execution_project, "location": location}, f, indent=4)

    def _write_build_info(self) -> None:
        """Generates and writes build tracking info."""
        build_info_file = self.output_dir / "build_info.yaml"
        build_id = uuid.uuid4().hex[:6]
        _logger.info("Build ID: %s", build_id)

        build_info_yaml = {
            "buildId": build_id,
            "buildDateTime": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        with open(build_info_file, "w") as f:
            yaml.dump(build_info_yaml, f)

    def _execute_all_modules(self) -> bool:
        """Iterates through all enabled modules and delegates execution to their builders."""
        all_successful = True
        self.sources_registry.clear()
        self.required_tables_by_foundation.clear()

        product_modules = self.global_config.data.modules.product
        foundation_modules = self.global_config.data.modules.foundation

        # Collect required tables for foundation modules from enabled product modules
        for prod_config in product_modules:
            if not prod_config.enabled:
                continue
            full_type = prod_config.namespaced_type
            module_meta = self.module_registry.get(full_type)
            if not module_meta:
                continue

            manifest_config = module_meta["manifest"]
            for dep_key, dep_info in manifest_config.dependencies.items():
                foundation_id = prod_config.dependency_bindings.get(dep_key)
                if foundation_id:
                    tables = dep_info.get_required_tables()
                    self.required_tables_by_foundation.setdefault(foundation_id, set()).update(
                        tables
                    )

        # Process catalog modules
        for cat_config in self.global_config.data.modules.catalogs:
            if cat_config.enabled and not self._process_module(cat_config, Category.CATALOG):
                all_successful = False

        if not all_successful:
            _logger.error("Catalog build failed. Skipping foundation and product builds.")
            return False

        # Process foundation modules
        for mod_config in foundation_modules:
            if mod_config.enabled and not self._process_module(mod_config, Category.FOUNDATION):
                all_successful = False

        if not all_successful:
            _logger.error("Foundation build failed. Skipping product build.")
            return False

        # Process product modules
        for prod_config in product_modules:
            if prod_config.enabled and not self._process_module(prod_config, Category.PRODUCT):
                all_successful = False

        return all_successful

    def _process_module(self, module_config, category: Category) -> bool:
        """Loads and executes a dynamic data module's builder.py."""
        context = self._get_module_context(module_config, category)
        if not context:
            return False

        plugin, out_dir, ann_dir, dir_name = context
        module_id = module_config.module_id
        full_type = module_config.namespaced_type
        module_meta = self.module_registry[full_type]

        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            if module_config.table_settings:
                path = pathlib.Path(module_config.table_settings)
                table_settings_file = path if path.is_absolute() else self.config_dir / path
            else:
                table_settings_file = module_meta["physical_dir"] / "table_settings.default.yaml"

            is_valid_builder = False
            build_kwargs = {
                "module_id": module_id,
                "module_config": module_config,
                "global_config": self.global_config,
                "manifest": module_meta["manifest"],
                "base_dir": self.base_dir,
                "annotations_dir": ann_dir,
                "output_dir": out_dir,
                "module_dir_name": dir_name,
                "sources_registry": self.sources_registry,
                "table_settings_file": table_settings_file,
            }

            if category == Category.FOUNDATION and isinstance(plugin, FoundationBuilder):
                build_kwargs["required_tables"] = self.required_tables_by_foundation.get(
                    module_id, set()
                )
                is_valid_builder = True
            elif (category == Category.PRODUCT and isinstance(plugin, ProductBuilder)) or (
                category == Category.CATALOG and isinstance(plugin, BaseBuilder)
            ):
                is_valid_builder = True

            if not is_valid_builder:
                _logger.error(
                    "Invalid builder type %s for category %s.",
                    type(plugin).__name__,
                    category.value,
                )
                return False

            plugin.build(**build_kwargs)

            return True

        except CortexError as e:
            _logger.error("Failed to process %s module %s: %s", category.value, module_id, e)
            return False
        except Exception as e:
            _logger.exception("Failed to process %s module %s: %s", category.value, module_id, e)
            return False

    def _generate_centralized_sources(self) -> None:
        """Generates centralized Dataform source declarations based on the collected registry."""
        if not self.sources_registry:
            return

        _logger.info("Generating centralized source declarations...")

        # Group by (project, dataset)
        grouped_sources: dict[DatasetIdentifier, set[str]] = {}
        for source in self.sources_registry:
            key = DatasetIdentifier(source.project, source.dataset)
            grouped_sources.setdefault(key, set()).add(source.table)

        for dataset_ref, tables in grouped_sources.items():
            proj, ds = dataset_ref.project, dataset_ref.dataset

            # Validate project and dataset IDs to prevent path traversal
            if not re.match(r"^[a-zA-Z0-9._-]+$", proj):
                raise CortexBuildError(
                    f"Invalid project ID: '{proj}'",
                    hint=(
                        "Ensure the project ID contains only alphanumeric characters, "
                        "dots, underscores, or hyphens."
                    ),
                )
            if not re.match(r"^[a-zA-Z0-9._-]+$", ds):
                raise CortexBuildError(
                    f"Invalid dataset ID: '{ds}'",
                    hint=(
                        "Ensure the dataset ID contains only alphanumeric characters, "
                        "dots, underscores, or hyphens."
                    ),
                )

            shared_sources_dir = self.output_dir / "definitions" / "sources"
            shared_sources_dir.mkdir(parents=True, exist_ok=True)

            filename = f"{proj}_{ds}_sources.js"
            # Ensure only filename component is used
            safe_filename = pathlib.Path(filename).name
            sources_file = shared_sources_dir / safe_filename

            # Verify resolved path is within output_dir
            abs_output_dir = self.output_dir.resolve()
            abs_sources_file = sources_file.resolve()

            if not str(abs_sources_file).startswith(str(abs_output_dir)):
                raise CortexBuildError(
                    f"Path traversal detected: {sources_file} is outside {self.output_dir}",
                    hint=(
                        "Ensure that project ID and dataset ID do not contain "
                        "path traversal sequences."
                    ),
                )

            with open(sources_file, "w", encoding="utf-8") as f:
                for table in tables:
                    f.write(
                        f"declare({{\n"
                        f"  database: {json.dumps(proj)},\n"
                        f"  schema: {json.dumps(ds)},\n"
                        f"  name: {json.dumps(table)}\n"
                        f"}});\n"
                    )

    def _get_builder(
        self,
        builder_name: str | None,
        namespace: str | None = None,
        local_module_path: str = "",
        module_dir_name: str = "",
    ) -> BaseBuilder | None:
        """Retrieves a builder instance via dependency injection or registry lookup."""
        if self.builder_factory:
            builder = self.builder_factory(builder_name or local_module_path or module_dir_name)
            if builder:
                return builder

        plugin_class = None

        if local_module_path:
            try:
                importlib.import_module(local_module_path)
            except ImportError as e:
                _logger.warning("Could not auto-import local builder %s: %s", local_module_path, e)

        if builder_name:
            plugin_class = builder_registry.get(builder_name, namespace=namespace)
            if not plugin_class:
                _logger.error(
                    "Builder module '%s' was specified in manifest but not "
                    "found in builder_registry for namespace '%s'. "
                    "Did you forget to import it?",
                    builder_name,
                    namespace,
                )
                return None
        elif local_module_path:
            module = sys.modules.get(local_module_path)
            if module:
                for _, obj in inspect.getmembers(module):
                    if (
                        inspect.isclass(obj)
                        and issubclass(obj, BaseBuilder)
                        and obj is not BaseBuilder
                        and obj.__module__ == local_module_path
                    ):
                        plugin_class = obj
                        break

            if not plugin_class:
                plugin_class = builder_registry.get(local_module_path, namespace=namespace)
            if not plugin_class:
                plugin_class = builder_registry.get(module_dir_name, namespace=namespace)

        if plugin_class:
            return plugin_class()

        return None

    def _get_module_context(
        self, module_config, category: Category
    ) -> tuple[Any, pathlib.Path, pathlib.Path, str] | None:
        """Resolves common module metadata and initializes the builder plugin."""
        module_id = module_config.module_id
        full_type = module_config.namespaced_type

        module_meta = self.module_registry.get(full_type)
        if not module_meta:
            _logger.error("Unknown module type '%s' requested by %s.", full_type, module_id)
            return None

        module_dir_name = module_meta["module_dir_name"]
        builder_name = module_meta["builder_key"]
        module_src_dir = module_meta["physical_dir"]
        namespace = module_meta["namespace"]

        _logger.info(
            "Resolving context for %s module %s (namespace: %s) with builder: %s",
            category.value,
            module_id,
            namespace,
            builder_name,
        )

        definitions_dir = self.output_dir / "definitions"
        rel_dir = module_meta.get("rel_dir")
        ns_dir = definitions_dir / namespace if namespace else definitions_dir
        if rel_dir and len(rel_dir.parts) >= 2:
            module_output_dir = ns_dir / rel_dir.parent / module_id
        else:
            module_output_dir = ns_dir / category.value / module_id
        module_annotations_dir = module_src_dir / "annotations"

        try:
            ns_path = module_meta.get("ns_path")
            rel_dir_str = str(module_meta.get("rel_dir", "")).replace("/", ".")
            local_module_path = f"data_modules.{ns_path}.{rel_dir_str}.builder"
            builder_path = module_src_dir / "builder.py"

            plugin_instance = self._get_builder(
                builder_name=builder_name,
                namespace=namespace,
                local_module_path=local_module_path if builder_path.exists() else "",
                module_dir_name=module_dir_name,
            )

            if builder_name and not plugin_instance:
                return None

            return plugin_instance, module_output_dir, module_annotations_dir, module_dir_name

        except Exception as e:
            _logger.exception("Failed to resolve context for module %s: %s", module_id, e)
            return None


def main(args=None):
    setup_logging()
    parser = argparse.ArgumentParser(description="Build Cortex Framework Dataform package")
    parser.add_argument(
        "--config",
        type=pathlib.Path,
        default=pathlib.Path.cwd() / "config" / "config.yaml",
        help="Path to global config.yaml",
    )
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=pathlib.Path.cwd() / "dist",
        help="Path to the build output directory",
    )
    parser.add_argument(
        "--enable-apis",
        action="store_true",
        help="Enable required APIs without prompting",
    )
    parser.add_argument(
        "--create-datasets",
        action="store_true",
        help="Create missing datasets without prompting",
    )
    parser.add_argument(
        "--assertions",
        type=pathlib.Path,
        help="Path to a Dataform assertions file (assertions.sqlx)",
    )
    args = parser.parse_args(args)

    try:
        config_file = args.config
        if not config_file.exists():
            raise CortexConfigError(
                f"Config file not found at {config_file}",
                hint="Please check that the file path is correct and that the file exists.",
            )

        global_config, validation_errors = ConfigLoader.load_and_validate(config_file)
        if not global_config:
            errors_str = "\n".join(f"  - {err}" for err in validation_errors)
            raise CortexConfigError(
                f"Configuration validation failed with the following errors:\n{errors_str}",
                hint="Correct the issues in config.yaml according to the validation rules.",
            )

        checker = GcpEnvironmentChecker(
            global_config,
            enable_apis=args.enable_apis,
            create_datasets=args.create_datasets,
        )
        checker.validate_all()

        output_dir = args.output_dir
        if not output_dir.is_absolute():
            output_dir = pathlib.Path.cwd() / output_dir

        builder = DataformBuilder(
            global_config=global_config,
            output_dir=output_dir,
            config_dir=config_file.parent,
            assertions_path=args.assertions,
        )
        success = builder.build()
        if not success:
            raise CortexBuildError(
                "Build completed with errors in one or more modules.",
                hint=(
                    "Check the log files or console output above to identify which "
                    "builder module failed and check its settings."
                ),
            )
    except CortexError as e:
        _logger.error(str(e))
        sys.exit(1)
    except Exception:
        _logger.exception("An unexpected error occurred:")
        sys.exit(1)


if __name__ == "__main__":
    main()
