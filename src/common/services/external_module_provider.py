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

"""Service provider for discovering external BigLake Delta Sharing catalog metadata."""

import logging
import pathlib
from collections.abc import Sequence
from typing import NamedTuple

from common.clients.lakehouse import BigLakeDeltaSharingClient
from common.errors import CortexConfigError
from common.schemas.config_schema import CatalogConfig
from common.services.base_module_provider import BaseModuleProvider
from common.utils.id_utils import sanitize_bq_identifier

logger = logging.getLogger(__name__)


class CatalogTableMetadata(NamedTuple):
    """Normalized metadata for a physical table discovered in an external catalog."""

    catalog_project: str
    internal_catalog_id: str
    physical_catalog_id: str
    share_name: str
    schema_name: str
    table_name: str

    @property
    def share_catalog_name(self) -> str:
        """Backward-compatible alias for physical_catalog_id."""
        return self.physical_catalog_id


class ResolvedCatalogSchema(NamedTuple):
    """Resolved physical and logical coordinates for a catalog schema."""

    project_id: str
    internal_catalog_id: str
    physical_catalog_id: str
    share_id: str
    schema_name: str

    @property
    def physical_dataset_id(self) -> str:
        """Returns the 3-part physical dataset ID for Dataform and BigQuery."""
        return f"{self.physical_catalog_id}.{self.share_id}.{self.schema_name}"


