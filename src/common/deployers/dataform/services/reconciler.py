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

"""Reconciles local files with remote Dataform workspace."""

import base64
import concurrent.futures
import logging
import pathlib

from common.clients.dataform import DataformClient
from common.schemas import config_schema

logger = logging.getLogger(__name__)


class DataformWorkspaceReconciler:
    """Reconciles local files with remote Dataform workspace."""

    _IGNORE_PATHS = {
        "definitions/custom",
    }

    _DEFAULT_IGNORED_FILES = {
        ".df-credentials.json",
    }

    def __init__(self, client: DataformClient | None = None):
        self.client = client or DataformClient()

    def verify_local_file(
        self,
        project: str,
        region: str,
        repo: str,
        workspace: str,
        output_dir: pathlib.Path,
        remote_files: set[str],
        rel_path: str,
    ) -> tuple[str, bool, str | None] | None:
        """Verifies a local file against its remote counterpart."""
        local_path = output_dir / rel_path
        try:
            with open(local_path, "rb") as f:
                file_content_bytes = f.read()
                b64_content = base64.b64encode(file_content_bytes).decode("utf-8")
        except OSError as e:
            logger.error("Failed to read %s: %s", local_path, e)
            return None

        try:
            if rel_path in remote_files:
                remote_content = self.client.read_file(
                    project=project,
                    region=region,
                    repo=repo,
                    workspace=workspace,
                    rel_path=rel_path,
                )
                if remote_content is not None:
                    if file_content_bytes == remote_content:
                        logger.info("  -> File unchanged: %s (skipping)", rel_path)
                        return (rel_path, False, None)
                else:
                    logger.warning(
                        "  -> Could not verify remote content for %s. Proceeding to overwrite.",
                        rel_path,
                    )
                return (rel_path, True, b64_content)
            else:
                logger.info("  -> File new: %s (queuing for upload)", rel_path)
                return (rel_path, True, b64_content)
        except Exception as e:
            logger.error("Failed to verify remote file '%s': %s", rel_path, e)
            return None

    def get_remote_files(
        self, project: str, region: str, repo: str, workspace: str
    ) -> tuple[set[str], set[str]]:
        """Gets remote files and directories from the workspace recursively."""
        remote_files = set()
        remote_dirs = set()

        logger.info("Querying directory contents for %s/%s/%s/%s", project, region, repo, workspace)

        def fetch_dir_contents(current_path: str):
            try:
                entries = self.client.query_directory_contents(
                    project=project,
                    region=region,
                    repo=repo,
                    workspace=workspace,
                    current_path=current_path,
                )
                for entry in entries:
                    if entry.file:
                        remote_files.add(entry.file)
                    elif entry.directory:
                        dir_path = entry.directory
                        if dir_path not in remote_dirs:
                            if any(dir_path.startswith(p) for p in self._IGNORE_PATHS):
                                logger.info("Skipping ignored directory: %s", dir_path)
                                continue
                            remote_dirs.add(dir_path)
                            fetch_dir_contents(dir_path)
            except Exception as e:
                logger.error("Failed to query directory contents for '%s': %s", current_path, e)
                raise

        fetch_dir_contents("")
        return remote_files, remote_dirs

    def calculate_differences(
        self,
        local_files: set[str],
        local_dirs: set[str],
        remote_files: set[str],
        remote_dirs: set[str],
    ) -> tuple[list[str], set[str]]:
        """Calculates which remote directories and files should be deleted."""

        def should_ignore(path):
            return any(path.startswith(p + "/") or path == p for p in self._IGNORE_PATHS)

        potential_dirs_to_delete = remote_dirs - local_dirs
        dirs_to_delete = sorted(
            [d for d in potential_dirs_to_delete if not should_ignore(d)],
            key=lambda p: len(pathlib.Path(p).parts),
            reverse=True,
        )

        potential_files_to_delete = remote_files - local_files
        files_to_delete = {f for f in potential_files_to_delete if not should_ignore(f)}

        return dirs_to_delete, files_to_delete

    def discover_local_files(
        self,
        output_dir: pathlib.Path,
        ignored_files: set[str] | None = None,
    ) -> set[str]:
        """Discovers all files in the output directory, respecting ignored files."""
        if ignored_files is None:
            ignored_files = self._DEFAULT_IGNORED_FILES
        local_files = set()
        for filepath in output_dir.rglob("*"):
            if (
                filepath.is_file()
                and ".git" not in filepath.parts
                and filepath.name not in ignored_files
            ):
                rel_path = filepath.relative_to(output_dir).as_posix()
                local_files.add(rel_path)
        return local_files

    def reconcile_workspace(
        self, output_dir: pathlib.Path, settings: config_schema.DataformTargetSettings
    ) -> bool:
        """Reconciles local files to the remote Dataform workspace."""
        project = settings.repository_project_id
        region = settings.repository_region
        repo = settings.repository_name
        workspace = settings.workspace_name

        local_files = self.discover_local_files(output_dir)
        local_dirs = set()

        remote_files, remote_dirs = self.get_remote_files(
            project=project, region=region, repo=repo, workspace=workspace
        )

        for local_file in local_files:
            path_parts = pathlib.Path(local_file).parts[:-1]
            for i in range(1, len(path_parts) + 1):
                local_dirs.add("/".join(path_parts[:i]))

        dirs_to_delete, files_to_delete = self.calculate_differences(
            local_files, local_dirs, remote_files, remote_dirs
        )

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(
                executor.map(
                    lambda p: self.verify_local_file(
                        project=project,
                        region=region,
                        repo=repo,
                        workspace=workspace,
                        output_dir=output_dir,
                        remote_files=remote_files,
                        rel_path=p,
                    ),
                    local_files,
                )
            )
            if any(res is None for res in results):
                return False
            files_to_update = [
                (res[0], res[2])
                for res in results
                if res is not None and res[1] and res[2] is not None
            ]

        for file_to_delete in files_to_delete:
            if not self.client.delete_file(
                project=project,
                region=region,
                repo=repo,
                workspace=workspace,
                filepath=file_to_delete,
            ):
                return False

        for dirpath in dirs_to_delete:
            if not self.client.delete_directory(
                project=project, region=region, repo=repo, workspace=workspace, dirpath=dirpath
            ):
                return False

        for rel_path, b64_content in files_to_update:
            if not self.client.write_file(
                project=project,
                region=region,
                repo=repo,
                workspace=workspace,
                rel_path=rel_path,
                b64_content=b64_content,
            ):
                return False

        return True
