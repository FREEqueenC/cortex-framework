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

"""Module for managing telemetry consent."""

import logging
from pathlib import Path

from common.services.telemetry import constants

logger = logging.getLogger(__name__)


class TelemetryConsentManager:
    """Manages the user's telemetry consent stored in ~/.cortex."""

    _runtime_disabled: bool = False

    @classmethod
    def get_consent_file_path(cls) -> Path:
        """Returns the path to the consent properties file."""
        return Path.home() / ".cortex" / constants.telemetry_consent_filename

    @classmethod
    def set_runtime_disabled(cls, disabled: bool) -> None:
        """Sets the telemetry disabled flag for the current execution run."""
        cls._runtime_disabled = disabled

    @classmethod
    def update_consent_file(cls, enable: bool) -> None:
        """Updates the properties file to permanently enable or disable telemetry."""
        filepath = cls.get_consent_file_path()
        try:
            filepath.parent.mkdir(parents=True, exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                val = "true" if enable else "false"
                f.write(f"{constants.telemetry_consent_property_name}={val}\n")
        except Exception as e:
            logger.warning("Failed to write telemetry consent file: %s", e)

    @classmethod
    def setup(cls, runtime_disabled: bool) -> None:
        """Sets runtime overrides and logs the telemetry collection status and notices."""
        cls.set_runtime_disabled(runtime_disabled)

        if not cls.is_telemetry_disabled():
            logger.info(
                "Cortex Framework collects telemetry events to help "
                "Google Cloud improve the solution.\n"
                "You can check Google Cloud Platform Terms of Service:\n"
                "https://cloud.google.com/terms and Google Cloud Privacy Notice:\n"
                "https://cloud.google.com/terms/cloud-privacy-notice.\n"
                "To opt out globally, run `uv run cortex-config telemetry disable`."
            )
        else:
            logger.info("Telemetry collection is disabled.")

    @classmethod
    def is_telemetry_disabled(cls) -> bool:
        """Checks if telemetry should be disabled based on runtime flag or the consent file."""
        if cls._runtime_disabled:
            return True

        filepath = cls.get_consent_file_path()
        if not filepath.exists():
            return False

        try:
            with open(filepath, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("!"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                    elif ":" in line:
                        key, value = line.split(":", 1)
                    else:
                        continue
                    if key.strip() == constants.telemetry_consent_property_name:
                        return value.strip().lower() == "false"
        except Exception as e:
            logger.warning("Failed to read telemetry consent file: %s", e)

        return False
