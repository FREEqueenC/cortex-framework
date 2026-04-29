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

from collections.abc import Callable
from typing import Any

from common.builders.base import BaseBuilder


def find_namespace(module_name: str) -> str:
    """Helper to determine the namespace from a module's full name (e.g. 'cortex.common...')."""
    if "." in module_name:
        return module_name.split(".", 1)[0]
    return "fallback"


class Registry[T]:
    """A generic explicit registry for tracking and injecting implementation classes."""

    def __init__(self, name: str, expected_type: type[T] | None = None):
        self.name = name
        self.expected_type = expected_type
        self._registry: dict[tuple[str, str], type[T]] = {}
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

            # Automatically detect namespace if not provided
            ns = namespace or self._discovery_namespace or find_namespace(cls.__module__)
            key = (ns, name)

            if key in self._registry:
                raise ValueError(
                    f"Cannot register '{name}' twice in '{self.name}' registry "
                    f"for namespace '{ns}'."
                )
            self._registry[key] = cls
            return cls

        return wrapper

    def get(self, name: str, namespace: str | None = None) -> type[T] | None:
        """Retrieve a registered class by name and namespace."""
        if namespace is not None:
            return self._registry.get((namespace, name))

        for (_ns, n), cls in self._registry.items():
            if n == name:
                return cls
        return None


builder_registry = Registry("builders", expected_type=BaseBuilder)
deployer_registry: Registry[Any] = Registry("deployers")


def auto_discover_plugins(package_path: str):
    """Safely auto-loads all plugins in a given package to trigger their decorators.

    Args:
        package_path: The dot-separated path to the package (e.g., 'cortex.common.builders').
    """
    import importlib
    import logging

    logger = logging.getLogger(__name__)

    try:
        package = importlib.import_module(package_path)
        if hasattr(package, "__path__"):
            from pathlib import Path

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
                        logger.warning(
                            "Could not auto-import plugin module %s: %s",
                            full_module_name,
                            e,
                        )
    except ImportError as e:
        logger.warning(
            "Could not auto-discover plugins in package %s: %s",
            package_path,
            e,
        )
