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

"""Combines build and deploy in one step using the orchestrator classes."""

import argparse
import logging
import pathlib
import sys

from common.errors import (
    CortexBuildError,
    CortexConfigError,
    CortexDeployError,
    CortexError,
)
from common.services.config_loader import ConfigLoader
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.services.telemetry.consent_manager import TelemetryConsentManager
from common.services.telemetry.telemetry_logger import EventLogger
from common.utils.logging import setup_logging
from tools.build import DataformBuilder
from tools.deploy import DeploymentOrchestrator

logger = logging.getLogger(__name__)


def main(args=None):
    setup_logging()
    parser = argparse.ArgumentParser(description="Build and Deploy Cortex Data Foundation")
    parser.add_argument(
        "--config",
        type=pathlib.Path,
        default=pathlib.Path.cwd() / "config" / "config.yaml",
        help="Path to global config.yaml",
    )
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=pathlib.Path.cwd() / "dist",
        help="Path to the build output directory",
    )
    parser.add_argument(
        "--enable-apis",
        action="store_true",
        help="Enable missing APIs without prompting",
    )
    parser.add_argument(
        "--disable-telemetry",
        action="store_true",
        default=False,
        help="Disable telemetry event logging",
    )
    parser.add_argument(
        "--create-datasets",
        action="store_true",
        help="Create missing datasets without prompting",
    )
    parser.add_argument(
        "--assertions",
        type=pathlib.Path,
        help="Path to a Dataform assertions file (assertions.sqlx)",
    )
    args = parser.parse_args(args)

    try:
        config_file = args.config
        TelemetryConsentManager.setup(args.disable_telemetry)

        if not config_file.exists():
            raise CortexConfigError(
                f"Config file not found at {config_file}",
                hint="Please check that the file path is correct and that the file exists.",
            )

        global_config, validation_errors = ConfigLoader.load_and_validate(config_file)
        if not global_config:
            errors_str = "\n".join(f"  - {err}" for err in validation_errors)
            raise CortexConfigError(
                f"Configuration validation failed with the following errors:\n{errors_str}",
                hint="Correct the issues in config.yaml according to the validation rules.",
            )

        checker = GcpEnvironmentChecker(
            global_config,
            enable_apis=args.enable_apis,
            create_datasets=args.create_datasets,
        )
        checker.validate_all()

        output_dir = args.output_dir
        if not output_dir.is_absolute():
            output_dir = pathlib.Path.cwd() / output_dir

        # Build Dataform
        logger.info("Running Dataform build...")
        builder = DataformBuilder(
            global_config=global_config,
            output_dir=output_dir,
            config_dir=config_file.parent,
            assertions_path=args.assertions,
        )
        if not builder.build():
            raise CortexBuildError(
                "Dataform build failed.",
                hint=(
                    "Check the log files or console output above to identify which "
                    "builder module failed and check its settings."
                ),
            )

        # Deploy
        logger.info("Running deployment...")
        orchestrator = DeploymentOrchestrator(
            global_config=global_config,
            output_dir=output_dir,
            enable_apis=args.enable_apis,
            create_datasets=args.create_datasets,
        )
        if not orchestrator.execute_deployments():
            raise CortexDeployError(
                "Deployment failed.",
                hint=(
                    "Verify target deployment logs or console output above to identify "
                    "details about the target errors."
                ),
            )

        logger.info("All workflow steps completed successfully.")
        EventLogger.wait_for_telemetry()
    except CortexError as e:
        logger.error(str(e))
        sys.exit(1)
    except Exception:
        logger.exception("An unexpected error occurred:")
        sys.exit(1)


if __name__ == "__main__":
    main()
