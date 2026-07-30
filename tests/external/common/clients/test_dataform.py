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

"""Unit tests for DataformProvider."""

import base64
from unittest.mock import MagicMock, call, create_autospec, patch

import pytest
from google.api_core import exceptions
from google.cloud import dataform_v1beta1

from common.clients.dataform import DataformClient


@pytest.fixture
def mock_client():
    """Fixture to provide a mocked DataformClient."""
    return create_autospec(dataform_v1beta1.DataformClient, instance=True)


@pytest.fixture
def provider(mock_client):
    """Fixture to provide a DataformProvider instance with a mocked client."""
    return DataformClient(client=mock_client)


# Test Data
PROJECT = "test-project"
REGION = "us-central1"
REPO = "test-repo"
WORKSPACE = "test-workspace"
REPO_NAME = f"projects/{PROJECT}/locations/{REGION}/repositories/{REPO}"
WORKSPACE_NAME = f"{REPO_NAME}/workspaces/{WORKSPACE}"


@pytest.mark.parametrize(
    "mock_return, expected_result, side_effect",
    [
        (
            dataform_v1beta1.Repository(name=REPO_NAME),
            dataform_v1beta1.Repository(name=REPO_NAME),
            None,
        ),
        (None, None, exceptions.NotFound("Not found")),
    ],
    ids=["found", "not_found"],
)
def test_get_repository(provider, mock_client, mock_return, expected_result, side_effect):
    if side_effect:
        mock_client.get_repository.side_effect = side_effect
    else:
        mock_client.get_repository.return_value = mock_return

    result = provider.get_repository(REPO_NAME)
    assert result == expected_result
    mock_client.get_repository.assert_called_once_with(name=REPO_NAME)


@pytest.mark.parametrize(
    "get_repo_return, expected",
    [
        (MagicMock(spec=dataform_v1beta1.Repository), True),
        (None, False),
    ],
    ids=["exists", "not_exists"],
)
def test_has_repository(provider, mock_client, get_repo_return, expected):
    mock_client.repository_path.return_value = REPO_NAME
    with patch.object(provider, "get_repository", return_value=get_repo_return) as mock_get_repo:
        assert provider.has_repository(project=PROJECT, region=REGION, repo=REPO) is expected
        mock_client.repository_path.assert_called_once_with(PROJECT, REGION, REPO)
        mock_get_repo.assert_called_once_with(REPO_NAME)


@pytest.mark.parametrize(
    "side_effect, expected",
    [
        (None, True),
        (Exception("Failed"), False),
    ],
    ids=["success", "fail"],
)
def test_create_repository(provider, mock_client, side_effect, expected):
    if side_effect:
        mock_client.create_repository.side_effect = side_effect
    assert (
        provider.create_repository(
            project=PROJECT, region=REGION, repo=REPO, service_account="sa@test.com"
        )
        is expected
    )
    mock_client.create_repository.assert_called_once()


@pytest.mark.parametrize(
    "mock_return, expected_result, side_effect",
    [
        (
            dataform_v1beta1.Workspace(name=WORKSPACE_NAME),
            dataform_v1beta1.Workspace(name=WORKSPACE_NAME),
            None,
        ),
        (None, None, exceptions.NotFound("Not found")),
    ],
    ids=["found", "not_found"],
)
def test_get_workspace(provider, mock_client, mock_return, expected_result, side_effect):
    if side_effect:
        mock_client.get_workspace.side_effect = side_effect
    else:
        mock_client.get_workspace.return_value = mock_return

    result = provider.get_workspace(WORKSPACE_NAME)
    assert result == expected_result
    mock_client.get_workspace.assert_called_once_with(name=WORKSPACE_NAME)


