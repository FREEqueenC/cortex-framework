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

import abc
import logging
import pathlib

from common.clients.dataform import DataformClient
from common.schemas import config_schema

logger = logging.getLogger(__name__)


class PostDeploymentAction(abc.ABC):
    """Abstract base class for composable post-deployment actions."""

    @abc.abstractmethod
    def execute(
        self,
        global_config: config_schema.GlobalConfig,
        target_config: config_schema.DeploymentTargetConfig,
        output_dir: pathlib.Path,
    ) -> bool:
        """Executes the post-deployment action.

        Args:
            global_config: The global configuration.
            target_config: The deployment target configuration.
            output_dir: The path where compiled artifacts are stored.

        Returns:
            True if successful, False otherwise.
        """
        pass


class DataformDemoAction(PostDeploymentAction):
    """Executes Dataform demo compilation and workflow invocation.

    This action compiles the workspace, sets up default scheduled workflows,
    and triggers an immediate run. It is designed to be injected by the
    demo CLI entrypoint.
    """

    _WORKFLOW_CONFIG_SCHEDULES = {
        "hourly": "0 * * * *",
        "daily": "0 2 * * *",
        "weekly": "0 2 * * 0",
        "monthly": "0 2 1 * *",
        "yearly": "0 2 1 1 *",
    }

    def __init__(self, client: DataformClient | None = None):
        self.client = client or DataformClient()

    def execute(
        self,
        global_config: config_schema.GlobalConfig,
        target_config: config_schema.DeploymentTargetConfig,
        output_dir: pathlib.Path,
    ) -> bool:
        if not isinstance(target_config, config_schema.DataformDeploymentTargetConfig):
            # This action only applies to Dataform targets. If mixed with others, simply skip.
            logger.info("Skipping Demo Action: Target is not a Dataform deployment.")
            return True

        settings = target_config.target_settings
        df_project = settings.repository_project_id
        df_region = settings.repository_region
        df_repo = settings.repository_name
        df_workspace_name = settings.workspace_name

        logger.info("Committing workspace '%s'...", df_workspace_name)
        if not self.client.commit_workspace(
            project=df_project,
            region=df_region,
            repo=df_repo,
            workspace=df_workspace_name,
            commit_message="Automated commit by Cortex Demo Deployer",
        ):
            return False

        logger.info("Pushing workspace '%s' to remote...", df_workspace_name)
        if not self.client.push_workspace(
            project=df_project,
            region=df_region,
            repo=df_repo,
            workspace=df_workspace_name,
        ):
            return False

        release_config_name = f"{df_repo}-release"
        logger.info("Creating release configuration '%s'...", release_config_name)
        if not self.client.modify_release_config(
            project=df_project,
            region=df_region,
            repo=df_repo,
            release_config_id=release_config_name,
            git_commitish="main",
        ):
            return False

        logger.info("Creating compilation result for '%s'...", release_config_name)
        compilation_result = self.client.create_compilation_result(
            project=df_project,
            region=df_region,
            repo=df_repo,
            release_config_id=release_config_name,
        )
        if not compilation_result:
            return False

        # Resolve service account
        sa_to_use = settings.service_account

        logger.info(
            "Creating and invoking scheduled workflow configurations using SA: %s", sa_to_use
        )
        for schedule_name, cron_expression in self._WORKFLOW_CONFIG_SCHEDULES.items():
            workflow_config_id = f"{df_repo}-{schedule_name}"
            if not self.client.modify_workflow_config(
                project=df_project,
                region=df_region,
                repo=df_repo,
                workflow_config_id=workflow_config_id,
                release_config_name=release_config_name,
                cron_schedule=cron_expression,
                time_zone="UTC",
                tags=[schedule_name],
                service_account=sa_to_use,
            ):
                return False

        logger.info("Triggering on-demand workflow invocation...")
        invocation = self.client.create_workflow_invocation(
            project=df_project,
            region=df_region,
            repo=df_repo,
            compilation_result_name=compilation_result.name,
            service_account=sa_to_use,
        )
        return bool(invocation)
