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

import base64
import functools
import logging
import random
import time

from google.api_core import exceptions
from google.api_core.exceptions import (
    Aborted,
    BadGateway,
    DeadlineExceeded,
    GatewayTimeout,
    InternalServerError,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)
from google.cloud import dataform_v1beta1
from google.protobuf import field_mask_pb2

from common.utils.rate_limiter import TokenRateLimiter

logger = logging.getLogger(__name__)

# Standard transient / retryable Google Cloud API exceptions
DEFAULT_RETRYABLE_EXCEPTIONS = (
    ResourceExhausted,
    TooManyRequests,
    ServiceUnavailable,
    DeadlineExceeded,
    BadGateway,
    GatewayTimeout,
    InternalServerError,
    Aborted,
    ConnectionError,
    TimeoutError,
)

_NO_FALLBACK = object()


def retry_with_backoff(
    max_retries: int = 5,
    initial_delay: float = 1.5,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple[type[Exception], ...] = DEFAULT_RETRYABLE_EXCEPTIONS,
    fallback: object = _NO_FALLBACK,
):
    """Decorator for retrying transient API errors with exponential backoff and jitter."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    if attempt == max_retries:
                        logger.error(
                            "Exceeded max retries (%d) during %s: %s",
                            max_retries,
                            func.__name__,
                            e,
                        )
                        if fallback is not _NO_FALLBACK:
                            return fallback
                        raise
                    jitter = random.uniform(0.1, 0.5)
                    sleep_time = delay + jitter
                    logger.warning(
                        "Transient error (%s) encountered during %s "
                        "(attempt %d/%d). Retrying in %.2fs...",
                        type(e).__name__,
                        func.__name__,
                        attempt,
                        max_retries,
                        sleep_time,
                    )
                    time.sleep(sleep_time)
                    delay *= backoff_factor

        return wrapper

    return decorator


class DataformClient:
    """Encapsulates Dataform client interactions."""

    def __init__(
        self,
        client: dataform_v1beta1.DataformClient | None = None,
        rate_limiter: TokenRateLimiter | None = None,
    ):
        self.client = client or dataform_v1beta1.DataformClient()
        self.rate_limiter = rate_limiter or TokenRateLimiter(rate=4.5, capacity=5.0)

    def get_repository(self, name: str) -> dataform_v1beta1.Repository | None:
        """Gets a repository."""
        try:
            return self.client.get_repository(name=name)
        except exceptions.NotFound:
            return None
        except Exception as e:
            logger.error("Failed to get repository %s: %s", name, e)
            raise

    def has_repository(self, *, project: str, region: str, repo: str) -> bool:
        """Checks if a repository exists."""
        name = self.client.repository_path(project, region, repo)
        logger.info("Checking if Dataform Repository %r exists...", name)
        if self.get_repository(name):
            logger.info("Repository %r already exists.", name)
            return True
        logger.info("Repository %r does not exist.", name)
        return False

    def get_workspace(self, name: str) -> dataform_v1beta1.Workspace | None:
        """Gets a workspace."""
        try:
            return self.client.get_workspace(name=name)
        except exceptions.NotFound:
            return None
        except Exception as e:
            logger.error("Failed to get workspace %s: %s", name, e)
            raise

    def has_workspace(self, *, project: str, region: str, repo: str, workspace: str) -> bool:
        """Checks if a workspace exists."""
        name = self.client.workspace_path(project, region, repo, workspace)
        logger.info("Checking if Dataform Workspace %r exists...", name)
        if self.get_workspace(name):
            logger.info("Workspace %r already exists.", name)
            return True
        logger.info("Workspace %r does not exist.", name)
        return False

    def create_repository(
        self, *, project: str, region: str, repo: str, service_account: str | None = None
    ) -> bool:
        """Creates a repository."""
        logger.info("Creating Dataform Repository '%s'...", repo)
        parent = f"projects/{project}/locations/{region}"

        if service_account:
            repository = dataform_v1beta1.Repository(name=repo, service_account=service_account)
        else:
            repository = dataform_v1beta1.Repository(name=repo)

        request = dataform_v1beta1.CreateRepositoryRequest(
            parent=parent,
            repository_id=repo,
            repository=repository,
        )
        try:
            self.client.create_repository(request=request)
            logger.info("Repository '%s' created successfully.", repo)
            return True
        except Exception as e:
            logger.error("Failed to create repository '%s': %s", repo, e)
            return False

    def delete_repository(
        self, *, project: str, region: str, repo: str, force: bool = False
    ) -> bool:
        """Deletes a repository."""
        logger.info("Deleting Dataform Repository '%s' (force=%s)...", repo, force)
        name = self.client.repository_path(project, region, repo)
        request = dataform_v1beta1.DeleteRepositoryRequest(
            name=name,
            force=force,
        )
        try:
            self.client.delete_repository(request=request)
            logger.info("Repository '%s' deleted successfully.", repo)
            return True
        except exceptions.NotFound:
            logger.info("Repository '%s' not found (ignored).", repo)
            return True
        except Exception as e:
            logger.error("Failed to delete repository '%s': %s", repo, e)
            return False

    def create_workspace(self, *, project: str, region: str, repo: str, workspace: str) -> bool:
        """Creates a workspace."""
        logger.info("Creating Dataform Workspace '%s'...", workspace)
        request = dataform_v1beta1.CreateWorkspaceRequest(
            parent=self.client.repository_path(project, region, repo),
            workspace_id=workspace,
        )
        try:
            self.client.create_workspace(request=request)
            logger.info("Workspace '%s' created successfully.", workspace)
            return True
        except exceptions.AlreadyExists:
            logger.info("Workspace '%s' already exists.", workspace)
            return False
        except Exception as e:
            logger.error("Failed to create workspace '%s': %s", workspace, e)
            return False

    def delete_workspace(self, *, project: str, region: str, repo: str, workspace: str) -> bool:
        """Deletes a workspace."""
        logger.info("Deleting Dataform Workspace '%s'...", workspace)
        name = self.client.workspace_path(project, region, repo, workspace)
        try:
            self.client.delete_workspace(name=name)
            logger.info("Workspace '%s' deleted successfully.", workspace)
            return True
        except exceptions.NotFound:
            logger.info("Workspace '%s' not found (ignored).", workspace)
            return True
        except Exception as e:
            logger.error("Failed to delete workspace '%s': %s", workspace, e)
            return False

    @retry_with_backoff(fallback=False)
    def write_file(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        workspace: str,
        rel_path: str,
        b64_content: str,
    ) -> bool:
        """Writes a file to the workspace."""
        self.rate_limiter.acquire(1.0)
        logger.info("  -> Writing file: %s", rel_path)
        request = dataform_v1beta1.WriteFileRequest(
            workspace=self.client.workspace_path(project, region, repo, workspace),
            path=rel_path,
            contents=base64.b64decode(b64_content),
        )
        try:
            self.client.write_file(request=request)
            return True
        except DEFAULT_RETRYABLE_EXCEPTIONS:
            raise
        except Exception as e:
            logger.error("Failed to write file '%s': %s", rel_path, e)
            return False

    @retry_with_backoff(fallback=False)
    def delete_file(
        self, *, project: str, region: str, repo: str, workspace: str, filepath: str
    ) -> bool:
        """Deletes a file from the workspace."""
        self.rate_limiter.acquire(1.0)
        logger.debug("  -> Deleting file: %s", filepath)
        request = dataform_v1beta1.RemoveFileRequest(
            workspace=self.client.workspace_path(project, region, repo, workspace), path=filepath
        )
        try:
            self.client.remove_file(request=request)
            return True
        except DEFAULT_RETRYABLE_EXCEPTIONS:
            raise
        except Exception as e:
            logger.error("Failed to delete file '%s': %s", filepath, e)
            return False

    @retry_with_backoff(fallback=False)
    def delete_directory(
        self, *, project: str, region: str, repo: str, workspace: str, dirpath: str
    ) -> bool:
        """Deletes a directory from the workspace."""
        self.rate_limiter.acquire(1.0)
        logger.debug("  -> Deleting directory: %s", dirpath)
        request = dataform_v1beta1.RemoveDirectoryRequest(
            workspace=self.client.workspace_path(project, region, repo, workspace), path=dirpath
        )
        try:
            self.client.remove_directory(request=request)
            return True
        except DEFAULT_RETRYABLE_EXCEPTIONS:
            raise
        except Exception as e:
            logger.error("Failed to delete directory '%s': %s", dirpath, e)
            return False

    @retry_with_backoff(fallback=None)
    def read_file(
        self, *, project: str, region: str, repo: str, workspace: str, rel_path: str
    ) -> bytes | None:
        """Reads a file from the workspace."""
        self.rate_limiter.acquire(1.0)
        try:
            request = dataform_v1beta1.ReadFileRequest(
                workspace=self.client.workspace_path(project, region, repo, workspace),
                path=rel_path,
            )
            response = self.client.read_file(request=request)
            return response.file_contents
        except exceptions.NotFound:
            return None
        except DEFAULT_RETRYABLE_EXCEPTIONS:
            raise
        except Exception as e:
            logger.error("Failed to read file '%s': %s", rel_path, e)
            return None

    @retry_with_backoff()
    def query_directory_contents(
        self, *, project: str, region: str, repo: str, workspace: str, current_path: str
    ) -> list[dataform_v1beta1.DirectoryEntry]:
        """Queries directory contents."""
        self.rate_limiter.acquire(1.0)
        workspace_path = self.client.workspace_path(project, region, repo, workspace)
        entries = []
        page_token = None
        try:
            while True:
                request = dataform_v1beta1.QueryDirectoryContentsRequest(
                    workspace=workspace_path,
                    path=current_path,
                    page_token=page_token,
                )
                response = self.client.query_directory_contents(request=request)
                entries.extend(response.directory_entries)
                page_token = response.next_page_token
                if not page_token:
                    break
            return entries
        except exceptions.NotFound:
            logger.warning(f"Directory not found, skipping: {current_path}")
            return []
        except DEFAULT_RETRYABLE_EXCEPTIONS:
            raise
        except Exception as e:
            logger.error("Failed to query directory contents for '%s': %s", current_path, e)
            raise

    def commit_workspace(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        workspace: str,
        commit_message: str,
    ) -> bool:
        """Commits changes in the specified workspace."""
        logger.info("Committing changes in workspace '%s'", workspace)
        workspace_name = self.client.workspace_path(project, region, repo, workspace)
        try:
            request = dataform_v1beta1.CommitWorkspaceChangesRequest(
                name=workspace_name,
                author=dataform_v1beta1.CommitAuthor(
                    name="Cortex Demo Deployer",
                    email_address="cortex@demo.com",
                ),
                commit_message=commit_message,
            )
            self.client.commit_workspace_changes(request=request)
            logger.info("Changes committed successfully in workspace '%s'", workspace)
            return True
        except Exception as e:
            logger.error("Failed to commit changes in workspace '%s': %s", workspace, e)
            return False

    def push_workspace(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        workspace: str,
        remote_branch: str = "main",
    ) -> bool:
        """Pushes changes from the workspace to the remote repository."""
        logger.info(
            "Pushing changes from workspace '%s' to remote branch '%s'", workspace, remote_branch
        )
        workspace_name = self.client.workspace_path(project, region, repo, workspace)
        try:
            request = dataform_v1beta1.PushGitCommitsRequest(
                name=workspace_name,
                remote_branch=remote_branch,
            )
            self.client.push_git_commits(request=request)
            logger.info(
                "Successfully pushed changes from workspace '%s' to remote branch '%s'",
                workspace,
                remote_branch,
            )
            return True
        except Exception as e:
            logger.error(
                "Failed to push changes from workspace '%s' to remote branch '%s': %s",
                workspace,
                remote_branch,
                e,
            )
            return False

    def modify_release_config(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        release_config_id: str,
        git_commitish: str,
        cron_schedule: str | None = None,
        time_zone: str | None = None,
    ) -> bool:
        """Modifies a release configuration (creates if not exists, updates otherwise)."""
        logger.info("Modifying release configuration '%s'", release_config_id)
        parent = self.client.repository_path(project, region, repo)
        release_config = dataform_v1beta1.ReleaseConfig(
            git_commitish=git_commitish,
        )
        paths = ["git_commitish"]
        if cron_schedule:
            release_config.cron_schedule = cron_schedule
            paths.append("cron_schedule")
        if time_zone:
            release_config.time_zone = time_zone
            paths.append("time_zone")

        request = dataform_v1beta1.CreateReleaseConfigRequest(
            parent=parent,
            release_config=release_config,
            release_config_id=release_config_id,
        )
        try:
            self.client.create_release_config(request=request)
            logger.info("Release configuration '%s' created successfully", release_config_id)
            return True
        except exceptions.AlreadyExists:
            logger.info("Release configuration '%s' already exists, updating...", release_config_id)
            release_config.name = self.client.release_config_path(
                project, region, repo, release_config_id
            )
            update_request = dataform_v1beta1.UpdateReleaseConfigRequest(
                release_config=release_config,
                update_mask=field_mask_pb2.FieldMask(paths=paths),
            )
            try:
                self.client.update_release_config(request=update_request)
                logger.info("Release configuration '%s' updated successfully", release_config_id)
                return True
            except Exception as e:
                logger.error(
                    "Failed to update release configuration '%s': %s", release_config_id, e
                )
            return False
        except Exception as e:
            logger.error("Failed to create release configuration '%s': %s", release_config_id, e)
            return False

    def create_compilation_result(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        release_config_id: str,
    ) -> dataform_v1beta1.CompilationResult | None:
        """Creates a new compilation result for a release config."""
        logger.info(
            "Creating compilation result for release config '%s' in repo '%s'",
            release_config_id,
            repo,
        )
        parent = self.client.repository_path(project, region, repo)
        release_config_name = self.client.release_config_path(
            project, region, repo, release_config_id
        )
        compilation_result = dataform_v1beta1.CompilationResult(release_config=release_config_name)
        request = dataform_v1beta1.CreateCompilationResultRequest(
            parent=parent,
            compilation_result=compilation_result,
        )
        try:
            result = self.client.create_compilation_result(request=request)
            logger.info("Compilation result '%s' created successfully", result.name)
            return result
        except Exception as e:
            logger.error(
                "Failed to create compilation result for release config '%s': %s",
                release_config_id,
                e,
            )
            return None

    def get_workflow_config(self, name: str) -> dataform_v1beta1.WorkflowConfig | None:
        """Gets a workflow configuration."""
        try:
            return self.client.get_workflow_config(name=name)
        except exceptions.NotFound:
            return None
        except Exception as e:
            logger.error("Failed to get workflow configuration %s: %s", name, e)
            raise

    def delete_workflow_config(self, name: str) -> bool:
        """Deletes a workflow configuration."""
        try:
            self.client.delete_workflow_config(name=name)
            return True
        except exceptions.NotFound:
            return True
        except Exception as e:
            logger.error("Failed to delete workflow configuration %s: %s", name, e)
            return False

    def modify_workflow_config(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        workflow_config_id: str,
        release_config_name: str,
        cron_schedule: str,
        time_zone: str,
        tags: list[str],
        service_account: str | None = None,
    ) -> bool:
        """Modifies a workflow configuration (creates if not exists, updates otherwise)."""
        logger.info("Modifying workflow configuration '%s'", workflow_config_id)
        parent = self.client.repository_path(project, region, repo)

        sa_to_use = service_account

        release_config_resource_name = (
            f"projects/{project}/locations/{region}/repositories/{repo}"
            f"/releaseConfigs/{release_config_name}"
        )

        inv_config = dataform_v1beta1.InvocationConfig(included_tags=tags)
        if sa_to_use:
            inv_config.service_account = sa_to_use

        workflow_config_obj = dataform_v1beta1.WorkflowConfig(
            release_config=release_config_resource_name,
            cron_schedule=cron_schedule,
            time_zone=time_zone,
            invocation_config=inv_config,
        )

        request = dataform_v1beta1.CreateWorkflowConfigRequest(
            parent=parent,
            workflow_config=workflow_config_obj,
            workflow_config_id=workflow_config_id,
        )

        workflow_config_name = self.client.workflow_config_path(
            project, region, repo, workflow_config_id
        )
        existing_config = self.get_workflow_config(workflow_config_name)

        if existing_config:
            logger.info(
                "Workflow configuration '%s' already exists, checking if update is needed...",
                workflow_config_id,
            )
            workflow_config_obj.name = workflow_config_name

            tags_match = False
            service_account_match = False

            existing_inv_config = existing_config.invocation_config
            existing_tags = set(existing_inv_config.included_tags)
            tags_match = existing_tags == set(tags)
            service_account_match = existing_inv_config.service_account == (sa_to_use or "")

            if tags_match and service_account_match:
                logger.info("Invocation config matches. Updating general fields.")
                update_request = dataform_v1beta1.UpdateWorkflowConfigRequest(
                    workflow_config=workflow_config_obj,
                    update_mask=field_mask_pb2.FieldMask(
                        paths=[
                            "release_config",
                            "cron_schedule",
                            "time_zone",
                        ]
                    ),
                )
                try:
                    self.client.update_workflow_config(request=update_request)
                    logger.info(
                        "Workflow configuration '%s' updated successfully", workflow_config_id
                    )
                    return True
                except Exception as e:
                    logger.error(
                        "Failed to update workflow configuration '%s': %s", workflow_config_id, e
                    )
                    return False
            else:
                logger.info(
                    "Invocation config differs (Tags match: %s, SA match: %s). Recreating...",
                    tags_match,
                    service_account_match,
                )
                if self.delete_workflow_config(workflow_config_name):
                    try:
                        self.client.create_workflow_config(request=request)
                        logger.info(
                            "Workflow configuration '%s' recreated successfully", workflow_config_id
                        )
                        return True
                    except Exception as e:
                        logger.error(
                            "Failed to recreate workflow configuration '%s': %s",
                            workflow_config_id,
                            e,
                        )
                        return False
                else:
                    logger.error(
                        "Failed to delete workflow config '%s' for recreation", workflow_config_id
                    )
                    return False
        else:
            logger.info("Creating new workflow configuration '%s'", workflow_config_id)
            try:
                self.client.create_workflow_config(request=request)
                logger.info("Workflow configuration '%s' created successfully", workflow_config_id)
                return True
            except Exception as e:
                logger.error(
                    "Failed to create workflow configuration '%s': %s", workflow_config_id, e
                )
                return False

    def create_workflow_invocation(
        self,
        *,
        project: str,
        region: str,
        repo: str,
        workflow_config_id: str | None = None,
        compilation_result_name: str | None = None,
        included_tags: list[str] | None = None,
        service_account: str | None = None,
    ) -> dataform_v1beta1.WorkflowInvocation | None:
        """Creates a new workflow invocation."""
        parent = self.client.repository_path(project, region, repo)
        workflow_invocation = dataform_v1beta1.WorkflowInvocation()

        if workflow_config_id:
            logger.info(
                "Creating workflow invocation for workflow config '%s'",
                workflow_config_id,
            )
            workflow_config_name = self.client.workflow_config_path(
                project, region, repo, workflow_config_id
            )
            workflow_invocation.workflow_config = str(workflow_config_name)
        elif compilation_result_name:
            logger.info(
                "Creating on-demand workflow invocation for compilation result '%s'",
                compilation_result_name,
            )
            workflow_invocation.compilation_result = compilation_result_name
        else:
            logger.error("Either workflow_config_id or compilation_result_name must be provided")
            return None

        invocation_config = dataform_v1beta1.InvocationConfig()
        if included_tags is not None:
            invocation_config.included_tags = included_tags
        if service_account:
            invocation_config.service_account = service_account

        workflow_invocation.invocation_config = invocation_config

        request = dataform_v1beta1.CreateWorkflowInvocationRequest(
            parent=parent,
            workflow_invocation=workflow_invocation,
        )

        try:
            result = self.client.create_workflow_invocation(request=request)
            logger.info("Workflow invocation '%s' created successfully", result.name)
            return result
        except Exception as e:
            logger.error("Failed to create workflow invocation: %s", e)
            return None

    def query_workflow_invocation_actions(
        self, *, name: str
    ) -> list[dataform_v1beta1.WorkflowInvocationAction]:
        """Queries actions for a workflow invocation."""
        actions = []
        page_token = None
        try:
            while True:
                request = dataform_v1beta1.QueryWorkflowInvocationActionsRequest(
                    name=name,
                    page_token=page_token,
                )
                response = self.client.query_workflow_invocation_actions(request=request)
                actions.extend(response.workflow_invocation_actions)
                page_token = response.next_page_token
                if not page_token:
                    break
            return actions
        except Exception as e:
            logger.error("Failed to query workflow invocation actions for %s: %s", name, e)
            return []
