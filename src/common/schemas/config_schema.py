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

"""Configuration schema models for the workspace."""

from typing import Annotated, Any, Literal

import pydantic
from pydantic import BeforeValidator, StringConstraints, alias_generators

from .enums import DeploymentTargetType, ModuleType, SapVersion

DataProductType = str

NonEmptyString = Annotated[str, StringConstraints(min_length=1)]


def _empty_to_none(v: Any) -> Any:
    return None if v == "" else v


OptionalNonEmptyString = Annotated[str | None, BeforeValidator(_empty_to_none)]


def _extract_module_type(v: Any) -> Any:
    """Helper to extract module type and preserve namespace metadata."""
    if isinstance(v, dict) and "type" in v:
        full_type = v["type"]
        if "." in full_type:
            namespace, module_type = full_type.split(".", 1)
            v["type"] = module_type
            v["namespace"] = namespace
    return v


class DatasetConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    id: NonEmptyString
    project_id: NonEmptyString
    dataset_id: NonEmptyString


class SAPModuleSettings(pydantic.BaseModel):
    """SAP-specific module settings."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    sap_version: SapVersion
    mandt: NonEmptyString


class BaseModuleConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    module_id: NonEmptyString
    enabled: bool = True
    depends_on: dict[str, str] = pydantic.Field(default_factory=dict)
    table_settings: str | None = None
    namespace: str | None = None

    _namespace: str = pydantic.PrivateAttr()
    _module_type: str = pydantic.PrivateAttr()

    @pydantic.model_validator(mode="before")
    @classmethod
    def handle_namespaced_type(cls, data: Any) -> Any:
        if isinstance(data, dict) and "type" in data:
            full_type = data["type"]
            if "." in full_type:
                namespace, module_type = full_type.split(".", 1)
                data["type"] = module_type
                data["namespace"] = namespace
            elif "namespace" not in data:
                raise ValueError(
                    f"Module type '{full_type}' must be namespaced (e.g. 'cortex.{full_type}')"
                )
        return data

    @pydantic.model_validator(mode="after")
    def finalize_metadata(self):
        # Store namespace in private attribute for consistency
        self._namespace = self.namespace or "unknown"

        # Store module type for builders to use
        self._module_type = self.type if isinstance(self.type, str) else self.type.value
        return self


class DataFoundationModuleConfig(BaseModuleConfig):
    data_source_id: NonEmptyString
    data_target_id: str | None = None
    external: bool = False

    @pydantic.model_validator(mode="after")
    def set_default_table_settings(self):
        if not self.table_settings:
            # We use the module type for the default path to maintain shared config files
            self.table_settings = (
                f"config/{self._namespace}/data_foundation/{self._module_type}/table_settings.yaml"
            )
        return self

    @pydantic.model_validator(mode="after")
    def validate_data_target_id(self):
        if not self.external and not self.data_target_id:
            raise ValueError("dataTargetId is required for non-external foundations")
        if self.external and self.data_target_id:
            raise ValueError("dataTargetId should not be set for external foundations")
        return self


class SAPModuleConfig(DataFoundationModuleConfig):
    type: Literal[ModuleType.SAP]
    module_settings: SAPModuleSettings


class GenericModuleConfig(DataFoundationModuleConfig):
    type: Literal[ModuleType.GENERIC]
    module_settings: dict[str, Any] | None = None


class DataProductModuleConfig(BaseModuleConfig):
    type: DataProductType
    data_target_id: NonEmptyString
    module_settings: dict[str, Any] | None = None

    @pydantic.model_validator(mode="after")
    def set_default_table_settings(self):
        if not self.table_settings:
            # We use the module type for the default path
            self.table_settings = (
                f"config/{self._namespace}/data_product/{self._module_type}/table_settings.yaml"
            )
        return self


ModuleConfig = Annotated[
    SAPModuleConfig | GenericModuleConfig,
    pydantic.Field(discriminator="type"),
]


class ModulesConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    foundation: list[ModuleConfig] = pydantic.Field(default_factory=list)
    product: list[DataProductModuleConfig] = pydantic.Field(default_factory=list)

    @pydantic.model_validator(mode="before")
    @classmethod
    def handle_namespaced_modules(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "foundation" in data:
                data["foundation"] = [_extract_module_type(m) for m in data["foundation"]]
            if "product" in data:
                data["product"] = [_extract_module_type(m) for m in data["product"]]
        return data


class NamespaceConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    name: NonEmptyString
    path: NonEmptyString


class DataConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    big_query_location: str
    namespaces: list[NamespaceConfig] = pydantic.Field(default_factory=list)
    sources: list[DatasetConfig] = pydantic.Field(default_factory=list)
    targets: list[DatasetConfig] = pydantic.Field(default_factory=list)
    modules: ModulesConfig


class BaseDeploymentTargetConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    enabled: bool = True


class DataformTargetSettings(pydantic.BaseModel):
    """Dataform-specific target settings."""

    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    repository_project_id: NonEmptyString
    repository_region: NonEmptyString
    repository_name: NonEmptyString
    workspace_name: NonEmptyString
    service_account: OptionalNonEmptyString = None


class DataformDeploymentTargetConfig(BaseDeploymentTargetConfig):
    model_config = pydantic.ConfigDict(
        extra="allow",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: Literal[DeploymentTargetType.DATAFORM]
    target_settings: DataformTargetSettings


class GenericDeploymentTargetConfig(BaseDeploymentTargetConfig):
    model_config = pydantic.ConfigDict(
        extra="allow",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: Literal[DeploymentTargetType.GENERIC]
    target_settings: dict[str, Any] | None = None


DeploymentTargetConfig = Annotated[
    DataformDeploymentTargetConfig | GenericDeploymentTargetConfig,
    pydantic.Field(discriminator="type"),
]


class DeploymentConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    targets: list[DeploymentTargetConfig] = pydantic.Field(default_factory=list)


class BuildEnvironmentConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    build_project_id: str | None = None


class GlobalConfig(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="ignore",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    build_environment: BuildEnvironmentConfig = pydantic.Field(
        default_factory=BuildEnvironmentConfig
    )
    deployment: DeploymentConfig | None = None
    data: DataConfig

    def get_data_source(self, source_id: str) -> DatasetConfig:
        for s in self.data.sources:
            if s.id == source_id:
                return s
        raise ValueError(f"Data source '{source_id}' not found in configuration")

    def get_data_target(self, target_id: str) -> DatasetConfig:
        for t in self.data.targets:
            if t.id == target_id:
                return t
        raise ValueError(f"Data target '{target_id}' not found in configuration")

    @pydantic.model_validator(mode="after")
    def validate_referential_integrity(self):
        source_ids = {s.id for s in self.data.sources}
        target_ids = {t.id for t in self.data.targets}

        # Check foundation modules
        for module in self.data.modules.foundation:
            if module.data_source_id not in source_ids:
                raise ValueError(
                    f"Module '{module.module_id}' references unknown data source "
                    f"'{module.data_source_id}'. Available sources: {list(source_ids)}"
                )
            if module.data_target_id and module.data_target_id not in target_ids:
                raise ValueError(
                    f"Module '{module.module_id}' references unknown data target "
                    f"'{module.data_target_id}'. Available targets: {list(target_ids)}"
                )

        # Check product modules
        for module in self.data.modules.product:
            if module.data_target_id not in target_ids:
                raise ValueError(
                    f"Module '{module.module_id}' references unknown data target "
                    f"'{module.data_target_id}'. Available targets: {list(target_ids)}"
                )

        return self

    @pydantic.model_validator(mode="after")
    def validate_dataset_uniqueness_by_type(self):
        foundation_by_type = {}
        for module in self.data.modules.foundation:
            if module.external or not module.data_target_id:
                continue
            target = self.get_data_target(module.data_target_id)
            target_key = (target.project_id, target.dataset_id)
            module_type = module.type
            if module_type not in foundation_by_type:
                foundation_by_type[module_type] = set()
            if target_key in foundation_by_type[module_type]:
                raise ValueError(
                    f"Foundation module '{module.module_id}' of type '{module_type}' "
                    f"shares target dataset '{target.project_id}.{target.dataset_id}' "
                    f"with another module of the same type."
                )
            foundation_by_type[module_type].add(target_key)

        product_by_type = {}
        for module in self.data.modules.product:
            target = self.get_data_target(module.data_target_id)
            target_key = (target.project_id, target.dataset_id)
            module_type = module.type
            if module_type not in product_by_type:
                product_by_type[module_type] = set()
            if target_key in product_by_type[module_type]:
                raise ValueError(
                    f"Product module '{module.module_id}' of type '{module_type}' "
                    f"shares target dataset '{target.project_id}.{target.dataset_id}' "
                    f"with another module of the same type."
                )
            product_by_type[module_type].add(target_key)

        return self
