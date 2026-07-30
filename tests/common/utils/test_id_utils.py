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

"""Unit tests for common.utils.id_utils."""

from common.utils.id_utils import normalize_id, sanitize_bq_identifier


def test_normalize_id():
    assert normalize_id("Test-ID_123!") == "test-id-123"


def test_sanitize_bq_identifier():
    assert sanitize_bq_identifier("customer-v1:400.prod") == "customer_v1_400_prod"
    assert sanitize_bq_identifier("valid_name_123") == "valid_name_123"
    assert sanitize_bq_identifier("share-with-spaces and:colons") == "share_with_spaces_and_colons"
