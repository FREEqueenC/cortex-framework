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

from __future__ import annotations

import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor

import google.auth
import requests
from google.auth.transport.requests import AuthorizedSession

from common.clients import resource_manager
from common.services.telemetry import constants
from common.services.telemetry.consent_manager import TelemetryConsentManager

logger = logging.getLogger(__name__)

# Global executor for async telemetry logging
_executor = ThreadPoolExecutor(max_workers=constants.max_thread_pool_workers)
_telemetry_futures: list[Future[None]] = []
_telemetry_lock = threading.Lock()


class EventLogger:
    """Logger for telemetry events across the framework."""

    _resource_manager_client: resource_manager.ResourceManagerClient | None = None
    _project_number_cache: dict[str, str] = {}
    _init_lock = threading.Lock()
    _auth_session: AuthorizedSession | None = None
    _auth_lock = threading.Lock()

    @classmethod
    def _get_auth_session(cls) -> AuthorizedSession:
        if cls._auth_session is None:
            with cls._auth_lock:
                if cls._auth_session is None:
                    credentials, _ = google.auth.default(
                        scopes=["https://www.googleapis.com/auth/cloud-platform"]
                    )

                    # Create a dedicated session for token refresh with a scaled connection pool
                    refresh_session = requests.Session()
                    retry_adapter = requests.adapters.HTTPAdapter(
                        max_retries=3,
                        pool_connections=constants.max_thread_pool_workers,
                        pool_maxsize=constants.max_thread_pool_workers,
                    )
                    refresh_session.mount("https://", retry_adapter)
                    refresh_session.mount("http://", retry_adapter)

                    # Pass the custom auth_request using the public API
                    auth_request = google.auth.transport.requests.Request(session=refresh_session)
                    cls._auth_session = AuthorizedSession(credentials, auth_request=auth_request)

                    adapter = requests.adapters.HTTPAdapter(
                        pool_connections=constants.max_thread_pool_workers,
                        pool_maxsize=constants.max_thread_pool_workers,
                    )
                    cls._auth_session.mount("https://", adapter)
                    cls._auth_session.mount("http://", adapter)
        return cls._auth_session

    @staticmethod
    def for_bq_datasets(
        *,
        project_id: str | None,
        location: str,
        target_bq_dataset: str,
        component: str,
        type: str,
        variant: str | None,
        use_dataform_telemetry: bool = False,
    ) -> EventLogger:

        if not project_id or not location or not target_bq_dataset:
            logger.warning(
                "Skipping logging for missing required args: "
                "project_id=%s, location=%s, target_bq_dataset=%s",
                project_id,
                location,
                target_bq_dataset,
            )
            return NoOpEventLogger()

        try:
            url = constants.bq_telemetry_endpoint % (project_id, target_bq_dataset)
            instance = EventLogger()
            instance._init(
                project_id=project_id,
                location=location,
                component=component,
                component_type=type,
                variant=variant,
                url=url,
                disabled=TelemetryConsentManager.is_telemetry_disabled(),
            )

            return instance
        except Exception as e:
            logger.warning(
                "Skipping logging for project_id=%s, location=%s, target_bq_dataset=%s: %s",
                project_id,
                location,
                target_bq_dataset,
                e,
            )
        return NoOpEventLogger()

    @staticmethod
    def for_dataform_repository(
        *,
        project_id: str | None,
        location: str,
        repository_id: str,
        component: str,
        type: str,
        variant: str | None,
        use_dataform_telemetry: bool = False,
    ) -> EventLogger:

        if not project_id or not location or not repository_id:
            logger.warning(
                "Skipping logging for missing required args: "
                "project_id=%s, location=%s, repository_id=%s",
                project_id,
                location,
                repository_id,
            )
            return NoOpEventLogger()

        try:
            url = constants.dataform_telemetry_endpoint % (project_id, location, repository_id)
            instance = EventLogger()
            instance._init(
                project_id=project_id,
                location=location,
                component=component,
                component_type=type,
                variant=variant,
                url=url,
                disabled=TelemetryConsentManager.is_telemetry_disabled(),
            )

            return instance
        except Exception as e:
            logger.warning(
                "Skipping logging for project_id=%s, location=%s, repository_id=%s: %s",
                project_id,
                location,
                repository_id,
                e,
            )
        return NoOpEventLogger()

    def log_registered_status(self, optional_extension: str | None = None) -> None:
        self._log_status(optional_extension, constants.TelemetryStatus.REGISTERED)

    def log_updated_status(self, optional_extension: str | None = None) -> None:
        self._log_status(optional_extension, constants.TelemetryStatus.UPDATED)

    def log_batch_deployed_status(self, optional_extensions: list[str] | None = None) -> None:
        self._log_status_async(optional_extensions, constants.TelemetryStatus.DEPLOYED)

    def log_batch_post_deploy_success_status(
        self, optional_extensions: list[str] | None = None
    ) -> None:
        self._log_status_async(optional_extensions, constants.TelemetryStatus.POST_DEPLOY_SUCCESS)

    def _init(
        self,
        *,
        project_id: str | None,
        location: str,
        component: str,
        component_type: str,
        variant: str | None,
        url: str,
        disabled: bool,
    ) -> None:

        if not project_id:
            raise ValueError("project_id must be provided")

        if not location:
            raise ValueError("location must be provided")

        if not component:
            raise ValueError("component must be provided")

        if not component_type:
            raise ValueError("component_type must be provided")

        if not url:
            raise ValueError("url must be provided")

        self._project_id = project_id
        self._location = location
        self._component = component
        self._component_type = component_type
        self._variant = variant

        with EventLogger._init_lock:
            if EventLogger._resource_manager_client is None:
                EventLogger._resource_manager_client = resource_manager.ResourceManagerClient()
            if project_id not in EventLogger._project_number_cache:
                EventLogger._project_number_cache[project_id] = (
                    EventLogger._resource_manager_client.get_project_number(project_id=project_id)
                )

        self._project_number = EventLogger._project_number_cache[project_id]
        self._user_agent_prefix = self._build_user_agent_prefix()
        self._url = url
        self._disabled = disabled or (
            str(self._project_number) in constants.projects_exclusions_list
        )

    def _build_user_agent_prefix(self) -> str:
        """Builds the user agent prefix without the status token.
        to be ready for status logging in other methods.

        It uses this template
        gcp-cortex-eng/framework/$VERSION/$COMPONENT/$TYPE/$VARIANT/$OPTIONAL_EXT/$STATUS
        """

        prefix_no_status = (
            f"{constants.user_agent_prefix}/{constants.solution_name}/"
            f"{constants.solution_version}/{self._component}/{self._component_type}"
        )

        if self._variant:
            prefix_no_status += f"/{self._variant}"

        return prefix_no_status

    def _log_status(
        self, optional_extension: str | None, status: constants.TelemetryStatus
    ) -> None:
        """Logs the status to the telemetry events system.

        Args:
          optional_extension: Any optional extension to append to the user agent.
          status: The status of the framework.
        """

        if self._disabled:
            logger.debug("Skipping logging for test project %s", self._project_number)
            return

        if not optional_extension:
            user_agent_value = f"{self._user_agent_prefix}/{status}"
        else:
            user_agent_value = f"{self._user_agent_prefix}/{optional_extension}/{status}"

        self._request_resource_with_user_agent(self._url, user_agent_value)

    def _log_status_async(
        self, optional_extensions: list[str] | None, status: constants.TelemetryStatus
    ) -> None:
        """Logs the status to the telemetry events system asynchronously.

        Args:
          optional_extensions: Any optional extensions to append to the user agent.
          status: The status of the framework.
        """
        if self._disabled:
            logger.debug("Skipping logging for test project %s", self._project_number)
            return

        extensions = optional_extensions if optional_extensions else [None]

        for ext in extensions:
            if not ext:
                user_agent_value = f"{self._user_agent_prefix}/{status}"
            else:
                user_agent_value = f"{self._user_agent_prefix}/{ext}/{status}"

            future = _executor.submit(
                self._request_resource_with_user_agent,
                url=self._url,
                user_agent_header_value=user_agent_value,
            )

            with _telemetry_lock:
                global _telemetry_futures
                _telemetry_futures.append(future)
                # Clean up completed futures to avoid memory leak
                _telemetry_futures = [f for f in _telemetry_futures if not f.done()]

    def _request_resource_with_user_agent(self, url: str, user_agent_header_value: str) -> None:
        """Requests the cloud resource with the user agent.

        Args:
          url: The URL to request.
          user_agent_header_value: The user agent value to set.
        """
        logger.debug(
            "Sending telemetry events request with user agent: %s", user_agent_header_value
        )
        headers = {
            "X-Goog-User-Project": str(self._project_number),
            "User-Agent": user_agent_header_value,
        }
        try:
            authed_session = EventLogger._get_auth_session()
            response = authed_session.get(url, headers=headers, timeout=(3.0, 5.0))
            response.raise_for_status()
        except Exception as e:
            logger.warning("Telemetry event request failed: %s", e)

    @classmethod
    def wait_for_telemetry(cls):
        """Waits for background telemetry requests to finish.

        Logs a message if waiting is required.
        """
        with _telemetry_lock:
            global _telemetry_futures
            active_futures = [f for f in _telemetry_futures if not f.done()]

        if active_futures:
            logger.info("Finalizing background processes...")
            import concurrent.futures

            concurrent.futures.wait(active_futures)
            logger.info("Background processes completed.")


class NoOpEventLogger(EventLogger):
    """A dummy metric logger that performs no operations."""

    def __init__(self) -> None:
        pass

    def _init(self, *args, **kwargs) -> None:
        pass

    def _log_status(self, *args, **kwargs) -> None:
        pass

    def _log_status_async(self, *args, **kwargs) -> None:
        pass
