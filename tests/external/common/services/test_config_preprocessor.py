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

"""Unit tests for config_utils.py."""

import pytest

from common.services.config_preprocessor import ConfigPreprocessor


def test_config_preprocessor_resolve_string():
    """Test ConfigPreprocessor._resolve_string with various inputs."""
    preprocessor = ConfigPreprocessor({"TEST_VAR": "value", "FALLBACK_VAR": "value2"})
    assert preprocessor._resolve_string("${TEST_VAR}") == "value"
    assert preprocessor._resolve_string("prefix_${TEST_VAR}_suffix") == "prefix_value_suffix"


def test_config_preprocessor_process_dict():
    """Test ConfigPreprocessor.process with dictionary structures."""
    preprocessor = ConfigPreprocessor({"PROJECT_ID": "my-project"})
    config = {
        "projectId": "${PROJECT_ID}",
        "nested": {"projectId": "${PROJECT_ID}", "other": "val"},
    }
    result = preprocessor.process(config)
    assert result["projectId"] == "my-project"
    assert result["nested"]["projectId"] == "my-project"
    assert result["nested"]["other"] == "val"


def test_config_preprocessor_process_list():
    """Test ConfigPreprocessor.process with list structures."""
    preprocessor = ConfigPreprocessor({"REGION": "us-central1"})
    config = {"targets": [{"region": "${REGION}"}, {"nested": {"region": "${REGION}"}}]}
    result = preprocessor.process(config)
    assert result["targets"][0]["region"] == "us-central1"
    assert result["targets"][1]["nested"]["region"] == "us-central1"


def test_config_preprocessor_unresolved_error():
    """Test ConfigPreprocessor raises error for unresolved variables without fallback."""
    preprocessor = ConfigPreprocessor({})
    with pytest.raises(ValueError, match="Unresolved configuration variable"):
        preprocessor.process({"key": "${UNRESOLVED_VAR}"})