@pytest.mark.parametrize(
    "get_ws_return, expected",
    [
        (MagicMock(spec=dataform_v1beta1.Workspace), True),
        (None, False),
    ],
    ids=["exists", "not_exists"],
)
def test_has_workspace(provider, mock_client, get_ws_return, expected):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    with patch.object(provider, "get_workspace", return_value=get_ws_return) as mock_get_ws:
        assert (
            provider.has_workspace(project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE)
            is expected
        )
        mock_client.workspace_path.assert_called_once_with(PROJECT, REGION, REPO, WORKSPACE)
        mock_get_ws.assert_called_once_with(WORKSPACE_NAME)


@pytest.mark.parametrize(
    "side_effect, expected",
    [
        (None, True),
        (exceptions.AlreadyExists("Exists"), False),
        (Exception("Failed"), False),
    ],
    ids=["success", "already_exists", "fail"],
)
def test_create_workspace(provider, mock_client, side_effect, expected):
    mock_client.repository_path.return_value = REPO_NAME
    if side_effect:
        mock_client.create_workspace.side_effect = side_effect

    assert (
        provider.create_workspace(project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE)
        is expected
    )

    if expected is True:  # Only check request on success
        expected_request = dataform_v1beta1.CreateWorkspaceRequest(
            parent=REPO_NAME,
            workspace_id=WORKSPACE,
        )
        mock_client.create_workspace.assert_called_once_with(request=expected_request)
    else:
        mock_client.create_workspace.assert_called_once()


@pytest.mark.parametrize(
    "side_effect, expected",
    [
        (None, True),
        (Exception("Failed"), False),
    ],
    ids=["success", "fail"],
)
def test_write_file(provider, mock_client, side_effect, expected):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    b64_content = base64.b64encode(b"test content").decode("utf-8")
    if side_effect:
        mock_client.write_file.side_effect = side_effect

    assert (
        provider.write_file(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            workspace=WORKSPACE,
            rel_path="file.sqlx",
            b64_content=b64_content,
        )
        is expected
    )

    if expected is True:
        expected_request = dataform_v1beta1.WriteFileRequest(
            workspace=WORKSPACE_NAME,
            path="file.sqlx",
            contents=b"test content",
        )
        mock_client.write_file.assert_called_once_with(request=expected_request)
    else:
        mock_client.write_file.assert_called_once()


@pytest.mark.parametrize(
    "side_effect, expected",
    [
        (None, True),
        (Exception("Failed"), False),
    ],
    ids=["success", "fail"],
)
def test_delete_file(provider, mock_client, side_effect, expected):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    if side_effect:
        mock_client.remove_file.side_effect = side_effect

    assert (
        provider.delete_file(
            project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, filepath="file.sqlx"
        )
        is expected
    )

    if expected is True:
        expected_request = dataform_v1beta1.RemoveFileRequest(
            workspace=WORKSPACE_NAME,
            path="file.sqlx",
        )
        mock_client.remove_file.assert_called_once_with(request=expected_request)
    else:
        mock_client.remove_file.assert_called_once()


@pytest.mark.parametrize(
    "side_effect, expected",
    [
        (None, True),
        (Exception("Failed"), False),
    ],
    ids=["success", "fail"],
)
def test_delete_directory(provider, mock_client, side_effect, expected):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    if side_effect:
        mock_client.remove_directory.side_effect = side_effect

    assert (
        provider.delete_directory(
            project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, dirpath="models"
        )
        is expected
    )

    if expected is True:
        expected_request = dataform_v1beta1.RemoveDirectoryRequest(
            workspace=WORKSPACE_NAME,
            path="models",
        )
        mock_client.remove_directory.assert_called_once_with(request=expected_request)
    else:
        mock_client.remove_directory.assert_called_once()


@pytest.mark.parametrize(
    "mock_return, expected_result, side_effect",
    [
        (MagicMock(file_contents=b"file content"), b"file content", None),
        (None, None, exceptions.NotFound("Not found")),
        (None, None, Exception("Failed")),
    ],
    ids=["success", "not_found", "fail"],
)
def test_read_file(provider, mock_client, mock_return, expected_result, side_effect):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    if side_effect:
        mock_client.read_file.side_effect = side_effect
    else:
        mock_client.read_file.return_value = mock_return

    assert (
        provider.read_file(
            project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, rel_path="file.sqlx"
        )
        == expected_result
    )

    if side_effect is None:
        expected_request = dataform_v1beta1.ReadFileRequest(
            workspace=WORKSPACE_NAME,
            path="file.sqlx",
        )
        mock_client.read_file.assert_called_once_with(request=expected_request)
    else:
        mock_client.read_file.assert_called_once()


