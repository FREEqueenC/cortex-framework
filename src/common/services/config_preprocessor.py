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

import os
from string import Template
from typing import Any


class ConfigPreprocessor:
    """Preprocessing Service for Configuration Interpolation."""

    def __init__(self, context_overrides: dict[str, Any] | None = None):
        self.context = context_overrides or {}

    def _resolve_string(self, value: str) -> str:
        """Interpolates variables inside a string."""
        combined = {**os.environ, **self.context}
        try:
            return Template(value).substitute(combined)
        except KeyError as e:
            raise ValueError(f"Unresolved configuration variable: {e.args[0]}") from e

    def process(self, data: Any) -> Any:
        # Recursively resolves variables in dictionaries and lists.
        if isinstance(data, str):
            return self._resolve_string(data)
        elif isinstance(data, dict):
            return {k: self.process(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.process(item) for item in data]
        return data
