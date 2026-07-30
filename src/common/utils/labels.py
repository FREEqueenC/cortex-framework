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

"""Utility for managing standard BigQuery labels across modules."""

LABEL_MODULE_CATEGORY = "module_category"
LABEL_MODULE_TYPE = "module_type"
LABEL_NAMESPACED_MODULE_TYPE = "namespaced_module_type"
LABEL_MODULE_ID = "module_id"


def get_module_labels(
    module_id: str | None = None,
    namespaced_type: str | None = None,
    module_category: str | None = None,
    module_type: str | None = None,
) -> dict[str, str]:
    """Generates a dictionary of standardized labels for a module.

    Args:
        module_id: The ID of the module instance.
        namespaced_type: The fully qualified namespaced type of the module.
        module_category: The category of the module.
        module_type: The unqualified module type.

    Returns:
        A dictionary containing the standardized BigQuery labels.
    """
    labels = {}

    if module_category:
        labels[LABEL_MODULE_CATEGORY] = module_category

    if module_type:
        labels[LABEL_MODULE_TYPE] = module_type

    if namespaced_type:
        labels[LABEL_NAMESPACED_MODULE_TYPE] = namespaced_type.replace(".", "_")

    if module_id:
        labels[LABEL_MODULE_ID] = module_id.lower().replace(".", "_")

    return labels


def get_canonical_module_type(namespaced_type: str | None) -> str | None:
    """Returns the canonical module type from a namespaced type.

    Args:
        namespaced_type: The fully qualified namespaced type of the module.

    Returns:
        The canonical module type.
    """

    if namespaced_type:
        parts = namespaced_type.split(".")
        if len(parts) == 0:
            parts = namespaced_type.split("_")

        if len(parts) > 0:
            return parts[-1]

    return namespaced_type