def test_query_directory_contents_success(provider, mock_client):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    entry1 = dataform_v1beta1.DirectoryEntry(file="file1.sqlx")
    entry2 = dataform_v1beta1.DirectoryEntry(directory="subdir")
    mock_response = MagicMock()
    mock_response.directory_entries = [entry1, entry2]
    mock_response.next_page_token = ""
    mock_client.query_directory_contents.return_value = mock_response

    result = provider.query_directory_contents(
        project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, current_path=""
    )
    assert result == [entry1, entry2]
    expected_request = dataform_v1beta1.QueryDirectoryContentsRequest(
        workspace=WORKSPACE_NAME,
        path="",
        page_token=None,
    )
    mock_client.query_directory_contents.assert_called_once_with(request=expected_request)


def test_query_directory_contents_pagination(provider, mock_client):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    entry1 = dataform_v1beta1.DirectoryEntry(file="file1.sqlx")
    entry2 = dataform_v1beta1.DirectoryEntry(file="file2.sqlx")

    mock_response1 = MagicMock()
    mock_response1.directory_entries = [entry1]
    mock_response1.next_page_token = "next_token"

    mock_response2 = MagicMock()
    mock_response2.directory_entries = [entry2]
    mock_response2.next_page_token = ""

    mock_client.query_directory_contents.side_effect = [mock_response1, mock_response2]

    result = provider.query_directory_contents(
        project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, current_path="docs"
    )
    assert result == [entry1, entry2]
    assert mock_client.query_directory_contents.call_count == 2

    expected_request1 = dataform_v1beta1.QueryDirectoryContentsRequest(
        workspace=WORKSPACE_NAME,
        path="docs",
        page_token=None,
    )
    expected_request2 = dataform_v1beta1.QueryDirectoryContentsRequest(
        workspace=WORKSPACE_NAME,
        path="docs",
        page_token="next_token",
    )
    mock_client.query_directory_contents.assert_has_calls(
        [
            call(request=expected_request1),
            call(request=expected_request2),
        ]
    )


@pytest.mark.parametrize(
    "side_effect, expected_result, raises",
    [
        (exceptions.NotFound("Not found"), [], False),
        (Exception("Failed"), None, True),
    ],
    ids=["not_found", "fail"],
)
def test_query_directory_contents_errors(
    provider, mock_client, side_effect, expected_result, raises
):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    mock_client.query_directory_contents.side_effect = side_effect

    if raises:
        with pytest.raises(Exception, match="Failed"):
            provider.query_directory_contents(
                project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, current_path=""
            )
    else:
        assert (
            provider.query_directory_contents(
                project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE, current_path=""
            )
            == expected_result
        )

    mock_client.query_directory_contents.assert_called_once()


def test_modify_release_config_success(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    assert (
        provider.modify_release_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            release_config_id="test-release",
            git_commitish="main",
        )
        is True
    )
    mock_client.create_release_config.assert_called_once()


def test_modify_release_config_already_exists_updates(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.release_config_path.return_value = f"{REPO_NAME}/releaseConfigs/test-release"
    mock_client.create_release_config.side_effect = exceptions.AlreadyExists("Already exists")

    assert (
        provider.modify_release_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            release_config_id="test-release",
            git_commitish="main",
        )
        is True
    )

    mock_client.create_release_config.assert_called_once()
    mock_client.update_release_config.assert_called_once()