class ExternalModuleProvider(BaseModuleProvider):
    """Discovers and caches external BigLake Delta Sharing module and table metadata."""

    def __init__(
        self,
        catalogs: Sequence[CatalogConfig],
        client: BigLakeDeltaSharingClient | None = None,
    ):
        """Initializes the external module provider.

        Args:
            catalogs: A sequence of catalog module configurations.
            client: Optional pre-initialized BigLakeDeltaSharingClient.
        """
        self.catalogs = [c for c in catalogs if c.enabled]
        self._client = client
        self._metadata_cache: list[CatalogTableMetadata] | None = None
        self._virtual_module_map: dict[str, set[str]] | None = None
        self._virtual_module_provides_map: dict[str, list[str]] | None = None
        self._catalog_schema_shares: (
            dict[tuple[str, str], dict[str, ResolvedCatalogSchema]] | None
        ) = None
        self._resolved_map_by_3part: dict[tuple[str, str, str], ResolvedCatalogSchema] | None = None

    @property
    def client(self) -> BigLakeDeltaSharingClient:
        """Lazy-loaded client for BigLake Delta Sharing REST API."""
        if self._client is None:
            self._client = BigLakeDeltaSharingClient()
        return self._client

    def fetch_all_metadata(self, force_refresh: bool = False) -> Sequence[CatalogTableMetadata]:
        """Fetches normalized metadata for all tables in enabled catalogs.

        Args:
            force_refresh: If True, bypasses cache and queries the REST API again.

        Returns:
            A sequence of CatalogTableMetadata records across all shares and schemas.
        """
        if self._metadata_cache is not None and not force_refresh:
            return self._metadata_cache

        records: list[CatalogTableMetadata] = []
        vmap: dict[str, set[str]] = {}
        prov_map: dict[str, list[str]] = {}
        schema_shares: dict[tuple[str, str], dict[str, ResolvedCatalogSchema]] = {}
        resolved_schemas_by_3part: dict[tuple[str, str, str], ResolvedCatalogSchema] = {}

        for catalog in self.catalogs:
            internal_id = catalog.id
            conn = catalog.connection_settings
            project_id = conn.project_id
            location = conn.location
            physical_catalog_id = conn.catalog_id
            binds_namespaces = catalog.binds_namespaces

            logger.info("Discovering external tables for catalog '%s'", internal_id)
            for share_cfg in conn.shares:
                raw_share_id = share_cfg.share_id
                sanitized_share_id = share_cfg.sanitized_share_id
                schemas = self.client.list_schemas(
                    project=project_id,
                    location=location,
                    catalog=physical_catalog_id,
                    share=raw_share_id,
                )
                for schema_item in schemas:
                    raw_schema_name = str(schema_item.get("name", ""))
                    if "/" in raw_schema_name:
                        raw_schema_name = raw_schema_name.split("/")[-1]
                    if not raw_schema_name:
                        continue
                    sanitized_schema_name = sanitize_bq_identifier(raw_schema_name.lower())

                    resolved = ResolvedCatalogSchema(
                        project_id=project_id,
                        internal_catalog_id=internal_id,
                        physical_catalog_id=physical_catalog_id,
                        share_id=sanitized_share_id,
                        schema_name=sanitized_schema_name,
                    )

                    schema_shares.setdefault((internal_id, sanitized_schema_name), {})[
                        sanitized_share_id
                    ] = resolved

                    # Detect identifier squashing collisions
                    if (
                        internal_id,
                        sanitized_share_id,
                        sanitized_schema_name,
                    ) in resolved_schemas_by_3part:
                        raise CortexConfigError(
                            f"Identifier collision detected in catalog '{internal_id}'. "
                            f"Multiple schemas mapped to the same sanitized identifier: "
                            f"'{sanitized_share_id}.{sanitized_schema_name}'."
                        )
                    resolved_schemas_by_3part[
                        (internal_id, sanitized_share_id, sanitized_schema_name)
                    ] = resolved

                    tables = self.client.list_tables(
                        project=project_id,
                        location=location,
                        catalog=physical_catalog_id,
                        share=raw_share_id,
                        schema_id=sanitized_schema_name,
                    )
                    for table_item in tables:
                        table_name = str(table_item.get("name", ""))
                        if "/" in table_name:
                            table_name = table_name.split("/")[-1]
                        if not table_name:
                            continue
                        table_name = table_name.lower()

                        records.append(
                            CatalogTableMetadata(
                                catalog_project=project_id,
                                internal_catalog_id=internal_id,
                                physical_catalog_id=physical_catalog_id,
                                share_name=sanitized_share_id,
                                schema_name=sanitized_schema_name,
                                table_name=table_name,
                            )
                        )

                        # 3-part key
                        mod_3part = f"{internal_id}.{sanitized_share_id}.{sanitized_schema_name}"
                        vmap.setdefault(mod_3part, set()).add(table_name)
                        prov_map[mod_3part] = [
                            f"{ns}.{sanitized_schema_name}" for ns in binds_namespaces
                        ]

        self._metadata_cache = records
        self._virtual_module_map = vmap
        self._virtual_module_provides_map = prov_map
        self._catalog_schema_shares = schema_shares
        self._resolved_map_by_3part = resolved_schemas_by_3part
        return self._metadata_cache

    def resolve_catalog_schema(self, dep_binding: str) -> ResolvedCatalogSchema | None:
        """Resolves a 2-part or 3-part catalog dependency binding.

        Args:
            dep_binding: Dependency string (<internalId>.<schema> or
              <internalId>.<share>.<schema>).

        Returns:
            ResolvedCatalogSchema object if resolved, None if not matching any
            catalog.

        Raises:
            CortexConfigError: If a 2-part schema is ambiguous across multiple
            shares.
        """
        self.fetch_all_metadata()
        assert self._catalog_schema_shares is not None
        assert self._resolved_map_by_3part is not None

        parts = dep_binding.split(".")
        if len(parts) == 2:
            internal_id = parts[0]
            schema_name = sanitize_bq_identifier(parts[1].lower())
            shares_dict = self._catalog_schema_shares.get((internal_id, schema_name), {})
            if not shares_dict:
                return None
            if len(shares_dict) > 1:
                shares_list = sorted(list(shares_dict.keys()))
                sample_share = shares_list[0]
                raise CortexConfigError(
                    f"Schema '{schema_name}' in catalog '{internal_id}' is ambiguous as"
                    f" it exists in multiple shares: {shares_list}.",
                    hint=(
                        "Please use the 3-part syntax"
                        " '<internalCatalogId>.<shareId>.<schemaName>'"
                        f" (e.g., '{internal_id}.{sample_share}.{schema_name}') in"
                        " dependencyBindings to disambiguate."
                    ),
                )
            return next(iter(shares_dict.values()))
        elif len(parts) == 3:
            internal_id = parts[0]
            share_id = sanitize_bq_identifier(parts[1])
            schema_name = sanitize_bq_identifier(parts[2].lower())
            return self._resolved_map_by_3part.get((internal_id, share_id, schema_name))
        return None

    def is_valid_module_type(self, module_type: str) -> bool:
        """Checks if a 2-part or 3-part virtual module type is valid."""
        try:
            return self.resolve_catalog_schema(module_type) is not None
        except CortexConfigError:
            return True

    def get_module_types(self) -> set[str]:
        """Returns the unique set of virtual module types."""
        self.fetch_all_metadata()
        assert self._virtual_module_map is not None
        return set(self._virtual_module_map.keys())

    def get_tables_for_module(
        self,
        module_type: str,
        table_settings_path: pathlib.Path | None = None,
    ) -> set[str]:
        """Returns the set of physical table names for a given virtual module type."""
        resolved = self.resolve_catalog_schema(module_type)
        if resolved:
            mod_3part = f"{resolved.internal_catalog_id}.{resolved.share_id}.{resolved.schema_name}"
            assert self._virtual_module_map is not None
            return set(self._virtual_module_map.get(mod_3part, set()))

        self.fetch_all_metadata()
        assert self._virtual_module_map is not None
        return set(self._virtual_module_map.get(module_type, set()))

    def get_provided_types_for_module(self, module_type: str) -> list[str]:
        """Returns the logical types provided by a given virtual module type."""
        resolved = self.resolve_catalog_schema(module_type)
        if resolved:
            mod_3part = f"{resolved.internal_catalog_id}.{resolved.share_id}.{resolved.schema_name}"
            assert self._virtual_module_provides_map is not None
            return self._virtual_module_provides_map.get(mod_3part, [])

        self.fetch_all_metadata()
        assert self._virtual_module_provides_map is not None
        return self._virtual_module_provides_map.get(module_type, [])
