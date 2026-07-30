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

from unittest.mock import MagicMock

import pytest
import requests

from common.clients.lakehouse import BigLakeDeltaSharingClient
from common.errors import CortexGcpError


def test_list_shares_success():
    mock_session = MagicMock(spec=requests.Session)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "shares": [{"name": "share1"}, {"name": "share2"}],
    }
    mock_session.get.return_value = mock_response

    client = BigLakeDeltaSharingClient(session=mock_session)
    shares = client.list_shares("proj", "us", "cat1")

    assert len(shares) == 2
    assert shares[0]["name"] == "share1"
    mock_session.get.assert_called_once_with(
        "https://biglake.googleapis.com/deltasharing/v1alpha/projects/proj/catalogs/cat1/shares",
        params={},
    )


def test_pagination():
    mock_session = MagicMock(spec=requests.Session)

    resp_page1 = MagicMock()
    resp_page1.status_code = 200
    resp_page1.json.return_value = {
        "schemas": [{"name": "schema1"}],
        "nextPageToken": "token_page_2",
    }

    resp_page2 = MagicMock()
    resp_page2.status_code = 200
    resp_page2.json.return_value = {
        "schemas": [{"name": "schema2"}],
    }

    mock_session.get.side_effect = [resp_page1, resp_page2]

    client = BigLakeDeltaSharingClient(session=mock_session)
    schemas = client.list_schemas("proj", "us", "cat1", "share1")

    assert len(schemas) == 2
    assert schemas[0]["name"] == "schema1"
    assert schemas[1]["name"] == "schema2"
    assert mock_session.get.call_count == 2
    mock_session.get.assert_any_call(
        "https://biglake.googleapis.com/deltasharing/v1alpha/projects/proj/catalogs/cat1/shares/share1/schemas",
        params={},
    )
    mock_session.get.assert_any_call(
        "https://biglake.googleapis.com/deltasharing/v1alpha/projects/proj/catalogs/cat1/shares/share1/schemas",
        params={"pageToken": "token_page_2"},
    )


def test_http_error_handling():
    mock_session = MagicMock(spec=requests.Session)
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Permission Denied"
    mock_session.get.return_value = mock_response

    client = BigLakeDeltaSharingClient(session=mock_session)

    with pytest.raises(CortexGcpError, match="HTTP error 403"):
        client.list_tables("proj", "us", "cat1", "share1", "schema1")


def test_network_exception_handling():
    mock_session = MagicMock(spec=requests.Session)
    mock_session.get.side_effect = requests.ConnectionError("Connection refused")

    client = BigLakeDeltaSharingClient(session=mock_session)

    with pytest.raises(CortexGcpError, match="Failed to communicate with BigLake"):
        client.list_tables("proj", "us", "cat1", "share1", "schema1")


def test_result_key_precedence():
    mock_session = MagicMock(spec=requests.Session)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "schemas": [{"name": "wrong_schema"}],
        "tables": [{"name": "correct_table"}],
    }
    mock_session.get.return_value = mock_response

    client = BigLakeDeltaSharingClient(session=mock_session)
    tables = client.list_tables("proj", "us", "cat1", "share1", "schema1")

    assert len(tables) == 1
    assert tables[0]["name"] == "correct_table"
