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

"""Unified service provider aggregating metadata from internal and external sources."""

import logging
import pathlib

from common.schemas.manifest_schema import ManifestConfig
from common.services.base_module_provider import LocalWorkspaceProvider
from common.services.external_module_provider import ExternalModuleProvider
from common.services.internal_module_provider import InternalModuleProvider

logger = logging.getLogger(__name__)


class UnifiedModuleProvider(LocalWorkspaceProvider):
    """Combines metadata from internal files and external BigLake Delta Sharing shares."""

    def __init__(
        self,
        internal_provider: InternalModuleProvider,
        external_provider: ExternalModuleProvider,
    ):
        """Initializes the unified module provider.

        Args:
            internal_provider: Discovers local workspace modules.
            external_provider: Discovers external catalog shared tables.
        """
        self.internal_provider = internal_provider
        self.external_provider = external_provider

    def get_module_types(self) -> set[str]:
        """Returns the union of all internal and external virtual module types."""
        return self.internal_provider.get_module_types() | self.external_provider.get_module_types()

    def resolve_catalog_schema(self, dep_binding: str):
        """Resolves a 2-part or 3-part catalog dependency binding."""
        return self.external_provider.resolve_catalog_schema(dep_binding)

    def is_valid_module_type(self, module_type: str) -> bool:
        """Checks if a module type identifier is valid in internal or external providers."""
        return (
            module_type in self.get_module_types()
            or self.external_provider.is_valid_module_type(module_type)
        )

    def get_tables_for_module(
        self,
        module_type: str,
        table_settings_path: pathlib.Path | None = None,
    ) -> set[str]:
        """Returns the physical tables managed by the module, checking internal first.

        Args:
            module_type: The logical or virtual module type identifier.
            table_settings_path: Optional custom table settings path (only for internal).
        """
        if module_type in self.internal_provider.get_module_types():
            return self.internal_provider.get_tables_for_module(module_type, table_settings_path)
        elif self.external_provider.is_valid_module_type(module_type):
            return self.external_provider.get_tables_for_module(module_type, table_settings_path)
        else:
            logger.debug(
                "Module type '%s' not found in internal or external providers.",
                module_type,
            )
            return set()

    def get_provided_types_for_module(self, module_type: str) -> list[str]:
        """Returns the logical types provided by a virtual module type."""
        return self.external_provider.get_provided_types_for_module(module_type)

    def get_module_dir(self, module_type: str) -> pathlib.Path | None:
        """Returns the physical directory for an internal module type."""
        if module_type in self.internal_provider.get_module_types():
            return self.internal_provider.get_module_dir(module_type)
        return None

    def get_manifest(self, module_type: str) -> ManifestConfig | None:
        """Returns the ManifestConfig for an internal module type."""
        if module_type in self.internal_provider.get_module_types():
            return self.internal_provider.get_manifest(module_type)
        return None
