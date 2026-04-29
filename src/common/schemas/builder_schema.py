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

"""Configuration schema models for builder plugins."""

import pathlib
from typing import Protocol

from common.schemas import config_schema


class DataformBuilder(Protocol):
    """Protocol defining the standard interface for Dataform module builders."""

    def build(
        self,
        module_id: str,
        module_config: config_schema.ModuleConfig,
        global_config: config_schema.GlobalConfig,
        base_dir: pathlib.Path,
        annotations_dir: pathlib.Path,
        output_dir: pathlib.Path,
        module_dir_name: str,
        sources_registry: set[tuple[str, str, str]],
    ) -> None: ...
