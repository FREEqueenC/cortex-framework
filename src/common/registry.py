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

"""Central explicit pattern registry for Cortex Framework."""

import importlib
import inspect
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from common.builders.base import BaseBuilder

_logger = logging.getLogger(__name__)


class Registry[T]:
    """A generic explicit registry for tracking and injecting implementation classes."""

    def __init__(self, name: str, expected_type: type[T] | None = None):
        self.name = name
        self.expected_type = expected_type
        self._registry: dict[str | tuple[str, str], type[T]] = {}
        self._discovery_namespace: str | None = None

    def set_discovery_namespace(self, namespace: str | None):
        """Sets the current namespace during plugin dynamic discovery scan."""
        self._discovery_namespace = namespace

    def register(self, name: str, namespace: str | None = None) -> Callable[[type[T]], type[T]]:
        """Decorator to register a class with a specific name and namespace."""

        def wrapper(cls: type[T]) -> type[T]:
            if self.expected_type and not issubclass(cls, self.expected_type):
                raise TypeError(
                    f"Cannot register '{cls.__name__}' in '{self.name}' registry: "
                    f"must be a subclass of {self.expected_type.__name__}"
                )

            # Determine namespace (None or empty string means empty namespace)
            ns = namespace or self._discovery_namespace

            # If no namespace is specified, register as flat string key (no namespace)
            if not ns:
                key: str | tuple[str, str] = name
            else:
                key = (ns, name)

            if key in self._registry:
                existing_cls = self._registry[key]
                try:
                    if existing_cls.__name__ == cls.__name__ and inspect.getfile(
                        existing_cls
                    ) == inspect.getfile(cls):
                        return cls
                except Exception:
                    pass

                ns_desc = f"namespace '{ns}'" if ns else "no namespace"
                raise ValueError(
                    f"Cannot register '{name}' twice in '{self.name}' registry for {ns_desc}."
                )
            self._registry[key] = cls
            return cls

        return wrapper

    def get(self, name: str, namespace: str | None = None) -> type[T] | None:
        """Retrieve a registered class by name and namespace."""
        # 1. Try namespaced lookup if namespace is provided
        if namespace:
            cls = self._registry.get((namespace, name))
            if cls is not None:
                return cls

        # 2. Try empty namespace lookup (flat string key)
        cls = self._registry.get(name)
        if cls is not None:
            return cls

        # 3. If no namespace was requested, scan to find first matching class
        if not namespace:
            matches: list[tuple[str | None, type[T]]] = []
            for key, cls in self._registry.items():
                if isinstance(key, tuple):
                    if key[1] == name:
                        matches.append((key[0], cls))
                elif key == name:
                    matches.append((None, cls))

            if len(matches) > 1:
                _logger.warning(
                    "Ambiguous lookup for '%s' in '%s' registry. "
                    "Multiple matches found in namespaces: %s. Returning the first one.",
                    name,
                    self.name,
                    [f"'{ns}'" if ns else "no namespace" for ns, _ in matches],
                )

            if matches:
                return matches[0][1]

        return None


def auto_discover_plugins(package_path: str):
    """Safely auto-loads all plugins in a given package to trigger their decorators.

    Args:
        package_path: The dot-separated path to the package (e.g., 'cortex.common.builders').
    """
    try:
        package = importlib.import_module(package_path)
        if hasattr(package, "__path__"):
            for path_str in package.__path__:
                path = Path(path_str)
                for py_file in path.rglob("*.py"):
                    if py_file.name == "__init__.py":
                        continue
                    relative_path = py_file.relative_to(path)
                    module_name = relative_path.with_suffix("").as_posix().replace("/", ".")
                    full_module_name = f"{package_path}.{module_name}"
                    try:
                        importlib.import_module(full_module_name)
                    except ImportError as e:
                        _logger.warning(
                            "Could not auto-import plugin module %s: %s",
                            full_module_name,
                            e,
                        )
    except ImportError as e:
        # Suppress noisy warnings for optional namespace folders
        if isinstance(e, ModuleNotFoundError) and e.name and package_path.startswith(e.name):
            _logger.debug("Optional plugin package %s not found. Skipping discovery.", package_path)
            return
        _logger.warning(
            "Could not auto-discover plugins in package %s: %s",
            package_path,
            e,
        )


builder_registry = Registry("builders", expected_type=BaseBuilder)
deployer_registry: Registry[Any] = Registry("deployers")
