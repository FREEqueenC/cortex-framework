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

"""Client for Google Cloud Resource Manager API."""

import logging

from google.cloud import resourcemanager_v3

logger = logging.getLogger(__name__)


class ResourceManagerClient:
    """Encapsulates Resource Manager client interactions."""

    def __init__(self, client: resourcemanager_v3.ProjectsClient | None = None):
        self.client = client or resourcemanager_v3.ProjectsClient()

    def get_project_number(self, project_id: str) -> str:
        """Gets the project number for a given project ID.

        Args:
            project_id: The Google Cloud project ID (e.g. 'my-project').

        Returns:
            The project number as a string.

        Raises:
            Exception if the project could not be retrieved.
        """
        logger.info("Fetching project number for project ID: %s", project_id)
        try:
            name = f"projects/{project_id}"
            project = self.client.get_project(name=name)
            # The name field is in the format 'projects/{project_number}'
            project_number = project.name.split("/")[-1]
            logger.info("Resolved project ID %s to project number %s", project_id, project_number)
            return project_number
        except Exception as e:
            logger.error("Failed to get project number for project ID %s: %s", project_id, e)
            raise
