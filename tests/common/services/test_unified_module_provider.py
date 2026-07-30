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

"""Unit tests for UnifiedModuleProvider."""

from unittest.mock import MagicMock

from common.services.unified_module_provider import UnifiedModuleProvider


def test_unified_module_provider():
    # Mock providers
    mock_internal = MagicMock()
    mock_internal.get_module_types.return_value = {"cortex.sap.foundations.sap"}
    mock_internal.get_tables_for_module.return_value = {"bkpf", "bseg"}

    mock_external = MagicMock()
    mock_external.get_module_types.return_value = {"my_catalog.my_share.my_schema"}
    mock_external.get_tables_for_module.return_value = {"orders", "customers"}
    mock_external.is_valid_module_type.side_effect = lambda m: (
        m
        in {
            "my_catalog.my_share.my_schema",
            "my_catalog.my_schema",
        }
    )

    unified = UnifiedModuleProvider(
        internal_provider=mock_internal, external_provider=mock_external
    )

    # 1. Verify get_module_types aggregation
    assert unified.get_module_types() == {
        "cortex.sap.foundations.sap",
        "my_catalog.my_share.my_schema",
    }

    # 2. Verify validation delegation
    assert unified.is_valid_module_type("cortex.sap.foundations.sap") is True
    assert unified.is_valid_module_type("my_catalog.my_share.my_schema") is True
    assert unified.is_valid_module_type("invalid_type") is False

    # 3. Verify get_tables_for_module delegation
    tables_internal = unified.get_tables_for_module("cortex.sap.foundations.sap")
    assert tables_internal == {"bkpf", "bseg"}
    mock_internal.get_tables_for_module.assert_called_once_with("cortex.sap.foundations.sap", None)

    tables_external = unified.get_tables_for_module("my_catalog.my_share.my_schema")
    assert tables_external == {"orders", "customers"}
    mock_external.get_tables_for_module.assert_called_once_with(
        "my_catalog.my_share.my_schema", None
    )

    tables_external_2part = unified.get_tables_for_module("my_catalog.my_schema")
    assert tables_external_2part == {"orders", "customers"}

    # 4. Verify lookup for non-existent module
    tables_unknown = unified.get_tables_for_module("unknown_module")
    assert tables_unknown == set()
