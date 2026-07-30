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

import time
from unittest.mock import MagicMock, patch

import pytest

from common.services.telemetry.constants import TelemetryStatus
from common.services.telemetry.telemetry_logger import EventLogger, NoOpEventLogger


@pytest.fixture(autouse=True)
def reset_event_logger_cache():
    EventLogger._resource_manager_client = None
    EventLogger._project_number_cache = {}
    EventLogger._auth_session = None
    yield


@pytest.fixture(autouse=True)
def mock_executor():
    def submit_mock(fn, *args, **kwargs):
        fn(*args, **kwargs)
        mock_future = MagicMock()
        mock_future.done.return_value = True
        return mock_future

    with patch(
        "common.services.telemetry.telemetry_logger._executor.submit", side_effect=submit_mock
    ):
        yield


def test_logger_initialization():
    with patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert logger_obj._project_id == "test-project"
        assert logger_obj._project_number == "123456789"
        assert (
            logger_obj._user_agent_prefix
            == "gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant"
        )


def test_request_bq_dataset_with_user_agent():
    with (
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
        patch("google.auth.default") as mock_auth_default,
        patch("common.services.telemetry.telemetry_logger.AuthorizedSession") as mock_session_cls,
        patch(
            "common.services.telemetry.telemetry_logger.TelemetryConsentManager.is_telemetry_disabled",
            return_value=False,
        ),
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        mock_auth_default.return_value = (MagicMock(), "test-project")

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant=None,
        )

        logger_obj._request_resource_with_user_agent(
            url="http://fake-url", user_agent_header_value="fake-user-agent"
        )

        mock_session.get.assert_called_once_with(
            "http://fake-url",
            headers={"X-Goog-User-Project": "123456789", "User-Agent": "fake-user-agent"},
            timeout=(3.0, 5.0),
        )
        mock_session.get.return_value.raise_for_status.assert_called_once()


def test_logger_caching_behavior():
    with patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        # Create two loggers for the same project
        logger1 = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset1",
            component="PLATFORM",
            type="BUILDER",
            variant=None,
        )

        logger2 = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset2",
            component="PLATFORM",
            type="BUILDER",
            variant=None,
        )

        # ResourceManagerClient should only be instantiated once
        mock_client_cls.assert_called_once()
        # get_project_number should only be called once for the same project_id
        mock_client.get_project_number.assert_called_once_with(project_id="test-project")

        assert logger1._project_number == "123456789"
        assert logger2._project_number == "123456789"


def test_logger_bq_datasets_missing_args_returns_none():
    logger_obj = EventLogger.for_bq_datasets(
        project_id=None,
        location="us-central1",
        target_bq_dataset="test_dataset",
        component="PLATFORM",
        type="BUILDER",
        variant=None,
    )
    assert isinstance(logger_obj, NoOpEventLogger)


def test_logger_bq_datasets_exception_returns_none():
    with patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.get_project_number.side_effect = Exception("Auth error")
        mock_client_cls.return_value = mock_client

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant=None,
        )
        assert isinstance(logger_obj, NoOpEventLogger)


def test_logger_dataform_repository_missing_args_returns_none():
    logger_obj = EventLogger.for_dataform_repository(
        project_id="test-project",
        location=None,
        repository_id="test-repo",
        component="PLATFORM",
        type="DEPLOYER",
        variant=None,
    )
    assert isinstance(logger_obj, NoOpEventLogger)


def test_logger_dataform_repository_exception_returns_none():
    with patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.get_project_number.side_effect = Exception("Network error")
        mock_client_cls.return_value = mock_client

        logger_obj = EventLogger.for_dataform_repository(
            project_id="test-project",
            location="us-central1",
            repository_id="test-repo",
            component="PLATFORM",
            type="DEPLOYER",
            variant=None,
        )
        assert isinstance(logger_obj, NoOpEventLogger)


