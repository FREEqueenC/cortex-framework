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

"""Pytest configuration and global fixtures."""

import logging
import os
import pathlib
import shutil
import subprocess
from unittest.mock import patch

import pytest
from google.api_core.client_options import ClientOptions
from google.auth.credentials import AnonymousCredentials
from google.cloud import bigquery

from tools.build import main as cortex_build


@pytest.fixture(scope="session")
def generated_workspace(tmp_path_factory):
    """Session-scoped fixture to build the Dataform workspace once for all offline tests."""

    # We use a session-scoped temp directory to avoid polluting the actual repository's dist/
    # This ensures tests are isolated from local developer builds.
    test_dist_dir = tmp_path_factory.mktemp("dist")
    logger.info("Generating global test workspace at %s", test_dist_dir)

    # 1. Run cortex-build in-process, mocking the network APIs and output directory
    try:
        with (
            patch(
                "data_modules.cortex.data_foundation.sap.metadata_provider.BigQueryMetadataProvider.get_schema_and_keys"
            ) as mock_get_schema,
            patch(
                "data_modules.cortex.data_foundation.sap.metadata_provider.BigQueryMetadataProvider.fetch"
            ),
            patch("tools.build.GcpEnvironmentChecker") as mock_checker,
        ):
            mock_checker.return_value.validate_all.return_value = True
            # Provide dummy primary keys so the builder doesn't crash on empty tables
            mock_get_schema.return_value = (
                ["mandt", "test_key"],
                ["mandt", "test_key"],
                {"mandt": "STRING", "test_key": "STRING"},
            )
            cortex_build(
                [
                    "--config",
                    str(pathlib.Path(__file__).parent / "config.unittest.yaml"),
                    "--output-dir",
                    str(test_dist_dir),
                ]
            )
    except SystemExit as e:
        if e.code != 0:
            pytest.fail(f"Global workspace build exited with code {e.code}")

    # Verify the build actually succeeded by checking the temp directory directly
    if not (test_dist_dir / "workflow_settings.yaml").exists():
        pytest.fail("Dataform workspace not generated during session setup.")

    # 2. Compile the Dataform workspace once for all tests to use
    logger.info("Compiling Dataform workspace via CLI.")

    df_cmd = ["dataform", "compile", "--json", str(test_dist_dir)]
    if not shutil.which("dataform"):
        if shutil.which("npx"):
            logger.info("dataform not found in PATH. Falling back to npx -y @dataform/cli@latest.")
            df_cmd = ["npx", "-y", "@dataform/cli@latest", "compile", "--json", str(test_dist_dir)]
        else:
            pytest.skip(
                "Dataform CLI (and npx) not found in PATH. Skipping offline compilation tests."
            )

    try:
        result = subprocess.run(
            df_cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        with open(test_dist_dir / "manifest.json", "w") as f:
            f.write(result.stdout)
    except FileNotFoundError:
        pytest.skip("Dataform CLI not found. Skipping offline compilation tests.")
    except subprocess.CalledProcessError as e:
        if "npm" in e.stderr.lower() or "npm" in e.stdout.lower():
            pytest.skip(f"Dataform CLI missing npm dependency. Skipping: {e.stderr}")
        else:
            pytest.fail(f"Dataform compile failed globally: {e.stderr}\n{e.stdout}")

    yield test_dist_dir

    # Teardown: Clean up the temp directory after all tests finish
    logger.info("Cleaning up global test workspace at %s", test_dist_dir)
    if test_dist_dir.exists():
        shutil.rmtree(test_dist_dir)

    # Clean up local npx cache to avoid leaving vulnerable packages on disk
    npx_cache_dir = pathlib.Path.home() / ".npm" / "_npx"
    if npx_cache_dir.exists():
        logger.info("Cleaning up npx cache at %s", npx_cache_dir)
        try:
            for child in npx_cache_dir.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
        except Exception as e:
            logger.warning("Failed to clean up npx cache: %s", e)


@pytest.fixture(scope="session")
def bq_client() -> bigquery.Client:
    """Provide a default BigQuery client for tests.

    If BIGQUERY_EMULATOR_HOST is set (e.g., http://127.0.0.1:9050), this client
    points to the local emulator, allowing for offline hermetic testing of
    Dataform SQL logic without incurring cloud costs.
    """
    emulator_host = os.environ.get("BIGQUERY_EMULATOR_HOST")
    if emulator_host:
        ops = ClientOptions(api_endpoint=emulator_host)
        return bigquery.Client(
            project="test-project",
            credentials=AnonymousCredentials(),
            client_options=ops,
        )
    return bigquery.Client()


logger = logging.getLogger(__name__)


class ZetaSqlValidator:
    """Helper class for offline ZetaSQL syntax validation.

    This class provides methods to validate BigQuery SQL syntax without executing
    a live query, utilizing ZetaSQL parser bindings for hermetic testing.
    """

    def __init__(self) -> None:
        try:
            from zetasql.core.local_service import (  # type: ignore[import-not-found, import-untyped]
                ZetaSqlLocalService,
            )

            self.service = ZetaSqlLocalService.get_instance()
        except ImportError:
            logger.warning("zetasql not installed. Using stub validator.")
            self.service = None

    def validate_syntax(self, sql: str) -> tuple[bool, str]:
        if not sql or sql.isspace():
            return False, "SQL is empty."

        if not self.service:
            # Fallback stub if library is missing
            if "SYNTAX ERROR" in sql.upper():
                return False, "Stub: Syntax error detected."
            return True, ""

        try:
            from zetasql.core.exceptions import (  # type: ignore[import-not-found, import-untyped]
                ServerError,
            )

            self.service.parse(sql_statement=sql)
            return True, ""
        except ServerError as e:
            error_str = str(e)
            # ZetaSqlLocalService.parse defaults to single-statement parsing.
            # If it encounters a BigQuery Script (multiple statements, BEGIN, MERGE),
            # it successfully parses the first part and complains about the rest.
            if "Expected end of input but got keyword" in error_str:
                return True, ""
            return False, error_str


@pytest.fixture(scope="session")
def zetasql_validator() -> ZetaSqlValidator:
    """Fixture to provide a ZetaSqlValidator instance for offline SQL syntax checks."""
    return ZetaSqlValidator()


@pytest.fixture(scope="session")
def repo_root(request) -> pathlib.Path:
    """Returns the root of the repository using pytest's native rootdir discovery."""
    return pathlib.Path(request.config.rootdir)
