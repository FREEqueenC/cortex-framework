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


class DataplexSyncAction(enum.Enum):
    NOT_MANAGED = (
        "NOT_MANAGED"  # The data product already exists but it is not managed by this tool.
    )
    NO_CHANGE = "NO_CHANGE"  # The data product exists and its configuration is up to date.
    NEEDS_UPDATE = (
        "NEEDS_UPDATE"  # The data product exists and its configuration needs to be updated.
    )
    NEEDS_CREATION = "NEEDS_CREATION"  # The data product does not exist and needs to be created.
    ERROR = "ERROR"  # An error occurred while syncing the data product.

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}.{self.name}"


class DataplexSyncStatus(enum.Enum):
    SUCCESS = "SUCCESS"  # The sync action was successful.
    PRECONDITION_NOT_MET = (
        "PRECONDITION_NOT_MET"  # The sync action could not be performed due to unmet preconditions.
    )
    ERROR = "ERROR"  # An error occurred while syncing the data product.

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}.{self.name}"
