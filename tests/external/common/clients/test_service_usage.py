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

from unittest.mock import Mock

import pytest
from google.api_core.exceptions import NotFound
from google.cloud import service_usage_v1

from common.clients.service_usage import ServiceUsageClient


def test_is_api_enabled_success():
    mock_client = Mock(spec=service_usage_v1.ServiceUsageClient)
    mock_response = Mock()
    mock_response.state = service_usage_v1.State.ENABLED
    mock_client.get_service.return_value = mock_response

    su = ServiceUsageClient(client=mock_client)
    assert su.is_api_enabled("proj-1", "api.googleapis.com")


def test_is_api_enabled_disabled():
    mock_client = Mock(spec=service_usage_v1.ServiceUsageClient)
    mock_response = Mock()
    mock_response.state = service_usage_v1.State.DISABLED
    mock_client.get_service.return_value = mock_response

    su = ServiceUsageClient(client=mock_client)
    assert not su.is_api_enabled("proj-1", "api.googleapis.com")


def test_is_api_enabled_not_found():
    mock_client = Mock(spec=service_usage_v1.ServiceUsageClient)
    mock_client.get_service.side_effect = NotFound("Service not found")

    su = ServiceUsageClient(client=mock_client)
    with pytest.raises(NotFound, match="Service not found"):
        su.is_api_enabled("proj-1", "api.googleapis.com")


def test_is_api_enabled_raises_other_exception():
    mock_client = Mock(spec=service_usage_v1.ServiceUsageClient)
    mock_client.get_service.side_effect = RuntimeError("ADC not valid")

    su = ServiceUsageClient(client=mock_client)
    with pytest.raises(RuntimeError, match="ADC not valid"):
        su.is_api_enabled("proj-1", "api.googleapis.com")
