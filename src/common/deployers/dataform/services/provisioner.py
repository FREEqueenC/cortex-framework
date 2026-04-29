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

"""Provisions Dataform repositories and workspaces."""

import logging

from common.clients.dataform import DataformClient
from common.schemas import config_schema

logger = logging.getLogger(__name__)


class DataformWorkspaceProvisioner:
    """Provisions Dataform repositories and workspaces."""

    def __init__(self, client: DataformClient | None = None):
        self.client = client or DataformClient()

    def provision_workspace(self, settings: config_schema.DataformTargetSettings) -> bool:
        """Ensures repository and workspace exist.

        Args:
            settings: Dataform settings configuration.

        Returns:
            True if provisioning succeeded, False otherwise.
        """
        project = settings.repository_project_id
        region = settings.repository_region
        repo = settings.repository_name
        workspace = settings.workspace_name

        logger.info("Provisioning Dataform workspace '%s' in repo '%s'...", workspace, repo)

        if not self.client.has_repository(
            project=project, region=region, repo=repo
        ) and not self.client.create_repository(
            project=project, region=region, repo=repo, service_account=settings.service_account
        ):
            logger.error("Failed to ensure repository '%s' exists.", repo)
            return False

        if not self.client.has_workspace(
            project=project, region=region, repo=repo, workspace=workspace
        ) and not self.client.create_workspace(
            project=project, region=region, repo=repo, workspace=workspace
        ):
            logger.error("Failed to ensure workspace '%s' exists.", workspace)
            return False

        logger.info("Successfully provisioned Dataform workspace '%s'.", workspace)
        return True
