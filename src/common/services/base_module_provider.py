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

"""Abstract base class and interface for module discovery and metadata providers."""

import abc
import pathlib

from common.schemas.manifest_schema import ManifestConfig


class BaseModuleProvider(abc.ABC):
    """Abstract base class representing a module metadata provider."""

    @abc.abstractmethod
    def get_module_types(self) -> set[str]:
        """Returns all valid module type identifiers provided by this instance."""
        pass

    @abc.abstractmethod
    def get_tables_for_module(
        self,
        module_type: str,
        table_settings_path: pathlib.Path | None = None,
    ) -> set[str]:
        """Returns physical table names discovered within the given module type.

        Args:
            module_type: The module type identifier.
            table_settings_path: Optional path to a custom table settings file.
                                 If omitted, the provider should resolve the default settings.

        Returns:
            A set of physical table names.
        """
        pass

    def get_provided_types_for_module(self, module_type: str) -> list[str]:
        """Returns the logical types provided by a given virtual module type."""
        return []

    def is_valid_module_type(self, module_type: str) -> bool:
        """Checks if a module type identifier is valid.

        Args:
            module_type: The module type identifier.

        Returns:
            True if the module type is valid, False otherwise.
        """
        return module_type in self.get_module_types()


class LocalWorkspaceProvider(BaseModuleProvider):
    """Explicit interface for providers that manage local workspaces and manifests."""

    @abc.abstractmethod
    def get_manifest(self, module_type: str) -> ManifestConfig | None:
        """Returns the ManifestConfig for a given module type."""
        pass

    @abc.abstractmethod
    def get_module_dir(self, module_type: str) -> pathlib.Path | None:
        """Returns the physical directory for a given module type."""
        pass
