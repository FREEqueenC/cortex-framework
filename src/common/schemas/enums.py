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

import enum


class SapVersion(enum.StrEnum):
    ECC = "ecc"
    S4 = "s4"


class ModuleType(enum.StrEnum):
    SAP = "sap"
    GENERIC = "generic"


class Category(enum.StrEnum):
    FOUNDATION = "data_foundation"
    PRODUCT = "data_product"
    CATALOG = "catalog"


class ModuleCategory(enum.StrEnum):
    FOUNDATION = "foundation"
    FOUNDATIONAL_PRODUCT = "source_aligned_product"
    COMPOSITE_PRODUCT = "consumption_product"


class DeploymentTargetType(enum.StrEnum):
    DATAFORM = "dataform"
    GENERIC = "generic"


class PartitionType(enum.StrEnum):
    TIME = "time"
    INTEGER = "integer"
    DATE = "DATE"


class MaterializationType(enum.StrEnum):
    INCREMENTAL = "incremental"
    TABLE = "table"
    VIEW = "view"
