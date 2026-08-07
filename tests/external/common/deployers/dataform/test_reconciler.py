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

"""Unit tests for DataformWorkspaceReconciler."""

from unittest.mock import MagicMock

import pytest

from common.deployers.dataform.services.reconciler import DataformWorkspaceReconciler

# Constants
PROJECT = "test-project"
REGION = "us-central1"
REPO = "test-repo"
WORKSPACE = "test-workspace"


@pytest.fixture
def client():
    """Fixture to provide a mocked DataformClient."""
    mock = MagicMock()
    return mock


@pytest.fixture
def reconciler(client):
    """Fixture to provide a DataformWorkspaceReconciler instance."""
    return DataformWorkspaceReconciler(client=client)


def test_calculate_differences(reconciler):
    local_files = {"a.sql", "b.sql"}
    local_dirs = {"dir1", "dir2"}
    remote_files = {"a.sql", "c.sql"}
    remote_dirs = {"dir1", "dir3"}

    dirs_to_delete, files_to_delete = reconciler.calculate_differences(
        local_files, local_dirs, remote_files, remote_dirs
    )
    assert dirs_to_delete == ["dir3"]
    assert files_to_delete == {"c.sql"}


def test_discover_local_files(reconciler, tmp_path):
    (tmp_path / "a.sql").write_text("content")
    (tmp_path / "subdir").mkdir()
    (tmp_path / "subdir" / "b.sql").write_text("content2")
    (tmp_path / ".df-credentials.json").write_text("secret")

    files = reconciler.discover_local_files(tmp_path)
    assert files == {"a.sql", "subdir/b.sql"}


def test_get_remote_files(reconciler, client):
    from google.cloud import dataform_v1beta1

    entry1 = dataform_v1beta1.DirectoryEntry(file="file1.sql")
    entry2 = dataform_v1beta1.DirectoryEntry(directory="subdir")
    entry3 = dataform_v1beta1.DirectoryEntry(file="subdir/file2.sql")

    client.query_directory_contents = MagicMock(side_effect=[[entry1, entry2], [entry3]])

    files, dirs = reconciler.get_remote_files(PROJECT, REGION, REPO, WORKSPACE)
    assert files == {"file1.sql", "subdir/file2.sql"}
    assert dirs == {"subdir"}


def test_verify_local_file_unchanged(reconciler, client, tmp_path):
    local_file = tmp_path / "a.sql"
    local_file.write_text("content")

    client.read_file = MagicMock(return_value=b"content")
    remote_files = {"a.sql"}

    res = reconciler.verify_local_file(
        PROJECT, REGION, REPO, WORKSPACE, tmp_path, remote_files, "a.sql"
    )
    assert res == ("a.sql", False, None)


def test_verify_local_file_needs_update(reconciler, client, tmp_path):
    local_file = tmp_path / "a.sql"
    local_file.write_text("content")

    client.read_file = MagicMock(return_value=b"old content")
    remote_files = {"a.sql"}

    res = reconciler.verify_local_file(
        PROJECT, REGION, REPO, WORKSPACE, tmp_path, remote_files, "a.sql"
    )
    assert res[0] == "a.sql"
    assert res[1] is True
    assert res[2] is not None


def test_verify_local_file_new(reconciler, tmp_path):
    local_file = tmp_path / "a.sql"
    local_file.write_text("content")
    remote_files: set[str] = set()

    res = reconciler.verify_local_file(
        PROJECT, REGION, REPO, WORKSPACE, tmp_path, remote_files, "a.sql"
    )
    assert res[0] == "a.sql"
    assert res[1] is True
    assert res[2] is not None


def test_verify_local_file_remote_read_exception_returns_none(reconciler, client, tmp_path):
    local_file = tmp_path / "a.sql"
    local_file.write_text("content")
    remote_files = {"a.sql"}

    client.read_file = MagicMock(side_effect=Exception("Unexpected API error"))

    res = reconciler.verify_local_file(
        PROJECT, REGION, REPO, WORKSPACE, tmp_path, remote_files, "a.sql"
    )
    assert res is None
