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

from typing import Annotated, Any, Literal

import pydantic
from pydantic import alias_generators

from .enums import ModuleType, SapVersion


class SapVersionDependencies(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    s4: list[str] | None = None
    ecc: list[str] | None = None
    common: list[str] | None = None

    @pydantic.model_validator(mode="after")
    def check_at_least_one_and_must_be_non_empty(self) -> "SapVersionDependencies":
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
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: Literal[ModuleType.SAP]
    tables: SapVersionDependencies
    supported_versions: list[SapVersion]

    @pydantic.model_validator(mode="after")
    def validate_tables_match_versions(self) -> "SapDependencyInfo":
        if self.tables.ecc and SapVersion.ECC not in self.supported_versions:
            raise ValueError(
                "Dependency provides ECC tables, but ECC is not in supported_versions."
            )
        if self.tables.s4 and SapVersion.S4 not in self.supported_versions:
            raise ValueError("Dependency provides S4 tables, but S4 is not in supported_versions.")
        return self

    def get_required_tables(self) -> list[str]:
        req_tables = []
        if self.tables.common:
            req_tables.extend(self.tables.common)
        if self.tables.ecc:
            req_tables.extend(self.tables.ecc)
        if self.tables.s4:
            req_tables.extend(self.tables.s4)
        return req_tables


class GenericDependencyInfo(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: Literal[ModuleType.GENERIC]
    tables: list[str]

    @pydantic.field_validator("tables")
    @classmethod
    def must_not_be_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("tables list cannot be empty")
        return v

    def get_required_tables(self) -> list[str]:
        return self.tables


DependencyType = Annotated[
    SapDependencyInfo | GenericDependencyInfo,
    pydantic.Field(discriminator="type"),
]


class ManifestConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: str | None = None
    dependencies: dict[str, DependencyType] = pydantic.Field(default_factory=dict)
    builder: str | None = None

    @pydantic.model_validator(mode="before")
    @classmethod
    def handle_namespaced_dependencies(cls, data: Any) -> Any:
        if isinstance(data, dict) and "dependencies" in data:
            for _dep_name, dep_data in data["dependencies"].items():
                if isinstance(dep_data, dict) and "type" in dep_data:
                    full_type = dep_data["type"]
                    if "." in full_type:
                        namespace, module_type = full_type.split(".", 1)
                        dep_data["type"] = module_type
        return data
