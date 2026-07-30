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

"""Client for Google Cloud BigQuery Reservation API."""

import logging
from collections.abc import Sequence
from typing import Any

from google.api_core.exceptions import GoogleAPICallError
from google.cloud import bigquery_reservation_v1

logger = logging.getLogger(__name__)


class BigQueryReservationClient:
    """Encapsulates BigQuery Reservation client interactions."""

    def __init__(self, client: bigquery_reservation_v1.ReservationServiceClient | None = None):
        """
        Initializes the client.

        Args:
            client: Optional pre-authenticated ReservationServiceClient. If None,
                a new client is created using
                google.cloud.bigquery_reservation_v1.ReservationServiceClient()
        """
        self.client = client or bigquery_reservation_v1.ReservationServiceClient()

    def _is_enterprise_plus(self, edition: Any) -> bool:
        """Helper to check if edition is ENTERPRISE_PLUS.

        Args:
            edition: The edition to check.

        Returns:
            True if the edition is ENTERPRISE_PLUS, False otherwise.
        """
        if edition == bigquery_reservation_v1.Edition.ENTERPRISE_PLUS or edition == 3:
            return True
        if hasattr(edition, "name") and edition.name == "ENTERPRISE_PLUS":
            return True
        return isinstance(edition, str) and edition.upper() == "ENTERPRISE_PLUS"

    def _is_query_job_type(self, job_type: Any) -> bool:
        """Helper to check if job_type is QUERY.

        Args:
            job_type: The job type to check.

        Returns:
            True if the job type is QUERY, False otherwise.
        """
        if job_type == bigquery_reservation_v1.Assignment.JobType.QUERY or job_type == 2:
            return True
        if hasattr(job_type, "name") and job_type.name == "QUERY":
            return True
        return isinstance(job_type, str) and job_type.upper() == "QUERY"

    def _matches_assignee(
        self,
        assignee: str,
        project_id: str,
        assignee_candidates: Sequence[str] | None = None,
    ) -> bool:
        """Checks if the assignee string matches any candidate in the project ancestry hierarchy.

        Args:
            assignee: The assignee string.
            project_id: The target GCP project ID.
            assignee_candidates: Optional sequence of resource names for hierarchy matching.

        Returns:
            True if the assignee string matches any candidate in the project ancestry hierarchy,
            False otherwise.
        """
        if not assignee:
            return False
        if assignee == f"projects/{project_id}" or assignee.endswith(f"/{project_id}"):
            return True
        if assignee_candidates:
            for candidate in assignee_candidates:
                if assignee == candidate or assignee.endswith(f"/{candidate}"):
                    return True
        return False

    def has_enterprise_plus_query_assignment(
        self,
        project_id: str,
        location: str,
        assignee_candidates: Sequence[str] | None = None,
    ) -> bool:
        """Checks if project hierarchy has a QUERY assignment to an ENTERPRISE_PLUS reservation.

        Args:
            project_id: The target GCP project ID.
            location: The BigQuery location (e.g., 'US', 'us', 'eu').
            assignee_candidates: Optional sequence of resource names for hierarchy matching.

        Returns:
            True if an active QUERY assignment exists, False otherwise.
        """
        parent = f"projects/{project_id}/locations/{location.lower()}"
        logger.info(
            "Checking BigQuery Enterprise Plus capacity for %s in %s across hierarchy",
            project_id,
            location,
        )

        try:
            reservations = list(self.client.list_reservations(parent=parent))
            for reservation in reservations:
                if self._is_enterprise_plus(reservation.edition):
                    logger.debug("Found ENTERPRISE_PLUS reservation: %s", reservation.name)
                    assignments = list(self.client.list_assignments(parent=reservation.name))
                    for assignment in assignments:
                        if self._is_query_job_type(assignment.job_type) and self._matches_assignee(
                            assignment.assignee, project_id, assignee_candidates
                        ):
                            logger.info(
                                "Confirmed ENTERPRISE_PLUS QUERY assignment %s for %s",
                                assignment.name,
                                project_id,
                            )
                            return True
        except GoogleAPICallError as e:
            logger.warning(
                "API error listing reservations for %s in location %s: %s. "
                "Trying search fallback...",
                project_id,
                location,
                e,
            )

        try:
            assignments = list(self.client.search_assignments(parent=parent))
            for assignment in assignments:
                if self._is_query_job_type(assignment.job_type) and self._matches_assignee(
                    assignment.assignee, project_id, assignee_candidates
                ):
                    res_name = assignment.name.split("/assignments/")[0]
                    try:
                        reservation = self.client.get_reservation(name=res_name)
                        if self._is_enterprise_plus(reservation.edition):
                            logger.info(
                                "Confirmed ENTERPRISE_PLUS QUERY assignment via search: %s",
                                assignment.name,
                            )
                            return True
                    except GoogleAPICallError as res_err:
                        logger.debug("API error getting reservation %s: %s", res_name, res_err)
        except GoogleAPICallError as e:
            logger.error(
                "API error searching assignments for project %s in location %s: %s",
                project_id,
                location,
                e,
            )

        logger.warning(
            "No ENTERPRISE_PLUS QUERY assignment found for project %s in location %s",
            project_id,
            location,
        )
        return False
