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

from google.cloud import bigquery_reservation_v1

from common.clients.bigquery_reservation import BigQueryReservationClient


def test_has_enterprise_plus_query_assignment_success_list():
    mock_client = MagicMock(spec=bigquery_reservation_v1.ReservationServiceClient)

    mock_res = MagicMock()
    mock_res.name = "projects/proj/locations/us/reservations/res1"
    mock_res.edition = bigquery_reservation_v1.Edition.ENTERPRISE_PLUS
    mock_client.list_reservations.return_value = [mock_res]

    mock_assign = MagicMock()
    mock_assign.name = "projects/proj/locations/us/reservations/res1/assignments/a1"
    mock_assign.job_type = bigquery_reservation_v1.Assignment.JobType.QUERY
    mock_assign.assignee = "projects/proj"
    mock_client.list_assignments.return_value = [mock_assign]

    client = BigQueryReservationClient(client=mock_client)
    assert client.has_enterprise_plus_query_assignment("proj", "us") is True
    mock_client.list_reservations.assert_called_once_with(parent="projects/proj/locations/us")
    mock_client.list_assignments.assert_called_once_with(
        parent="projects/proj/locations/us/reservations/res1"
    )


def test_has_enterprise_plus_query_assignment_fallback_search():
    mock_client = MagicMock(spec=bigquery_reservation_v1.ReservationServiceClient)
    mock_client.list_reservations.return_value = []

    mock_assign = MagicMock()
    mock_assign.name = "projects/proj/locations/us/reservations/res2/assignments/a2"
    mock_assign.job_type = "QUERY"
    mock_assign.assignee = "projects/123456789012"
    mock_client.search_assignments.return_value = [mock_assign]

    mock_res = MagicMock()
    mock_res.edition = "ENTERPRISE_PLUS"
    mock_client.get_reservation.return_value = mock_res

    client = BigQueryReservationClient(client=mock_client)
    assert (
        client.has_enterprise_plus_query_assignment(
            "proj", "us", assignee_candidates=["projects/123456789012"]
        )
        is True
    )
    mock_client.get_reservation.assert_called_once_with(
        name="projects/proj/locations/us/reservations/res2"
    )


def test_has_enterprise_plus_query_assignment_org_level():
    mock_client = MagicMock(spec=bigquery_reservation_v1.ReservationServiceClient)

    mock_res = MagicMock()
    mock_res.name = "projects/admin-proj/locations/us/reservations/org_res"
    mock_res.edition = bigquery_reservation_v1.Edition.ENTERPRISE_PLUS
    mock_client.list_reservations.return_value = [mock_res]

    mock_assign = MagicMock()
    mock_assign.name = "projects/admin-proj/locations/us/reservations/org_res/assignments/a_org"
    mock_assign.job_type = bigquery_reservation_v1.Assignment.JobType.QUERY
    mock_assign.assignee = "organizations/99999"
    mock_client.list_assignments.return_value = [mock_assign]

    client = BigQueryReservationClient(client=mock_client)
    assert (
        client.has_enterprise_plus_query_assignment(
            "proj", "us", assignee_candidates=["folders/111", "organizations/99999"]
        )
        is True
    )


def test_has_enterprise_plus_query_assignment_not_found():
    mock_client = MagicMock(spec=bigquery_reservation_v1.ReservationServiceClient)
    mock_client.list_reservations.return_value = []
    mock_client.search_assignments.return_value = []

    client = BigQueryReservationClient(client=mock_client)
    assert client.has_enterprise_plus_query_assignment("proj", "us") is False
