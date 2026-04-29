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

"""Client for Google Cloud Service Usage API."""

import logging

from google.cloud import service_usage_v1

logger = logging.getLogger(__name__)


class ServiceUsageClient:
    """Encapsulates Service Usage client interactions."""

    def __init__(self, client: service_usage_v1.ServiceUsageClient | None = None):
        self.client = client or service_usage_v1.ServiceUsageClient()

    def is_api_enabled(self, project_id: str, api: str) -> bool:
        """Checks if a specific API is enabled. Returns True if enabled, False otherwise."""
        logger.info("Checking API %s on project %s", api, project_id)
        try:
            request = service_usage_v1.GetServiceRequest(
                name=f"projects/{project_id}/services/{api}",
            )
            response = self.client.get_service(request=request)
            return response.state == service_usage_v1.State.ENABLED
        except Exception as e:
            logger.warning("Failed to check API status for %s on %s: %s", api, project_id, e)
            return False

    def enable_api(self, project_id: str, api: str) -> bool:
        """Enables a specific API. Returns True if successful."""
        logger.info("Enabling API %s on project %s", api, project_id)
        try:
            request = service_usage_v1.EnableServiceRequest(
                name=f"projects/{project_id}/services/{api}",
            )
            operation = self.client.enable_service(request=request)
            logger.info("Waiting for API enablement operation to complete...")
            operation.result()  # Wait for completion
            logger.info("Successfully enabled API: %s", api)
            return True
        except Exception as e:
            logger.error("Failed to enable API %s on %s: %s", api, project_id, e)
            return False
