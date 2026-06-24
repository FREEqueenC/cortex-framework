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

import pathlib
from typing import Annotated, Any, Literal

import pydantic
import yaml
from pydantic import BeforeValidator, StringConstraints, alias_generators

from common.utils.file_utils import load_yaml

from .enums import DeploymentTargetType, ModuleType, SapVersion

DataProductType = str
NonEmptyString = Annotated[str, StringConstraints(min_length=1)]


def _empty_to_none(v: Any) -> Any:
    """Converts empty string values to None."""
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


def snake_to_camel(name: str) -> str:
    """Converts a snake_case string to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CortexBaseModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        extra="forbid",
        alias_generator=alias_generators.to_camel,
        # populate_by_name set to false so that Pydantic catches snake_case or unknown keys
        # as extra_forbidden errors during external dictionary validation.
        populate_by_name=False,
    )


class DatasetConfig(CortexBaseModel):
    id: NonEmptyString
    project_id: NonEmptyString
    dataset_id: NonEmptyString


class SAPModuleSettings(CortexBaseModel):
    """SAP-specific module settings."""

    sap_version: SapVersion
    mandt: NonEmptyString


class BaseModuleConfig(CortexBaseModel):
    module_id: NonEmptyString
    enabled: bool = True
    depends_on: dict[str, str] = pydantic.Field(default_factory=dict)
    table_settings: OptionalNonEmptyString = None
    namespace: str | None = None

    _namespace: str = pydantic.PrivateAttr()
    _module_type: str = pydantic.PrivateAttr()
    _table_settings_explicit: bool = pydantic.PrivateAttr(default=False)

    @pydantic.model_validator(mode="before")
    @classmethod
    def handle_namespaced_type(cls, data: Any) -> Any:
        """Pre-processes namespaced module types and ensures a namespace is declared."""
        if isinstance(data, dict) and "type" in data:
            data = _extract_module_type(data)
            if "namespace" not in data:
                raise ValueError(
                    f"Module type '{data['type']}' must be namespaced "
                    f"(e.g. 'cortex.{data['type']}')"
                )
        return data

    @pydantic.model_validator(mode="after")
    def finalize_metadata(self):
        """Finalizes private metadata properties used by the builder modules."""
        # Store namespace in private attribute for consistency
        self._namespace = self.namespace or "unknown"

        # Store module type for builders to use
        self._module_type = self.type if isinstance(self.type, str) else self.type.value
        return self

    def _set_default_table_settings_path(self, category: str):
        """Populates default fallback table settings file path using category name if missing."""
        if not self.table_settings:
            self.table_settings = (
                f"src/data_modules/{self._namespace}/{category}/"
                f"{self._module_type}/table_settings.default.yaml"
            )
        else:
            self._table_settings_explicit = True


class DataFoundationModuleConfig(BaseModuleConfig):
    """Configuration model for data foundation modules."""

    data_source_id: NonEmptyString
    data_target_id: str | None = None
    external: bool = False

    @pydantic.model_validator(mode="after")
    def set_default_table_settings(self):
        self._set_default_table_settings_path("data_foundation")
        return self

    @pydantic.model_validator(mode="after")
    def validate_data_target_id(self):
        if not self.external and not self.data_target_id:
            raise ValueError(
                f"Foundation module '{self.module_id}' is not external and "
                "must specify a 'dataTargetId'."
            )
        if self.external and self.data_target_id:
            raise ValueError("dataTargetId should not be set for external foundations")
        return self


class SAPModuleConfig(DataFoundationModuleConfig):
    """Data foundation config specific to SAP modules."""

    type: Literal[ModuleType.SAP]
    module_settings: SAPModuleSettings


class GenericModuleConfig(DataFoundationModuleConfig):
    """Data foundation config for generic modules."""

    type: Literal[ModuleType.GENERIC]
    module_settings: dict[str, Any] | None = None


class DataProductModuleConfig(BaseModuleConfig):
    """Configuration model for data product modules."""

    type: DataProductType
    data_target_id: NonEmptyString
    module_settings: dict[str, Any] | None = None

    @pydantic.model_validator(mode="after")
    def set_default_table_settings(self):
        self._set_default_table_settings_path("data_product")
        return self


ModuleConfig = Annotated[
    SAPModuleConfig | GenericModuleConfig,
    pydantic.Field(discriminator="type"),
]


class ModulesConfig(CortexBaseModel):
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


class NamespaceConfig(CortexBaseModel):
    name: NonEmptyString
    path: NonEmptyString


class DataConfig(CortexBaseModel):
    big_query_location: str
    namespaces: list[NamespaceConfig] = pydantic.Field(default_factory=list)
    sources: list[DatasetConfig] = pydantic.Field(default_factory=list)
    targets: list[DatasetConfig] = pydantic.Field(default_factory=list)
    modules: ModulesConfig


class BaseDeploymentTargetConfig(CortexBaseModel):
    enabled: bool = True


class DataformTargetSettings(CortexBaseModel):
    """Dataform-specific target settings."""

    repository_project_id: NonEmptyString
    repository_region: NonEmptyString
    repository_name: NonEmptyString
    workspace_name: NonEmptyString
    service_account: OptionalNonEmptyString = None


class DataformDeploymentTargetConfig(BaseDeploymentTargetConfig):
    """Configuration for a Dataform deployment target."""

    model_config = pydantic.ConfigDict(
        extra="allow",
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
    type: Literal[DeploymentTargetType.DATAFORM]
    target_settings: DataformTargetSettings


class GenericDeploymentTargetConfig(BaseDeploymentTargetConfig):
    """Configuration for generic deployment targets."""

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


class DeploymentConfig(CortexBaseModel):
    targets: list[DeploymentTargetConfig] = pydantic.Field(default_factory=list)


class BuildEnvironmentConfig(CortexBaseModel):
    build_project_id: str | None = None
    timeout: int | None = None


class GlobalConfig(CortexBaseModel):
    build_environment: BuildEnvironmentConfig = pydantic.Field(
        default_factory=BuildEnvironmentConfig
    )
    deployment: DeploymentConfig | None = None
    data: DataConfig

    def get_data_source(self, source_id: str) -> DatasetConfig:
        """Resolves a data source dataset configuration by its identifier."""
        for s in self.data.sources:
            if s.id == source_id:
                return s
        raise ValueError(f"Data source '{source_id}' not found in configuration")

    def get_data_target(self, target_id: str) -> DatasetConfig:
        """Resolves a data target dataset configuration by its identifier."""
        for t in self.data.targets:
            if t.id == target_id:
                return t
        raise ValueError(f"Data target '{target_id}' not found in configuration")

    @pydantic.model_validator(mode="after")
    def validate_business_rules(self, info: pydantic.ValidationInfo):
        import difflib

        errors: list[str] = []

        # 1. Check ID uniqueness
        id_occurrences: dict[str, list[str]] = {}
        for index, source in enumerate(self.data.sources):
            id_occurrences.setdefault(source.id, []).append(f"data -> sources[{index}]")
        for index, target in enumerate(self.data.targets):
            id_occurrences.setdefault(target.id, []).append(f"data -> targets[{index}]")
        for index, f_module in enumerate(self.data.modules.foundation):
            loc = f"data -> modules -> foundation[{index}]"
            id_occurrences.setdefault(f_module.module_id, []).append(loc)
        for index, p_module in enumerate(self.data.modules.product):
            loc = f"data -> modules -> product[{index}]"
            id_occurrences.setdefault(p_module.module_id, []).append(loc)

        for id_value, locations in id_occurrences.items():
            if len(locations) > 1:
                errors.append(
                    f"Duplicate ID '{id_value}' found across the configuration at: "
                    f"{', '.join(locations)}. Each ID in 'sources', 'targets', and "
                    "modules' must be unique."
                )

        # 2. Check referential integrity
        source_ids = {s.id for s in self.data.sources}
        target_ids = {t.id for t in self.data.targets}

        # Foundation modules referential integrity
        for f_module in self.data.modules.foundation:
            module_id = f_module.module_id
            data_source_id = f_module.data_source_id
            if data_source_id and data_source_id not in source_ids:
                matches = difflib.get_close_matches(data_source_id, list(source_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Foundation module '{module_id}' references unknown "
                    f"dataSourceId '{data_source_id}'.{suggestion} Please check "
                    "spelling or define this source ID in 'data -> sources'. "
                    "(references unknown data source)"
                )

            data_target_id = f_module.data_target_id
            is_external = getattr(f_module, "external", False)
            if not is_external and not data_target_id:
                errors.append(
                    f"Foundation module '{module_id}' is not external and "
                    "must specify a 'dataTargetId'."
                )
            elif data_target_id and data_target_id not in target_ids:
                matches = difflib.get_close_matches(data_target_id, list(target_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Foundation module '{module_id}' references unknown "
                    f"dataTargetId '{data_target_id}'.{suggestion} Please check "
                    "spelling or define this target ID in 'data -> targets'. "
                    "(references unknown data target)"
                )

        # Product modules referential integrity
        for p_module in self.data.modules.product:
            module_id = p_module.module_id
            data_target_id = p_module.data_target_id
            if data_target_id and data_target_id not in target_ids:
                matches = difflib.get_close_matches(data_target_id, list(target_ids))
                suggestion = f" Did you mean one of these: {matches}?" if matches else ""
                errors.append(
                    f"Product module '{module_id}' references unknown "
                    f"dataTargetId '{data_target_id}'.{suggestion} Please check "
                    "spelling or define this target ID in 'data -> targets'. "
                    "(references unknown data target)"
                )

        # 3. Check table settings existence
        config_dir = (
            info.context.get("config_dir", pathlib.Path.cwd())
            if info.context
            else pathlib.Path.cwd()
        )

        # Foundation modules table settings
        for f_module in self.data.modules.foundation:
            module_id = f_module.module_id
            table_settings = f_module.table_settings
            if f_module._table_settings_explicit and table_settings:
                file_path = pathlib.Path(table_settings)
                if not file_path.is_absolute():
                    file_path = config_dir / file_path
                try:
                    load_yaml(file_path)
                except (ValueError, FileNotFoundError, yaml.YAMLError):
                    errors.append(
                        f"Foundation module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that does not exist at '{file_path}'. "
                        "Please verify the path is correct and the file exists."
                    )

        # Product modules table settings
        for p_module in self.data.modules.product:
            module_id = p_module.module_id
            table_settings = p_module.table_settings
            if p_module._table_settings_explicit and table_settings:
                file_path = pathlib.Path(table_settings)
                if not file_path.is_absolute():
                    file_path = config_dir / file_path
                try:
                    load_yaml(file_path)
                except (ValueError, FileNotFoundError, yaml.YAMLError):
                    errors.append(
                        f"Product module '{module_id}' specifies a tableSettings file "
                        f"'{table_settings}' that does not exist at '{file_path}'. "
                        "Please verify the path is correct and the file exists."
                    )

        if errors:
            raise ValueError("\n".join(errors))
        return self

    def _validate_module_dataset_uniqueness(
        self,
        modules: list[ModuleConfig] | list[DataProductModuleConfig],
        category: str,
    ):
        """Helper to validate modules of same type do not target same BigQuery dataset."""
        dataset_by_type: dict[ModuleType | str, set[tuple[str, str]]] = {}
        for module in modules:
            if getattr(module, "external", False) or not module.data_target_id:
                continue
            target = self.get_data_target(module.data_target_id)
            target_key = (target.project_id, target.dataset_id)
            module_type = module.type
            if module_type not in dataset_by_type:
                dataset_by_type[module_type] = set()
            if target_key in dataset_by_type[module_type]:
                raise ValueError(
                    f"{category.capitalize()} module '{module.module_id}' of type '{module_type}' "
                    f"shares target dataset '{target.project_id}.{target.dataset_id}' "
                    f"with another module of the same type."
                )
            dataset_by_type[module_type].add(target_key)

    @pydantic.model_validator(mode="after")
    def validate_dataset_uniqueness_by_type(self):
        """Validates that datasets targeted by modules are unique per module type."""
        self._validate_module_dataset_uniqueness(self.data.modules.foundation, "foundation")
        self._validate_module_dataset_uniqueness(self.data.modules.product, "product")
        return self
