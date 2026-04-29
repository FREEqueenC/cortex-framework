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

"""Configuration schema models for annotation files."""

import pydantic

from common.schemas.table_settings_schema import BaseSchemaModel


class FieldAnnotation(BaseSchemaModel):
    """Schema for a single field annotation."""

    name: str
    description: str | None = None


class TableAnnotation(BaseSchemaModel):
    """Schema for a table annotation."""

    description: str | None = None
    fields: list[FieldAnnotation] = pydantic.Field(default_factory=list)
