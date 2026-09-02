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


class BigQueryLabel(BaseSchemaModel):
    key: str
    value: str


class PartitionDetails(BaseSchemaModel):
    column: str
    partition_type: PartitionType
    time_grain: str | None = None
    range_start: int | None = None
    range_end: int | None = None
    range_interval: int | None = None

    @pydantic.field_validator("column")
    @classmethod
    def validate_column(cls, v: str) -> str:
        import re

        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError(
                f"Invalid column name in partition details: {v}. "
                "Must be alphanumeric and underscores only."
            )
        return v


class ClusterDetails(BaseSchemaModel):
    columns: list[str]

    @pydantic.field_validator("columns")
    @classmethod
    def validate_columns(cls, v: list[str]) -> list[str]:
        import re

        for col in v:
            if not re.match(r"^[a-zA-Z0-9_]+$", col):
                raise ValueError(
                    f"Invalid column name in cluster details: {col}. "
                    "Must be alphanumeric and underscores only."
                )
        return v


# --- Data Product Style ---
class ProductTableItem(BaseSchemaModel):
    """Item descriptor schema for Data Products."""

    materialization_type: MaterializationType = MaterializationType.INCREMENTAL
    dataform_tags: list[str] = pydantic.Field(default_factory=list)
    big_query_labels: list[BigQueryLabel] = pydantic.Field(default_factory=list)
    cluster_details: ClusterDetails | None = None
    partition_details: PartitionDetails | None = None
    enabled: bool = True

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


class SapBdcProductTableSettings(pydantic.RootModel[dict[str, ProductTableItem]]):
    """Root configuration schema for SAP BDC and composite data products."""


# --- SAP Data Foundation ---
class SapFoundationSource(BaseSchemaModel):
    table_name: str
    sap_table_name: str | None = None
    is_cdc: bool = True

    @pydantic.model_validator(mode="after")
    def normalize_sap_table_name(self) -> "SapFoundationSource":
        if not self.sap_table_name:
            self.sap_table_name = self.table_name
        return self


class SapFoundationTarget(BaseSchemaModel):
    """Publish targeting settings for SAP Data Foundation."""

    dataform_tags: list[str] = pydantic.Field(default_factory=list)
    big_query_labels: list[BigQueryLabel] = pydantic.Field(default_factory=list)
    table_name: str | None = None
    cluster_details: ClusterDetails | None = None
    partition_details: PartitionDetails | None = None


class SapFoundationTableItem(BaseSchemaModel):
    """Item descriptor schema for SAP Data Foundation mappings block."""

    source: SapFoundationSource
    target: SapFoundationTarget = pydantic.Field(default_factory=SapFoundationTarget)
    deploy_always: bool = False

    @pydantic.model_validator(mode="after")
    def normalize_target_table_name(self) -> "SapFoundationTableItem":
        if not self.target.table_name:
            self.target.table_name = self.source.sap_table_name
        return self


class SapFoundationTableSettings(BaseSchemaModel):
    """Root configuration loads for SAP Data Foundation."""

    ecc: list[SapFoundationTableItem] = pydantic.Field(default_factory=list)
    s4: list[SapFoundationTableItem] = pydantic.Field(default_factory=list)
    common: list[SapFoundationTableItem] = pydantic.Field(default_factory=list)


# Backward compatibility aliases
FoundationSource = SapFoundationSource
FoundationTarget = SapFoundationTarget
FoundationTableItem = SapFoundationTableItem
FoundationTableSettings = SapFoundationTableSettings
