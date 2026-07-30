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

"""Client for Google Cloud BigLake Delta Sharing REST API."""

import logging
from collections.abc import Mapping, Sequence
from typing import Any

import google.auth
import requests
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import AuthorizedSession

from common.errors import CortexGcpError

logger = logging.getLogger(__name__)

BASE_URL = "https://biglake.googleapis.com/deltasharing/v1alpha"


class BigLakeDeltaSharingClient:
    """Encapsulates BigLake Delta Sharing REST client interactions."""

    def __init__(self, session: requests.Session | None = None):
        """
        Initializes the client.

        Args:
            session: Optional pre-authenticated requests.Session. If None,
                a new session is created using google.auth.default().
        """
        if session is not None:
            self.session = session
        else:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            self.session = AuthorizedSession(credentials)

    def _paginate(
        self,
        url: str,
        result_keys: str | Sequence[str],
        params: Mapping[str, Any] | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        """Handles GET requests, pagination loops, and exception translation.

        Args:
            url: The endpoint URL to fetch.
            result_keys: Expected JSON key(s) containing the results array (checked in order).
            params: Optional query parameters for the GET request.

        Returns:
            A list of mapping objects retrieved across all pagination pages.

        Raises:
            CortexGcpError: If an HTTP error occurs or communication fails.
        """
        results: list[Mapping[str, Any]] = []
        request_params = dict(params or {})
        keys_to_check = (result_keys,) if isinstance(result_keys, str) else tuple(result_keys)

        while True:
            try:
                response = self.session.get(url, params=request_params.copy())
                if response.status_code >= 400:
                    raise CortexGcpError(
                        f"BigLake API HTTP error {response.status_code} for GET {url}: "
                        f"{response.text}",
                        hint=(
                            "Verify BigLake IAM permissions (roles/biglake.viewer) "
                            "and resource names."
                        ),
                    )
                data = response.json()
            except (requests.RequestException, GoogleAuthError) as e:
                raise CortexGcpError(
                    f"Failed to communicate with BigLake Delta Sharing API at {url}: {e}",
                    hint="Check your network connectivity and Google Cloud credentials.",
                ) from e

            for key in keys_to_check:
                if key in data and isinstance(data[key], list):
                    results.extend(data[key])
                    break

            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break
            request_params["pageToken"] = next_page_token

        return results

    def list_shares(self, project: str, location: str, catalog: str) -> Sequence[Mapping[str, Any]]:
        """Lists all shares within a given catalog.

        Args:
            project: The target Google Cloud project ID.
            location: The region or location of the catalog (e.g., 'us', 'us-central1').
            catalog: The identifier of the BigLake catalog resource.

        Returns:
            A list of dictionary objects representing shares discovered in the catalog.

        Raises:
            CortexGcpError: If an HTTP error occurs or communication fails.
        """
        url = f"{BASE_URL}/projects/{project}/catalogs/{catalog}/shares"
        logger.info("Listing BigLake shares for catalog: %s in project: %s", catalog, project)
        return self._paginate(url, ("deltaSharingShares", "shares"))

    def list_schemas(
        self, project: str, location: str, catalog: str, share: str
    ) -> Sequence[Mapping[str, Any]]:
        """Lists all schemas within a given share.

        Args:
            project: The target Google Cloud project ID.
            location: The region or location of the catalog (e.g., 'us', 'us-central1').
            catalog: The identifier of the BigLake catalog resource.
            share: The identifier of the share within the catalog.

        Returns:
            A list of dictionary objects representing database schemas within the share.

        Raises:
            CortexGcpError: If an HTTP error occurs or communication fails.
        """
        url = f"{BASE_URL}/projects/{project}/catalogs/{catalog}/shares/{share}/schemas"
        logger.info("Listing BigLake schemas for share: %s in catalog: %s", share, catalog)
        return self._paginate(url, ("deltaSharingSchemas", "schemas"))

    def list_tables(
        self, project: str, location: str, catalog: str, share: str, schema_id: str
    ) -> Sequence[Mapping[str, Any]]:
        """Lists all tables within a given schema.

        Args:
            project: The target Google Cloud project ID.
            location: The region or location of the catalog (e.g., 'us', 'us-central1').
            catalog: The identifier of the BigLake catalog resource.
            share: The identifier of the share within the catalog.
            schema_id: The identifier of the schema container within the share.

        Returns:
            A list of dictionary objects representing physical tables in the schema.

        Raises:
            CortexGcpError: If an HTTP error occurs or communication fails.
        """
        url = (
            f"{BASE_URL}/projects/{project}/catalogs/{catalog}/shares/{share}"
            f"/schemas/{schema_id}/tables"
        )
        logger.info("Listing BigLake tables for schema: %s in share: %s", schema_id, share)
        return self._paginate(url, ("deltaSharingTables", "tables"))
