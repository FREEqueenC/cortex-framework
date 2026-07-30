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

import argparse
import logging

from common.services.telemetry.consent_manager import TelemetryConsentManager
from common.utils.logging import setup_logging

logger = logging.getLogger(__name__)


def main(args=None):
    setup_logging()
    parser = argparse.ArgumentParser(description="Cortex Framework Configuration Tool")
    subparsers = parser.add_subparsers(dest="command", required=True)

    telemetry_parser = subparsers.add_parser("telemetry", help="Manage telemetry settings")
    telemetry_parser.add_argument(
        "action", choices=["enable", "disable", "status"], help="Action to perform on telemetry"
    )

    parsed_args = parser.parse_args(args)

    if parsed_args.command == "telemetry":
        if parsed_args.action == "enable":
            TelemetryConsentManager.update_consent_file(enable=True)
            logger.info("Telemetry has been enabled globally.")
        elif parsed_args.action == "disable":
            TelemetryConsentManager.update_consent_file(enable=False)
            logger.info("Telemetry has been disabled globally.")
        elif parsed_args.action == "status":
            disabled = TelemetryConsentManager.is_telemetry_disabled()
            status_text = "DISABLED" if disabled else "ENABLED"
            logger.info(f"Telemetry is currently {status_text}.")


if __name__ == "__main__":
    main()
