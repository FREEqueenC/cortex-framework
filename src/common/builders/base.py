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

import abc
import pathlib
from typing import NamedTuple

from common.schemas import config_schema, manifest_schema


class Source(NamedTuple):
    """Represents a centralized source declaration."""

    project: str
    dataset: str
    table: str


class BaseBuilder[TConfig: config_schema.BaseModuleConfig](abc.ABC):
    """Abstract base class for Dataform builder plugins."""

    @abc.abstractmethod
    def build(
        self,
        *,
        module_id: str,
        module_config: TConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
    ) -> None:
        """Main entry point for generator plugins."""
        pass


class FoundationBuilder[TConfig: config_schema.BaseModuleConfig](BaseBuilder[TConfig]):
    """Sub-interface for Data Foundation plugins."""

    @abc.abstractmethod
    def build(
        self,
        *,
        module_id: str,
        module_config: TConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
        table_settings_file: pathlib.Path | None = None,
        required_tables: set[str] | None = None,
    ) -> None:
        """Slightly specialized signature for Foundations."""
        pass


class ProductBuilder[TConfig: config_schema.BaseModuleConfig](BaseBuilder[TConfig]):
    """Sub-interface for Data Product plugins."""

    @abc.abstractmethod
    def build(
        self,
        *,
        module_id: str,
        module_config: TConfig,
        global_config: config_schema.GlobalConfig,
        manifest: manifest_schema.ManifestConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[Source],
        table_settings_file: pathlib.Path | None = None,
    ) -> None:
        """Slightly specialized signature for Products."""
        pass