def test_modify_release_config_with_schedule_success(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    assert (
        provider.modify_release_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            release_config_id="test-release",
            git_commitish="main",
            cron_schedule="0 2 * * *",
            time_zone="PST",
        )
        is True
    )
    mock_client.create_release_config.assert_called_once()
    call_args = mock_client.create_release_config.call_args
    kwargs = call_args.kwargs
    request = kwargs["request"]
    assert request.release_config.cron_schedule == "0 2 * * *"
    assert request.release_config.time_zone == "PST"


def test_modify_release_config_with_schedule_already_exists_updates(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.release_config_path.return_value = f"{REPO_NAME}/releaseConfigs/test-release"
    mock_client.create_release_config.side_effect = exceptions.AlreadyExists("Already exists")

    assert (
        provider.modify_release_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            release_config_id="test-release",
            git_commitish="main",
            cron_schedule="0 2 * * *",
            time_zone="PST",
        )
        is True
    )

    mock_client.create_release_config.assert_called_once()
    mock_client.update_release_config.assert_called_once()

    call_args = mock_client.update_release_config.call_args
    kwargs = call_args.kwargs
    request = kwargs["request"]
    assert request.release_config.cron_schedule == "0 2 * * *"
    assert request.release_config.time_zone == "PST"
    assert set(request.update_mask.paths) == {"git_commitish", "cron_schedule", "time_zone"}


def test_modify_workflow_config_success(provider, mock_client, mocker):
    mock_client.repository_path.return_value = REPO_NAME
    # Simulate config does not exist
    mock_client.get_workflow_config.side_effect = exceptions.NotFound("Not found")

    assert (
        provider.modify_workflow_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            workflow_config_id="test-workflow",
            release_config_name="test-release",
            cron_schedule="0 0 * * *",
            time_zone="UTC",
            tags=["daily"],
            service_account="service-1234567890@gcp-sa-dataform.iam.gserviceaccount.com",
        )
        is True
    )
    mock_client.create_workflow_config.assert_called_once()


def test_modify_workflow_config_existing_matches_updates(provider, mock_client, mocker):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.workflow_config_path.return_value = f"{REPO_NAME}/workflowConfigs/test-workflow"

    # Mock existing config with matching invocation_config
    existing_config = dataform_v1beta1.WorkflowConfig(
        invocation_config=dataform_v1beta1.InvocationConfig(
            included_tags=["daily"],
            service_account="service-1234567890@gcp-sa-dataform.iam.gserviceaccount.com",
        )
    )
    mock_client.get_workflow_config.return_value = existing_config

    assert (
        provider.modify_workflow_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            workflow_config_id="test-workflow",
            release_config_name="test-release",
            cron_schedule="0 0 * * *",
            time_zone="UTC",
            tags=["daily"],
            service_account="service-1234567890@gcp-sa-dataform.iam.gserviceaccount.com",
        )
        is True
    )

    # Verify create NOT called
    mock_client.create_workflow_config.assert_not_called()
    # Verify update called
    mock_client.update_workflow_config.assert_called_once()

    # Verify update_mask excludes invocation_config
    call_args = mock_client.update_workflow_config.call_args
    request = call_args.kwargs["request"]
    assert "invocation_config" not in request.update_mask.paths


def test_modify_workflow_config_existing_differs_recreates(provider, mock_client, mocker):
    mock_client.repository_path.return_value = REPO_NAME
    workflow_path = f"{REPO_NAME}/workflowConfigs/test-workflow"
    mock_client.workflow_config_path.return_value = workflow_path

    # Mock existing config with DIFFERENT tags
    existing_config = dataform_v1beta1.WorkflowConfig(
        invocation_config=dataform_v1beta1.InvocationConfig(
            included_tags=["hourly"],  # Differs from "daily"
            service_account="service-1234567890@gcp-sa-dataform.iam.gserviceaccount.com",
        )
    )
    mock_client.get_workflow_config.return_value = existing_config

    assert (
        provider.modify_workflow_config(
            project=PROJECT,
            region=REGION,
            repo=REPO,
            workflow_config_id="test-workflow",
            release_config_name="test-release",
            cron_schedule="0 0 * * *",
            time_zone="UTC",
            tags=["daily"],
        )
        is True
    )

    # Verify delete called
    mock_client.delete_workflow_config.assert_called_once_with(name=workflow_path)
    # Verify create called after delete
    mock_client.create_workflow_config.assert_called_once()
    # Verify update NOT called
    mock_client.update_workflow_config.assert_not_called()


