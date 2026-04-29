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

"""Configuration schema models for table_settings.yaml."""

import pydantic
from pydantic import alias_generators

from .enums import MaterializationType, PartitionType


class BaseSchemaModel(pydantic.BaseModel):
    """Base model with camelCase alias support for YAML loads."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )


class PartitionDetails(BaseSchemaModel):
    column: str
    partition_type: PartitionType
    time_grain: str | None = None
    range_start: int | None = None
    range_end: int | None = None
    range_interval: int | None = None


class ClusterDetails(BaseSchemaModel):
    columns: list[str]


# --- Data Product Style ---
class ProductTableItem(BaseSchemaModel):
    """Item descriptor schema for Data Products."""

    materialization_type: MaterializationType = MaterializationType.INCREMENTAL
    tags: list[str] = pydantic.Field(default_factory=list)
    cluster_details: ClusterDetails | None = None
    partition_details: PartitionDetails | None = None

    # Include extra config allowances to pass arbitrary properties into spread.
    model_config = pydantic.ConfigDict(
        extra="allow",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )


class ProductTableSettings(BaseSchemaModel):
    """Root payload config definition schema block for Data Products."""

    ecc: dict[str, ProductTableItem] = pydantic.Field(default_factory=dict)
    s4: dict[str, ProductTableItem] = pydantic.Field(default_factory=dict)
    common: dict[str, ProductTableItem] = pydantic.Field(default_factory=dict)


# --- Data Foundation Style ---
class FoundationSource(BaseSchemaModel):
    table_name: str


class FoundationTarget(BaseSchemaModel):
    """Publish targeting settings for Data Foundation."""

    tags: list[str] = pydantic.Field(default_factory=list)
    table_name: str | None = None
    cluster_details: ClusterDetails | None = None
    partition_details: PartitionDetails | None = None


class FoundationTableItem(BaseSchemaModel):
    """Item descriptor schema for Data Foundation mappings block."""

    source: FoundationSource
    target: FoundationTarget
    deploy_always: bool = False


class FoundationTableSettings(BaseSchemaModel):
    """Root configuration loads for Data Foundation."""

    ecc: list[FoundationTableItem] = pydantic.Field(default_factory=list)
    s4: list[FoundationTableItem] = pydantic.Field(default_factory=list)
    common: list[FoundationTableItem] = pydantic.Field(default_factory=list)