def test_logger_disabled_when_consent_file_denied(tmp_path):
    # Mock tempfile.gettempdir() to return tmp_path
    with (
        patch("pathlib.Path.home", return_value=tmp_path),
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        # Write consent file with enable_telemetry=false
        (tmp_path / ".cortex").mkdir(parents=True, exist_ok=True)
        consent_file = tmp_path / ".cortex" / "cortex-framework-consent.properties"
        consent_file.write_text("enable_telemetry=false\n")

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)
        assert logger_obj._disabled is True


def test_logger_enabled_when_consent_file_approved(tmp_path):
    with (
        patch("pathlib.Path.home", return_value=tmp_path),
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        # Write consent file with enable_telemetry=true
        (tmp_path / ".cortex").mkdir(parents=True, exist_ok=True)
        consent_file = tmp_path / ".cortex" / "cortex-framework-consent.properties"
        consent_file.write_text("enable_telemetry=true\n")

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)
        assert logger_obj._disabled is False


def test_logger_enabled_when_consent_file_property_missing(tmp_path):
    with (
        patch("pathlib.Path.home", return_value=tmp_path),
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        # Write consent file with different property
        (tmp_path / ".cortex").mkdir(parents=True, exist_ok=True)
        consent_file = tmp_path / ".cortex" / "cortex-framework-consent.properties"
        consent_file.write_text("some_other_property=false\n")

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)
        assert logger_obj._disabled is False


def test_logger_enabled_when_consent_file_does_not_exist(tmp_path):
    with (
        patch("pathlib.Path.home", return_value=tmp_path),
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        # Do not write any file

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)
        assert logger_obj._disabled is False


def test_log_status_with_optional_extension():
    with (
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
        patch("google.auth.default") as mock_auth_default,
        patch("common.services.telemetry.telemetry_logger.AuthorizedSession") as mock_session_cls,
        patch(
            "common.services.telemetry.telemetry_logger.TelemetryConsentManager.is_telemetry_disabled",
            return_value=False,
        ),
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        mock_auth_default.return_value = (MagicMock(), "test-project")

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)

        # Call status logging without optional_extension
        print(f"Disabled: {logger_obj._disabled}")
        logger_obj.log_updated_status()
        expected_ua_1 = "gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant/updated"
        mock_session.get.assert_called_with(
            "https://bigquery.googleapis.com/bigquery/v2/projects/test-project/datasets/test_dataset",
            headers={"X-Goog-User-Project": "123456789", "User-Agent": expected_ua_1},
            timeout=(3.0, 5.0),
        )

        # Call status logging with optional_extension
        logger_obj.log_updated_status(optional_extension="k9")
        expected_ua_2 = "gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant/k9/updated"
        mock_session.get.assert_called_with(
            "https://bigquery.googleapis.com/bigquery/v2/projects/test-project/datasets/test_dataset",
            headers={"X-Goog-User-Project": "123456789", "User-Agent": expected_ua_2},
            timeout=(3.0, 5.0),
        )


def test_log_status_async_with_no_extensions():

    with (
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
        patch("google.auth.default") as mock_auth_default,
        patch("common.services.telemetry.telemetry_logger.AuthorizedSession") as mock_session_cls,
        patch(
            "common.services.telemetry.telemetry_logger.TelemetryConsentManager.is_telemetry_disabled",
            return_value=False,
        ),
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        mock_auth_default.return_value = (MagicMock(), "test-project")

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)

        logger_obj._log_status_async(optional_extensions=None, status=TelemetryStatus.UPDATED)

        expected_ua = "gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant/updated"
        mock_session.get.assert_called_once_with(
            "https://bigquery.googleapis.com/bigquery/v2/projects/test-project/datasets/test_dataset",
            headers={"X-Goog-User-Project": "123456789", "User-Agent": expected_ua},
            timeout=(3.0, 5.0),
        )


