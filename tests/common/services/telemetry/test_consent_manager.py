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

import logging
from unittest.mock import patch

import pytest

from common.services.telemetry.consent_manager import TelemetryConsentManager


@pytest.fixture(autouse=True)
def mock_consent_path(tmp_path):
    with patch(
        "common.services.telemetry.consent_manager.TelemetryConsentManager.get_consent_file_path",
        return_value=tmp_path / ".cortex" / "cortex-framework-consent.properties",
    ):
        # Reset runtime disabled flag between tests
        TelemetryConsentManager.set_runtime_disabled(False)
        yield tmp_path


def test_setup_prints_message(caplog):
    with caplog.at_level(logging.INFO):
        TelemetryConsentManager.setup(False)

    assert any(
        "Cortex Framework collects telemetry events" in record.message for record in caplog.records
    )
    assert any("cortex-config telemetry disable" in record.message for record in caplog.records)


def test_update_consent_file_disables(tmp_path):
    TelemetryConsentManager.update_consent_file(enable=False)

    consent_file = tmp_path / ".cortex" / "cortex-framework-consent.properties"
    assert consent_file.exists()

    content = consent_file.read_text(encoding="utf-8")
    assert "enable_telemetry=false" in content


def test_update_consent_file_enables(tmp_path):
    TelemetryConsentManager.update_consent_file(enable=True)

    consent_file = tmp_path / ".cortex" / "cortex-framework-consent.properties"
    assert consent_file.exists()

    content = consent_file.read_text(encoding="utf-8")
    assert "enable_telemetry=true" in content


def test_update_consent_file_handles_exception_gracefully(caplog):
    with patch("builtins.open", side_effect=PermissionError("Permission denied")):
        with caplog.at_level(logging.WARNING):
            TelemetryConsentManager.update_consent_file(enable=False)

        assert any(
            "Failed to write telemetry consent file" in record.message for record in caplog.records
        )


def test_setup_logs_when_disabled(tmp_path, caplog):
    with caplog.at_level(logging.INFO):
        TelemetryConsentManager.setup(True)

    assert any("Telemetry collection is disabled." in record.message for record in caplog.records)


def test_is_telemetry_disabled(tmp_path):
    # Setup mock file
    cortex_dir = tmp_path / ".cortex"
    cortex_dir.mkdir(parents=True, exist_ok=True)
    consent_file = cortex_dir / "cortex-framework-consent.properties"

    # 1. File doesn't exist
    assert TelemetryConsentManager.is_telemetry_disabled() is False

    # 2. File exists with new opt-out property "enable_telemetry"
    consent_file.write_text("enable_telemetry=false\n")
    assert TelemetryConsentManager.is_telemetry_disabled() is True

    # 3. File exists with new opt-in property "enable_telemetry"
    consent_file.write_text("enable_telemetry=true\n")
    assert TelemetryConsentManager.is_telemetry_disabled() is False

    # 4. Runtime override disables telemetry, overriding the file
    consent_file.write_text("enable_telemetry=true\n")
    TelemetryConsentManager.set_runtime_disabled(True)
    assert TelemetryConsentManager.is_telemetry_disabled() is True

    # 5. Runtime override allows it, fallback to file (which is True -> not disabled)
    TelemetryConsentManager.set_runtime_disabled(False)
    assert TelemetryConsentManager.is_telemetry_disabled() is False