def test_delete_repository_success(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    assert provider.delete_repository(project=PROJECT, region=REGION, repo=REPO, force=True) is True
    expected_request = dataform_v1beta1.DeleteRepositoryRequest(
        name=REPO_NAME,
        force=True,
    )
    mock_client.delete_repository.assert_called_once_with(request=expected_request)


def test_delete_repository_not_found_ignored(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.delete_repository.side_effect = exceptions.NotFound("Not found")
    assert provider.delete_repository(project=PROJECT, region=REGION, repo=REPO) is True
    mock_client.delete_repository.assert_called_once()


def test_delete_repository_error_returns_false(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.delete_repository.side_effect = Exception("Failed")
    assert provider.delete_repository(project=PROJECT, region=REGION, repo=REPO) is False


def test_delete_workspace_success(provider, mock_client):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    assert (
        provider.delete_workspace(project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE)
        is True
    )
    mock_client.delete_workspace.assert_called_once_with(name=WORKSPACE_NAME)


def test_delete_workspace_not_found_ignored(provider, mock_client):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    mock_client.delete_workspace.side_effect = exceptions.NotFound("Not found")
    assert (
        provider.delete_workspace(project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE)
        is True
    )


def test_delete_workspace_error_returns_false(provider, mock_client):
    mock_client.workspace_path.return_value = WORKSPACE_NAME
    mock_client.delete_workspace.side_effect = Exception("Failed")
    assert (
        provider.delete_workspace(project=PROJECT, region=REGION, repo=REPO, workspace=WORKSPACE)
        is False
    )


def test_query_workflow_invocation_actions_success(provider, mock_client):
    mock_response = MagicMock()
    action = dataform_v1beta1.WorkflowInvocationAction()
    mock_response.workflow_invocation_actions = [action]
    mock_response.next_page_token = ""
    mock_client.query_workflow_invocation_actions.return_value = mock_response

    actions = provider.query_workflow_invocation_actions(name="invocation_name")
    assert actions == [action]
    mock_client.query_workflow_invocation_actions.assert_called_once()


def test_create_workflow_invocation_success(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.workflow_config_path.return_value = (
        "projects/p1/locations/r1/repositories/repo1/workflowConfigs/config1"
    )
    mock_invocation = MagicMock()
    mock_invocation.name = "invocation_name"
    mock_client.create_workflow_invocation.return_value = mock_invocation

    result = provider.create_workflow_invocation(
        project=PROJECT,
        region=REGION,
        repo=REPO,
        workflow_config_id="config_id",
    )
    assert result is not None
    assert result.name == "invocation_name"
    mock_client.create_workflow_invocation.assert_called_once()


def test_create_workflow_invocation_with_sa(provider, mock_client):
    mock_client.repository_path.return_value = REPO_NAME
    mock_client.workflow_config_path.return_value = (
        "projects/p1/locations/r1/repositories/repo1/workflowConfigs/config1"
    )
    mock_invocation = MagicMock()
    mock_invocation.name = "invocation_name"
    mock_client.create_workflow_invocation.return_value = mock_invocation

    result = provider.create_workflow_invocation(
        project=PROJECT,
        region=REGION,
        repo=REPO,
        workflow_config_id="config_id",
        service_account="test-sa@example.com",
    )
    assert result is not None

    mock_client.create_workflow_invocation.assert_called_once()
    args, kwargs = mock_client.create_workflow_invocation.call_args
    request = kwargs.get("request") or args[0]
    assert request.workflow_invocation.invocation_config.service_account == "test-sa@example.com"
