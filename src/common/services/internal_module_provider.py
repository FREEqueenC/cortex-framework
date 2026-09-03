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

"""Service provider for discovering internal modules and table metadata on disk."""

import logging
import pathlib
import threading
from collections.abc import Sequence
from typing import Any

from common.schemas.manifest_schema import ManifestConfig
from common.services.base_module_provider import LocalWorkspaceProvider
from common.utils.file_utils import load_yaml

logger = logging.getLogger(__name__)


class InternalModuleProvider(LocalWorkspaceProvider):
    """Discovers and caches internal modules and table metadata from the filesystem."""

    def __init__(
        self,
        namespaces: Sequence[Any],
        config_dir: pathlib.Path | None = None,
    ):
        """Initializes the internal module provider.

        Args:
            namespaces: A sequence of NamespaceConfig instances.
            config_dir: Optional path to the directory containing config.yaml.
        """
        self.namespaces = namespaces
        self.config_dir = config_dir or pathlib.Path.cwd()
        self._discovered: bool = False
        self._module_types: set[str] = set()
        self._module_dirs: dict[str, pathlib.Path] = {}
        self._manifests: dict[str, ManifestConfig] = {}
        self._tables_cache: dict[str, set[str]] = {}
        self._lock = threading.RLock()

    def discover_modules(self, force_refresh: bool = False) -> None:
        """Discovers all internal modules by scanning namespace directories on disk.

        Args:
            force_refresh: If True, rescans the filesystem even if already cached.
        """
        with self._lock:
            if self._discovered and not force_refresh:
                return

            self._module_types = set()
            self._module_dirs = {}
            self._manifests = {}
            self._tables_cache = {}

            for ns in self.namespaces:
                # If we just passed NamespaceConfig objects, we use resolve_path.
                ns_path = ns.resolve_path(self.config_dir)

                if not ns_path.exists():
                    logger.warning(
                        "Namespace path '%s' for namespace '%s' does not exist. Skipping.",
                        ns_path,
                        ns.name,
                    )
                    continue

                # Scan for manifest.yaml recursively under namespace root:
                for manifest_file in ns_path.rglob("manifest.yaml"):
                    rel_path = manifest_file.relative_to(ns_path)
                    # Skip hidden directories starting with '.' (like .git or .agents)
                    if any(part.startswith(".") for part in rel_path.parts):
                        continue

                    rel_parts = rel_path.parent.parts
                    if not rel_parts:
                        continue

                    module_type = f"{ns.name}." + ".".join(rel_parts)

                    try:
                        manifest_data = load_yaml(manifest_file)
                        manifest_config = ManifestConfig(**manifest_data)

                        leaf_dir_name = rel_parts[-1] if rel_parts else ""
                        if manifest_config.type != leaf_dir_name:
                            raise ValueError(
                                f"Module type mismatch at '{manifest_file}': manifest type"
                                f" '{manifest_config.type}' does not match leaf directory name"
                                f" '{leaf_dir_name}'."
                            )

                        self._module_types.add(module_type)
                        self._module_dirs[module_type] = manifest_file.parent
                        self._manifests[module_type] = manifest_config
                        logger.debug("Discovered internal module type: %s", module_type)
                    except Exception as e:
                        logger.warning("Failed to load manifest at '%s': %s", manifest_file, e)

            self._discovered = True

    def resolve_module_by_path(self, module_path: str) -> ManifestConfig | None:
        """Attempts guided discovery of a module by directly resolving its
        module_path to a directory.

        Args:
            module_path: Dot-delimited namespaced path string
                (e.g. 'cortex.sap.products.addresses').

        Returns:
            Parsed ManifestConfig if found and valid, or None if not found.
        """
        with self._lock:
            if module_path in self._module_dirs:
                return self._manifests.get(module_path)

            if not module_path or "." not in module_path:
                return None

            parts = module_path.split(".")
            ns_name = parts[0]
            rel_parts = parts[1:]

            # Validate that each relative path segment is safe
            for part in rel_parts:
                if not part or part in (".", "..") or "/" in part or "\\" in part:
                    logger.warning(
                        "Invalid or suspicious path segment '%s' in module path '%s'",
                        part,
                        module_path,
                    )
                    return None

            matching_ns = next(
                (ns for ns in self.namespaces if getattr(ns, "name", None) == ns_name), None
            )
            if not matching_ns:
                return None

            ns_path = matching_ns.resolve_path(self.config_dir)
            target_dir = ns_path.joinpath(*rel_parts)

            # Ensure target_dir resides safely within ns_path root
            try:
                resolved_target = target_dir.resolve()
                resolved_ns = ns_path.resolve()
                resolved_target.relative_to(resolved_ns)
            except (ValueError, RuntimeError):
                logger.warning(
                    "Path traversal attempt detected or target outside namespace root: '%s'",
                    module_path,
                )
                return None

            manifest_file = target_dir / "manifest.yaml"

            if not manifest_file.exists():
                return None

            try:
                manifest_data = load_yaml(manifest_file)
                manifest_config = ManifestConfig(**manifest_data)

                leaf_dir_name = target_dir.name
                if manifest_config.type != leaf_dir_name:
                    raise ValueError(
                        f"Module path '{module_path}' manifest type '{manifest_config.type}' "
                        f"does not match leaf directory name '{leaf_dir_name}'."
                    )

                self._module_types.add(module_path)
                self._module_dirs[module_path] = target_dir
                self._manifests[module_path] = manifest_config

                logger.debug(
                    "Guided discovery found internal module at '%s': %s", target_dir, module_path
                )
                return manifest_config
            except Exception as e:
                logger.warning("Failed guided discovery for manifest at '%s': %s", manifest_file, e)
                return None

    def get_module_types(self) -> set[str]:
        """Returns all valid module type identifiers provided by this instance."""
        with self._lock:
            self.discover_modules()
            return set(self._module_types)

    def get_module_dir(self, module_type: str) -> pathlib.Path:
        """Returns the physical directory for a discovered internal module type."""
        with self._lock:
            if module_type in self._module_dirs:
                return self._module_dirs[module_type]

            if self.resolve_module_by_path(module_type):
                return self._module_dirs[module_type]

            self.discover_modules()
            if module_type not in self._module_dirs:
                raise KeyError(f"Module '{module_type}' not found in internal provider.")
            return self._module_dirs[module_type]

    def get_manifest(self, module_type: str) -> ManifestConfig:
        """Returns the parsed ManifestConfig for a discovered internal module type."""
        with self._lock:
            if module_type in self._manifests:
                return self._manifests[module_type]

            if self.resolve_module_by_path(module_type):
                return self._manifests[module_type]

            self.discover_modules()
            if module_type not in self._manifests:
                raise KeyError(f"Module '{module_type}' not found in internal provider.")
            return self._manifests[module_type]

    def get_tables_for_module(
        self,
        module_type: str,
        table_settings_path: pathlib.Path | None = None,
    ) -> set[str]:
        """Returns physical table names discovered within the given module type.

        Args:
            module_type: The module type identifier (e.g. cortex.sap.foundations.sap).
            table_settings_path: Optional path to a custom table settings file.
                                 If omitted, resolves the default table_settings.default.yaml.
        """
        with self._lock:
            self.discover_modules()
            if module_type not in self._module_dirs:
                raise KeyError(f"Module '{module_type}' not found in internal provider.")

            if not table_settings_path:
                table_settings_path = self._module_dirs[module_type] / "table_settings.default.yaml"

            if not table_settings_path.exists():
                logger.warning(
                    "Table settings file '%s' for module type '%s' does not exist.",
                    table_settings_path,
                    module_type,
                )
                return set()

            cache_key = str(table_settings_path)
            if cache_key in self._tables_cache:
                return set(self._tables_cache[cache_key])

            try:
                settings_data = load_yaml(table_settings_path)

                enabled_tables: set[str] = set()
                for _section, items in settings_data.items():
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                src = item.get("source", {})
                                tgt = item.get("target", {})
                                for name in [
                                    tgt.get("tableName") if isinstance(tgt, dict) else None,
                                    src.get("sapTableName") if isinstance(src, dict) else None,
                                    src.get("tableName") if isinstance(src, dict) else None,
                                ]:
                                    if name:
                                        enabled_tables.add(name.lower())
                    elif isinstance(items, dict):
                        for t_name, item_val in items.items():
                            if isinstance(item_val, dict):
                                if item_val.get("enabled", True):
                                    enabled_tables.add(t_name.lower())
                            else:
                                enabled_tables.add(t_name.lower())

                self._tables_cache[cache_key] = enabled_tables
                return set(enabled_tables)
            except Exception as e:
                raise RuntimeError(
                    f"Failed to parse table settings file '{table_settings_path}': {e}"
                ) from e
