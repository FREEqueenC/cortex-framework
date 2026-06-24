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
from common.registry import auto_discover_plugins, builder_registry
from common.schemas.config_schema import DataFoundationModuleConfig, GlobalConfig, SAPModuleConfig
from common.schemas.enums import ModuleCategory, ModuleType
from common.schemas.manifest_schema import ManifestConfig
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.config_validator import ConfigValidator
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.utils.file_utils import load_yaml
from common.utils.logging import setup_logging

_logger = logging.getLogger(__name__)


class DatasetIdentifier(NamedTuple):
    """Represents a dataset identifier for grouping."""

    project: str
    dataset: str


class DataformBuilder:
    def __init__(
        self,
        global_config: GlobalConfig,
        output_dir: pathlib.Path,
        base_dir: pathlib.Path | None = None,
        config_dir: pathlib.Path | None = None,
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
        self.config_dir = config_dir or self.base_dir
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

        # Build dynamic module registry mapping from namespaced_type -> module metadata
        self.module_registry = self._discover_modules()

        # Auto-discover plugins for each namespace
        for ns_config in self.global_config.data.namespaces:
            path_parts = pathlib.Path(ns_config.path).parts
            package_path = ".".join(path_parts) + ".common.builders"

            builder_registry.set_discovery_namespace(ns_config.name)
            auto_discover_plugins(package_path)
        builder_registry.set_discovery_namespace(None)

        # Auto-discover global builders
        auto_discover_plugins("common.builders")

    def _discover_modules(self) -> dict[str, dict[str, Any]]:
        """Scans module directories to build a registry of available modules based on type."""
        registry = {}
        for ns_config in self.global_config.data.namespaces:
            namespace = ns_config.name
            ns_path = self.data_modules_dir / ns_config.path

            if not ns_path.exists():
                _logger.warning("Namespace path %s does not exist. Skipping.", ns_path)
                continue

            for category in ["data_foundation", "data_product"]:
                category_dir = ns_path / category
                if not category_dir.exists():
                    continue

                for module_dir in category_dir.iterdir():
                    if not module_dir.is_dir():
                        continue

                    manifest_path = module_dir / "manifest.yaml"
                    if manifest_path.exists():
                        manifest_data = load_yaml(manifest_path) or {}
                        manifest_config = ManifestConfig(**manifest_data)

                        # If type is defined in manifest, use it.
                        # Otherwise, fallback to the directory name.
                        base_type = manifest_config.type or module_dir.name
                        full_type = f"{namespace}.{base_type}"
                        registry[full_type] = {
                            "physical_dir": module_dir,
                            "module_dir_name": module_dir.name,
                            "builder_key": manifest_config.builder,
                            "category": category,
                            "manifest": manifest_config,
                            "namespace": namespace,
                            "base_type": base_type,
                            "ns_path": ns_config.path.strip("/"),
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

        self._setup_workflow_and_credentials()
        self._write_build_info()

        if not self._execute_all_modules():
            _logger.error("Build completed with errors in one or more modules.")
            return False

        # --- Finalize and Write config.js ---
        with open(self.output_dir / "includes" / "config.js", "w") as f:
            f.write(f"module.exports = {json.dumps(config_js_content, indent=4)};\n")

        self._generate_centralized_sources()

        _logger.info("Dataform build completed successfully.")
        return True

    def _prepare_workspace(self) -> None:
        """Cleans the output directory and sets up the workspace structure."""
        if self.output_dir.exists():
            _logger.info("Cleaning old dist directory...")
            shutil.rmtree(self.output_dir)

        (self.output_dir / "definitions").mkdir(parents=True, exist_ok=True)
        (self.output_dir / "includes").mkdir(parents=True, exist_ok=True)

        # Copy Namespaced Includes
        for ns_config in self.global_config.data.namespaces:
            namespace = ns_config.name
            ns_path = self.data_modules_dir / ns_config.path
            ns_includes_dir = ns_path / "includes"
            dest_ns_includes_dir = self.output_dir / "includes" / namespace

            if ns_includes_dir.exists() and ns_includes_dir.is_dir():
                _logger.info("Copying includes for namespace %s", namespace)
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
        foundation_lookup: dict[str, Any] = {}

        foundation_modules = self.global_config.data.modules.foundation
        for mod_config in foundation_modules:
            mod_id = mod_config.module_id
            if mod_config.enabled:
                foundation_lookup[mod_id] = mod_config
                if mod_config.external:
                    continue
                if not mod_config.data_target_id:
                    continue
                target = self.global_config.get_data_target(mod_config.data_target_id)
                source = self.global_config.get_data_source(mod_config.data_source_id)
                config_js_content["foundation"][mod_id] = {
                    "targetProjectId": target.project_id,
                    "targetDatasetId": target.dataset_id,
                    "sourceProjectId": source.project_id,
                    "sourceDatasetId": source.dataset_id,
                }

        product_modules = self.global_config.data.modules.product
        product_lookup = {m.module_id: m for m in product_modules if m.enabled}
        for prod_config in product_modules:
            if not prod_config.enabled:
                continue

            module_id = prod_config.module_id
            full_type = f"{prod_config._namespace}.{prod_config._module_type}"
            module_meta = self.module_registry.get(full_type)

            if not module_meta:
                _logger.error(f"Cannot process {module_id}: Unknown product type '{full_type}'.")
                return None

            manifest_config = module_meta["manifest"]
            module_meta["module_dir_name"]

            sources = {}
            for dep_key, dep_info in manifest_config.dependencies.items():
                expected_type = dep_info.type
                dep_module_id = prod_config.depends_on.get(dep_key)

                if not dep_module_id:
                    _logger.error(
                        "Product %s depends on %s but no module maps to it.",
                        module_id,
                        dep_key,
                    )
                    return None

                f_config = foundation_lookup.get(dep_module_id) or product_lookup.get(dep_module_id)
                if not f_config:
                    _logger.error(
                        "Product %s maps %s to module %s which is not enabled/exists.",
                        module_id,
                        dep_key,
                        dep_module_id,
                    )
                    return None

                # Compare using module types
                if f_config._module_type != expected_type:
                    _logger.error(
                        "Product %s dependency %s expects type %s, but module %s is type %s.",
                        module_id,
                        dep_key,
                        expected_type,
                        dep_module_id,
                        f_config._module_type,
                    )
                    return None

                if expected_type == ModuleType.SAP:
                    if not isinstance(f_config, SAPModuleConfig):
                        _logger.error(
                            "Product %s expects type SAP for %s, but module %s is not a "
                            "SAP module config.",
                            module_id,
                            dep_key,
                            dep_module_id,
                        )
                        return None
                    f_sap_version = f_config.module_settings.sap_version
                    if f_sap_version not in dep_info.supported_versions:
                        _logger.error(
                            "Product %s dependency %s requires one of %s, but module %s is "
                            "configured for %s.",
                            module_id,
                            dep_key,
                            [v.value for v in dep_info.supported_versions],
                            dep_module_id,
                            f_sap_version.value,
                        )
                        return None

                if isinstance(f_config, DataFoundationModuleConfig) and f_config.external:
                    f_source = self.global_config.get_data_source(f_config.data_source_id)
                    sources[dep_key] = {
                        "projectId": f_source.project_id,
                        "datasetId": f_source.dataset_id,
                    }
                else:
                    if not f_config.data_target_id:
                        raise ValueError(f"dataTargetId is missing for module {f_config.module_id}")
                    f_target = self.global_config.get_data_target(f_config.data_target_id)
                    sources[dep_key] = {
                        "projectId": f_target.project_id,
                        "datasetId": f_target.dataset_id,
                    }

            prod_target = self.global_config.get_data_target(prod_config.data_target_id)
            config_js_content["product"][module_id] = {
                "targetProjectId": prod_target.project_id,
                "targetDatasetId": prod_target.dataset_id,
                "sources": sources,
            }

        return config_js_content

    def _setup_workflow_and_credentials(self) -> None:
        """Sets up Dataform workflow settings and local credentials."""
        location = self.global_config.data.big_query_location
        src_workflow_settings = self.src_dir / "workflow_settings.yaml"
        dest_workflow_settings = self.output_dir / "workflow_settings.yaml"

        if src_workflow_settings.exists():
            settings_yaml = load_yaml(src_workflow_settings)
            settings_yaml["defaultLocation"] = location

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
            full_type = f"{prod_config._namespace}.{prod_config._module_type}"
            module_meta = self.module_registry.get(full_type)
            if not module_meta:
                continue

            manifest_config = module_meta["manifest"]
            for dep_key, dep_info in manifest_config.dependencies.items():
                foundation_id = prod_config.depends_on.get(dep_key)
                if foundation_id:
                    tables = dep_info.get_required_tables()
                    self.required_tables_by_foundation.setdefault(foundation_id, set()).update(
                        tables
                    )

        # Process foundation modules
        for mod_config in foundation_modules:
            if mod_config.enabled and not self._process_module(
                mod_config, ModuleCategory.FOUNDATION
            ):
                all_successful = False

        if not all_successful:
            _logger.error("Foundation build failed. Skipping product build.")
            return False

        # Process product modules
        for prod_config in product_modules:
            if prod_config.enabled and not self._process_module(
                prod_config, ModuleCategory.PRODUCT
            ):
                all_successful = False

        return all_successful

    def _process_module(self, module_config, category: ModuleCategory) -> bool:
        """Loads and executes a dynamic data module's builder.py."""
        context = self._get_module_context(module_config, category)
        if not context:
            return False

        plugin, out_dir, ann_dir, dir_name = context
        module_id = module_config.module_id
        full_type = f"{module_config._namespace}.{module_config._module_type}"
        module_meta = self.module_registry[full_type]

        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            table_settings_file = None
            if module_config.table_settings:
                path = pathlib.Path(module_config.table_settings)
                if path.is_absolute():
                    table_settings_file = path
                elif getattr(module_config, "_table_settings_explicit", False):
                    table_settings_file = self.config_dir / path
                else:
                    table_settings_file = self.base_dir / path

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

            if category == ModuleCategory.FOUNDATION and isinstance(plugin, FoundationBuilder):
                build_kwargs["required_tables"] = self.required_tables_by_foundation.get(
                    module_id, set()
                )
                is_valid_builder = True
            elif category == ModuleCategory.PRODUCT and isinstance(plugin, ProductBuilder):
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
                raise ValueError(f"Invalid project ID: {proj}")
            if not re.match(r"^[a-zA-Z0-9._-]+$", ds):
                raise ValueError(f"Invalid dataset ID: {ds}")

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
                raise ValueError(
                    f"Path traversal detected: {sources_file} is outside {self.output_dir}"
                )

            with open(sources_file, "w", encoding="utf-8") as f:
                for table in tables:
                    f.write(
                        f"declare({{\n"
                        f'  database: "{proj}",\n'
                        f'  schema: "{ds}",\n'
                        f'  name: "{table}"\n'
                        f"}});\n"
                    )

    def _get_builder(
        self,
        builder_name: str | None,
        namespace: str = "cortex",
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
        self, module_config, module_category: ModuleCategory
    ) -> tuple[Any, pathlib.Path, pathlib.Path, str] | None:
        """Resolves common module metadata and initializes the builder plugin."""
        module_id = module_config.module_id
        # Construct the full type from the namespace and module type for metadata lookup
        full_type = f"{module_config._namespace}.{module_config._module_type}"

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
            module_category.value,
            module_id,
            namespace,
            builder_name,
        )

        category_dir_name = module_category.value
        definitions_dir = self.output_dir / "definitions"
        module_output_dir = definitions_dir / category_dir_name / module_id
        module_annotations_dir = module_src_dir / "annotations"

        try:
            # Builders are now located at <namespace>.common.builders... or in module builder.py
            ns_path = module_meta.get("ns_path")
            local_module_path = f"{ns_path}.{category_dir_name}.{module_dir_name}.builder"
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

    config_file = args.config
    if not config_file.exists():
        _logger.error("Config file not found at %s", config_file)
        sys.exit(1)

    is_valid, validation_errors = ConfigValidator.validate(config_file)
    if not is_valid:
        _logger.error("Configuration validation failed with the following errors:")
        for err in validation_errors:
            _logger.error("  - %s", err)
        sys.exit(1)

    global_config_dict = load_yaml(config_file)
    global_config_dict = ConfigPreprocessor().process(global_config_dict)

    src_dir = pathlib.Path(__file__).resolve().parent.parent
    repo_root = src_dir.parent

    global_config = GlobalConfig.model_validate(
        global_config_dict, context={"config_dir": config_file.parent, "repo_root": repo_root}
    )

    checker = GcpEnvironmentChecker(
        global_config, enable_apis=args.enable_apis, create_datasets=args.create_datasets
    )
    if not checker.validate_all():
        _logger.error("GCP Environment checks failed. Aborting execution.")
        sys.exit(1)

    output_dir = args.output_dir
    if not output_dir.is_absolute():
        output_dir = pathlib.Path.cwd() / output_dir

    builder = DataformBuilder(
        global_config=global_config,
        output_dir=output_dir,
        base_dir=repo_root,
        config_dir=config_file.parent,
        assertions_path=args.assertions,
    )
    success = builder.build()
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
