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

"""Configuration schema models for module manifests."""

from typing import Annotated, Any

import pydantic
from pydantic import Discriminator, StringConstraints, Tag, alias_generators

from .enums import ModuleCategory, SapVersion

NonEmptyString = Annotated[str, StringConstraints(min_length=1)]


class SapVersionDependencies(pydantic.BaseModel):
    """Schema representing required table lists partitioned by SAP version."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=False,
    )
    s4: list[str] | None = None
    ecc: list[str] | None = None
    common: list[str] | None = None

    @pydantic.model_validator(mode="after")
    def check_at_least_one_and_must_be_non_empty(self) -> "SapVersionDependencies":
        """Validates that at least one version section is specified and not empty.

        Returns:
            Validated SapVersionDependencies instance.
        """
        if not (self.s4 or self.ecc or self.common):
            raise ValueError(
                "SAP version dependencies require 's4', 'ecc', or 'common' to be specified"
            )
        if self.s4 is not None and not self.s4:
            raise ValueError("'s4' list cannot be empty if specified")
        if self.ecc is not None and not self.ecc:
            raise ValueError("'ecc' list cannot be empty if specified")
        if self.common is not None and not self.common:
            raise ValueError("'common' list cannot be empty if specified")
        return self


class SapDependencyInfo(pydantic.BaseModel):
    """Dependency descriptor for SAP foundational modules."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=False,
    )
    module_path: str
    tables: SapVersionDependencies
    supported_versions: list[SapVersion]

    @pydantic.model_validator(mode="after")
    def validate_tables_match_versions(self) -> "SapDependencyInfo":
        """Ensures table definitions correspond to the declared supported SAP versions.

        Returns:
            Validated SapDependencyInfo instance.
        """
        if self.tables.ecc and SapVersion.ECC not in self.supported_versions:
            raise ValueError(
                "Dependency provides ECC tables, but ECC is not in supported_versions."
            )
        if self.tables.s4 and SapVersion.S4 not in self.supported_versions:
            raise ValueError("Dependency provides S4 tables, but S4 is not in supported_versions.")
        return self

    def get_required_tables(self) -> list[str]:
        """Returns a consolidated list of all required table names across SAP versions.

        Returns:
            List of table names required by this dependency across all versions.
        """
        req_tables = []
        if self.tables.common:
            req_tables.extend(self.tables.common)
        if self.tables.ecc:
            req_tables.extend(self.tables.ecc)
        if self.tables.s4:
            req_tables.extend(self.tables.s4)
        return req_tables


class GenericDependencyInfo(pydantic.BaseModel):
    """Dependency descriptor for generic non-SAP foundational modules."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=False,
    )
    module_path: str
    tables: list[str]

    @pydantic.field_validator("tables")
    @classmethod
    def must_not_be_empty(cls, v: list[str]) -> list[str]:
        """Validates that the tables list contains at least one item.

        Args:
            v: List of table names to validate.

        Returns:
            Validated list of table names.
        """
        if not v:
            raise ValueError("tables list cannot be empty")
        return v

    def get_required_tables(self) -> list[str]:
        """Returns the list of required tables for this generic dependency.

        Returns:
            List of table names required by this dependency.
        """
        return self.tables


class ModuleDependencyInfo(pydantic.BaseModel):
    """Dependency descriptor for general product or catalog modules."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=False,
    )
    module_path: str
    tables: list[str] | None = None

    def get_required_tables(self) -> list[str]:
        """Returns the list of required tables, or an empty list if omitted.

        Returns:
            List of table names required by this dependency.
        """
        return self.tables or []


def get_dependency_type_tag(v: Any) -> str:
    """Discriminator helper to route dependency descriptors to the appropriate schema model.

    Args:
        v: Dictionary or model instance representing the dependency descriptor.

    Returns:
        Discriminator tag string ('sap', 'generic', or 'module').
    """
    if isinstance(v, dict):
        if "supportedVersions" in v or "supported_versions" in v:
            return "sap"
        elif "tables" in v and isinstance(v["tables"], list):
            return "generic"
    return "module"


DependencyType = Annotated[
    Annotated[SapDependencyInfo, Tag("sap")]
    | Annotated[GenericDependencyInfo, Tag("generic")]
    | Annotated[ModuleDependencyInfo, Tag("module")],
    Discriminator(get_dependency_type_tag),
]


class ManifestConfig(pydantic.BaseModel):
    """Root configuration model for a module's manifest.yaml."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=False,
    )
    type: NonEmptyString
    category: ModuleCategory
    dependencies: dict[str, DependencyType] = pydantic.Field(default_factory=dict)
    builder: str | None = None
    display_name: str | None = None
    description: str | None = None
    documentation: str | None = None
