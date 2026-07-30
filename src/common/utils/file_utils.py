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

"""File utility functions."""

import pathlib
from typing import Any

import yaml

from common.errors import CortexConfigError

try:
    from yaml import CSafeLoader as SafeLoader
except ImportError:
    from yaml import SafeLoader  # type: ignore[assignment]


def load_yaml(filepath: pathlib.Path | str) -> dict[str, Any]:
    """Loads a YAML file and returns its parsed contents."""
    try:
        with open(filepath, encoding="utf-8") as f:
            return yaml.load(f, Loader=SafeLoader) or {}
    except FileNotFoundError:
        raise CortexConfigError(
            f"File not found: '{filepath}'",
            hint=(
                "Verify that the file exists at the specified path and that the "
                "path is spelled correctly."
            ),
        ) from None
