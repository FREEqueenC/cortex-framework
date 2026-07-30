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
from pydantic import BeforeValidator, StringConstraints, alias_generators

from common.errors import CortexConfigError
from common.utils.id_utils import sanitize_bq_identifier

from .enums import DeploymentTargetType, ModuleType, SapVersion

DataProductType = str
NonEmptyString = Annotated[str, StringConstraints(min_length=1)]


def _empty_to_none(v: Any) -> Any:
    """Converts empty string values to None."""
    return None if v == "" else v


OptionalNonEmptyString = Annotated[str | None, BeforeValidator(_empty_to_none)]


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
    dependency_bindings: dict[str, str] = pydantic.Field(default_factory=dict)
    table_settings: OptionalNonEmptyString = None
    namespace: str | None = None
    module_path: str
    module_type: Any = "generic"

    @property
    def module_name(self) -> str:
        """Returns the specific module name (the last segment of the path)."""
        return self.module_path.split(".")[-1]

    _namespace: str = pydantic.PrivateAttr()
    _table_settings_explicit: bool = pydantic.PrivateAttr(default=False)

    @pydantic.model_validator(mode="before")
    @classmethod
    def handle_namespaced_type(cls, data: Any) -> Any:
        """Pre-processes namespaced module types and ensures a namespace is declared."""
        if isinstance(data, dict) and "modulePath" in data:
            full_type = data["modulePath"]
            if "namespace" not in data:
                if "." in full_type:
                    data["namespace"] = full_type.split(".", 1)[0]
                else:
                    raise ValueError(
                        f"Module path '{full_type}' must be namespaced (e.g. 'cortex.{full_type}')"
                    )
        return data

    @property
    def namespaced_type(self) -> str:
        """Returns the fully qualified namespaced type."""
        return str(self.module_path)

    @pydantic.model_validator(mode="after")
    def finalize_metadata(self):
        """Finalizes private metadata properties used by the builder modules."""
        self._namespace = self.namespace or "unknown"
        if self.table_settings:
            self._table_settings_explicit = True
        return self


class DataFoundationModuleConfig(BaseModuleConfig):
    """Configuration model for data foundation modules."""

    data_source_id: NonEmptyString
    data_target_id: str | None = None
    external: bool = False


class SAPModuleConfig(DataFoundationModuleConfig):
    """Data foundation config specific to SAP modules."""

    module_type: Literal[ModuleType.SAP] = ModuleType.SAP
    module_settings: SAPModuleSettings


class GenericModuleConfig(DataFoundationModuleConfig):
    """Data foundation config for generic modules."""

    module_type: Literal[ModuleType.GENERIC] = ModuleType.GENERIC
    module_settings: dict[str, Any] | None = None


class DataProductModuleConfig(BaseModuleConfig):
    """Configuration model for data product modules."""

    sync_to_kc: bool = True
    data_source_id: OptionalNonEmptyString = None
    data_target_id: NonEmptyString
    module_settings: dict[str, Any] | None = None


class ShareConfig(CortexBaseModel):
    share_id: NonEmptyString

    @property
    def sanitized_share_id(self) -> str:
        """Returns share_id sanitized for BigQuery/Dataform dataset compatibility."""
        return sanitize_bq_identifier(self.share_id)


class CatalogConnectionSettings(CortexBaseModel):
    """Connection settings for external lakehouse delta sharing catalogs."""

    catalog_id: NonEmptyString = pydantic.Field(
        validation_alias=pydantic.AliasChoices("catalogId", "catalog_id")
    )
    project_id: NonEmptyString = pydantic.Field(
        validation_alias=pydantic.AliasChoices("projectId", "project_id", "project")
    )
    location: NonEmptyString
    shares: list[ShareConfig] = pydantic.Field(default_factory=list)


class CatalogConfig(CortexBaseModel):
    """Configuration model for external catalog modules."""

    id: NonEmptyString
    type: str = "lakehouse_delta_share"
    enabled: bool = True
    binds_namespaces: list[str] = pydantic.Field(
        default_factory=list,
        validation_alias=pydantic.AliasChoices("bindsNamespaces", "binds_namespaces"),
    )
    connection_settings: CatalogConnectionSettings = pydantic.Field(
        validation_alias=pydantic.AliasChoices("connectionSettings", "connection_settings")
    )

    table_settings: OptionalNonEmptyString = None

    @property
    def _module_type(self) -> str:
        """Returns the specific catalog technology type (e.g., lakehouse_delta_share)."""
        return str(self.type)

    @property
    def module_id(self) -> str:
        """Returns the module ID alias for the catalog."""
        return str(self.id)

    @property
    def namespaced_type(self) -> str:
        """Returns the raw technology type for the catalog module."""
        return self._module_type


ModuleConfig = Annotated[
    SAPModuleConfig | GenericModuleConfig,
    pydantic.Field(discriminator="module_type"),
]


class ModulesConfig(CortexBaseModel):
    foundation: list[ModuleConfig] = pydantic.Field(
        default_factory=list, validation_alias=pydantic.AliasChoices("foundation", "foundations")
    )
    product: list[DataProductModuleConfig] = pydantic.Field(
        default_factory=list, validation_alias=pydantic.AliasChoices("product", "products")
    )
    catalogs: list[CatalogConfig] = pydantic.Field(default_factory=list)

    @property
    def foundations(self) -> list[ModuleConfig]:
        return self.foundation

    @property
    def products(self) -> list[DataProductModuleConfig]:
        return self.product


class NamespaceConfig(CortexBaseModel):
    name: NonEmptyString
    path: NonEmptyString

    def resolve_path(self, config_dir: pathlib.Path) -> pathlib.Path:
        """Resolves the namespace path relative to the config file directory."""
        p = pathlib.Path(self.path)
        if p.is_absolute():
            return p

        return (config_dir / p).resolve()


class DataConfig(CortexBaseModel):
    big_query_location: str
    namespaces: list[NamespaceConfig] = pydantic.Field(default_factory=list)
    datasets: list[DatasetConfig] = pydantic.Field(default_factory=list)
    modules: ModulesConfig

    def get_namespace_path(
        self, namespace_name: str, config_dir: pathlib.Path | None = None
    ) -> pathlib.Path:
        """Resolves the path for a given namespace name."""
        base_dir = config_dir or pathlib.Path.cwd()
        pkg_data_modules = pathlib.Path(__file__).resolve().parent.parent.parent / "data_modules"
        for ns in self.namespaces:
            if ns.name == namespace_name:
                return ns.resolve_path(base_dir)
        return (pkg_data_modules / namespace_name).resolve()

    def get_module_physical_dir(
        self, module_type_str: str, config_dir: pathlib.Path | None = None
    ) -> pathlib.Path:
        """Resolves physical directory by replacing namespace alias with its resolved path."""
        parts = module_type_str.split(".", 1)
        if len(parts) == 2:
            ns_name, rel_str = parts
            ns_path = self.get_namespace_path(ns_name, config_dir)
            rel_path = pathlib.Path(*rel_str.split("."))
            return ns_path / rel_path
        return pathlib.Path(module_type_str)


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

    def get_dataset(self, dataset_id: str) -> DatasetConfig:
        """Resolves a dataset configuration by its identifier."""
        for d in self.data.datasets:
            if d.id == dataset_id:
                return d
        raise CortexConfigError(
            f"Dataset '{dataset_id}' not found in configuration",
            hint="Define this dataset in 'data -> datasets' in config.yaml.",
        )
