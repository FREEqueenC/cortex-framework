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

"""Module for ID utilities."""

import re


def normalize_id(id: str) -> str:
    """Normalize the special characters and seprators of an id string to
    comply with Cloud APIs format rules.

    Args:
        id_str: The id string to normalize.

    Returns:
        The normalized id string.
    """

    normalized_id = re.sub(r"[^A-Za-z0-9]", "-", id.lower())

    # Remove leading hyphens
    normalized_id = normalized_id.lstrip("-")

    # Remove trailing hyphens
    normalized_id = normalized_id.rstrip("-")

    return normalized_id


def sanitize_bq_identifier(identifier: str) -> str:
    """Sanitizes an identifier string for BigQuery and Dataform compatibility.

    Replaces all non-alphanumeric and non-underscore characters with an underscore.

    Args:
        identifier: The raw identifier string.

    Returns:
        The sanitized identifier string safe for BigQuery dataset and table names.
    """
    return re.sub(r"[^a-zA-Z0-9_]", "_", identifier)
