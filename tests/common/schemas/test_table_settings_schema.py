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

import pytest
from pydantic import ValidationError

from common.schemas.enums import PartitionType
from common.schemas.table_settings_schema import ClusterDetails, PartitionDetails


def test_partition_details_valid_column():
    details = PartitionDetails(column="material", partition_type=PartitionType.DATE)
    assert details.column == "material"


def test_partition_details_invalid_column():
    with pytest.raises(ValidationError):
        PartitionDetails(column="material); SELECT 1; --", partition_type=PartitionType.DATE)


def test_partition_details_invalid_column_with_spaces():
    with pytest.raises(ValidationError):
        PartitionDetails(column="a b", partition_type=PartitionType.DATE)


def test_cluster_details_valid_columns():
    details = ClusterDetails(columns=["col1", "col2"])
    assert details.columns == ["col1", "col2"]


def test_cluster_details_invalid_columns():
    with pytest.raises(ValidationError):
        ClusterDetails(columns=["col1", "col2; DROP TABLE x;"])