def test_log_status_async_with_multiple_extensions():

    with (
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
        patch("google.auth.default") as mock_auth_default,
        patch("common.services.telemetry.telemetry_logger.AuthorizedSession") as mock_session_cls,
        patch(
            "common.services.telemetry.telemetry_logger.TelemetryConsentManager.is_telemetry_disabled",
            return_value=False,
        ),
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        mock_auth_default.return_value = (MagicMock(), "test-project")

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        # Add a sleep in session.get to ensure we can check concurrency or thread execution,
        # but mock_session.get is a mock. We can make its side_effect sleep a bit.
        def mock_get(url, headers, timeout):
            time.sleep(0.01)
            return MagicMock()

        mock_session.get.side_effect = mock_get

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)

        extensions = ["ext1", "ext2", "ext3"]
        logger_obj._log_status_async(optional_extensions=extensions, status=TelemetryStatus.UPDATED)

        # It should have called get 3 times.
        assert mock_session.get.call_count == 3

        for ext in extensions:
            expected_ua = (
                f"gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant/{ext}/updated"
            )
            mock_session.get.assert_any_call(
                "https://bigquery.googleapis.com/bigquery/v2/projects/test-project/datasets/test_dataset",
                headers={"X-Goog-User-Project": "123456789", "User-Agent": expected_ua},
                timeout=(3.0, 5.0),
            )


def test_log_batch_deployed_status():
    with (
        patch("common.clients.resource_manager.ResourceManagerClient") as mock_client_cls,
        patch("google.auth.default") as mock_auth_default,
        patch("common.services.telemetry.telemetry_logger.AuthorizedSession") as mock_session_cls,
        patch(
            "common.services.telemetry.telemetry_logger.TelemetryConsentManager.is_telemetry_disabled",
            return_value=False,
        ),
    ):
        mock_client = MagicMock()
        mock_client.get_project_number.return_value = "123456789"
        mock_client_cls.return_value = mock_client

        mock_auth_default.return_value = (MagicMock(), "test-project")

        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        logger_obj = EventLogger.for_bq_datasets(
            project_id="test-project",
            location="us-central1",
            target_bq_dataset="test_dataset",
            component="PLATFORM",
            type="BUILDER",
            variant="test_variant",
        )

        assert not isinstance(logger_obj, NoOpEventLogger)

        extensions = ["extA", "extB"]
        logger_obj.log_batch_deployed_status(optional_extensions=extensions)

        assert mock_session.get.call_count == 2

        for ext in extensions:
            expected_ua = (
                f"gcp-cortex-eng/framework/7.0.0/PLATFORM/BUILDER/test_variant/{ext}/deployed"
            )
            mock_session.get.assert_any_call(
                "https://bigquery.googleapis.com/bigquery/v2/projects/test-project/datasets/test_dataset",
                headers={"X-Goog-User-Project": "123456789", "User-Agent": expected_ua},
                timeout=(3.0, 5.0),
            )


def test_wait_for_telemetry_with_active_futures():
    with (
        patch("common.services.telemetry.telemetry_logger._telemetry_futures", new=[]),
        patch("common.services.telemetry.telemetry_logger.logger") as mock_logger,
        patch("concurrent.futures.wait") as mock_wait,
    ):
        mock_future = MagicMock()
        mock_future.done.return_value = False
        import common.services.telemetry.telemetry_logger as tl

        tl._telemetry_futures.append(mock_future)

        tl.EventLogger.wait_for_telemetry()

        mock_logger.info.assert_any_call("Finalizing background processes...")
        mock_logger.info.assert_any_call("Background processes completed.")
        mock_wait.assert_called_once_with([mock_future])


def test_wait_for_telemetry_no_active_futures():
    with (
        patch("common.services.telemetry.telemetry_logger._telemetry_futures", new=[]),
        patch("common.services.telemetry.telemetry_logger.logger") as mock_logger,
        patch("concurrent.futures.wait") as mock_wait,
    ):
        import common.services.telemetry.telemetry_logger as tl

        tl.EventLogger.wait_for_telemetry()

        mock_logger.info.assert_not_called()
        mock_wait.assert_not_called()
