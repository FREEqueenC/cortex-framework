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

"""Dataform deployer module for Cortex."""

import logging
import pathlib

from common.clients.dataform import DataformClient
from common.deployers.base import Deployer
from common.registry import deployer_registry
from common.schemas import config_schema

from .services.provisioner import DataformWorkspaceProvisioner
from .services.reconciler import DataformWorkspaceReconciler

logger = logging.getLogger(__name__)


@deployer_registry.register("dataform")
class DataformDeployer(Deployer):
    """Encapsulates Dataform deployment."""

    def __init__(self, client: DataformClient | None = None):
        self.client = client or DataformClient()
        self.provisioner = DataformWorkspaceProvisioner(self.client)
        self.reconciler = DataformWorkspaceReconciler(self.client)

    def deploy(
        self,
        global_config: config_schema.GlobalConfig,
        target_config: config_schema.DeploymentTargetConfig,
        output_dir: pathlib.Path,
    ) -> bool:
        """Deploys to Dataform."""

        if not isinstance(target_config, config_schema.DataformDeploymentTargetConfig):
            logger.error("DataformDeployer requires a DataformDeploymentTargetConfig.")
            return False

        if not output_dir.exists():
            logger.error(
                "Build output directory %s not found. Run build.py first.",
                output_dir,
            )
            return False

        if not self.provisioner.provision_workspace(settings=target_config.target_settings):
            return False

        logger.info(
            "Reconciling files to workspace '%s'...", target_config.target_settings.workspace_name
        )
        result = self.reconciler.reconcile_workspace(
            output_dir=output_dir, settings=target_config.target_settings
        )

        if result:
            project_id = target_config.target_settings.repository_project_id
            location = target_config.target_settings.repository_region
            repository_id = target_config.target_settings.repository_name
            workspace_name = target_config.target_settings.workspace_name
            dataform_url = (
                f"https://console.cloud.google.com/bigquery/dataform/locations/"
                f"{location}/repositories/{repository_id}/workspaces/{workspace_name}?project={project_id}"
            )
            logger.info("Dataform Workspace URL: %s", dataform_url)

        return result
