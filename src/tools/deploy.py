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

"""Cloud Deployment Script.

Responsible for deploying Cortex Data Foundation to the cloud.
"""

import argparse
import logging
import pathlib
import sys
from collections.abc import Sequence

from common.clients.bq.bigquery import BigQueryManager
from common.deployers.actions import PostDeploymentAction
from common.errors import CortexConfigError, CortexDeployError, CortexError
from common.schemas.config_schema import DataformDeploymentTargetConfig, GlobalConfig
from common.services.config_loader import ConfigLoader
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.services.telemetry import constants, telemetry_logger
from common.services.telemetry.consent_manager import TelemetryConsentManager
from common.utils.logging import setup_logging

logger = logging.getLogger(__name__)


class DeploymentOrchestrator:
    """Orchestrates deployments for different target systems."""

    def __init__(
        self,
        global_config: GlobalConfig,
        output_dir: pathlib.Path,
        deployer_factory=None,
        post_actions: Sequence[PostDeploymentAction] | None = None,
        enable_apis: bool = False,
        create_datasets: bool = False,
    ):
        self.global_config = global_config
        self.output_dir = output_dir
        self.bq_client = BigQueryManager()
        self.deployer_factory = deployer_factory
        self.post_actions = post_actions or []
        self.enable_apis = enable_apis
        self.create_datasets = create_datasets
        self.checker = GcpEnvironmentChecker(
            global_config, enable_apis=enable_apis, create_datasets=create_datasets
        )

        # Auto-discover deployer plugins so deployer_registry is populated
        from common.registry import auto_discover_plugins

        auto_discover_plugins("common.deployers")

    def _get_deployer(self, target_type: str):
        """Loads and returns a deployer instance for the given target_type."""
        if self.deployer_factory:
            deployer = self.deployer_factory(target_type)
            if deployer:
                return deployer

        # Import the deployer_registry
        from common.registry import deployer_registry

        deployer_class = deployer_registry.get(target_type)

        if deployer_class:
            return deployer_class()
        else:
            logger.error("Deployer plugin for %s is missing from deployer_registry.", target_type)
            return None

    def execute_deployments(self) -> bool:
        """Executes all deployments defined in the config."""
        deployment_config = self.global_config.deployment
        if not deployment_config or not deployment_config.targets:
            logger.info("No deployment targets found.")
            return True

        all_successful = True

        for target in deployment_config.targets:
            if not target.enabled:
                continue

            target_type = target.type.value
            if not target_type:
                logger.warning("Deployment target missing 'type' attribute. Skipping.")
                all_successful = False
                continue

            telemetry_logger_instance = None
            if isinstance(target, DataformDeploymentTargetConfig):
                telemetry_logger_instance = telemetry_logger.EventLogger.for_dataform_repository(
                    project_id=target.target_settings.repository_project_id,
                    location=target.target_settings.repository_region,
                    repository_id=target.target_settings.repository_name,
                    component=constants.TelemetryComponent.PLATFORM,
                    type=constants.TelemetryPlatformTool.DEPLOYER,
                    variant=target_type,
                )

            enabled_modules_types: list[str] = [
                module.module_path
                for module in self.global_config.data.modules.foundation
                if module.enabled
            ]
            enabled_modules_types += [
                module.module_path
                for module in self.global_config.data.modules.product
                if module.enabled
            ]

            logger.info("Executing plugin deployer for target type: %s", target_type)
            try:
                deployer = self._get_deployer(target_type)
                if not deployer:
                    raise CortexDeployError(
                        f"Deployer plugin for '{target_type}' is missing from deployer_registry.",
                        hint=(
                            "Verify that you have correctly defined and registered the "
                            f"deployer for target type '{target_type}'."
                        ),
                    )

                result = deployer.deploy(self.global_config, target, self.output_dir)
                if not result:
                    raise CortexDeployError(
                        f"Deployer plugin '{target_type}' reported a failure status.",
                        hint=(
                            "Check the target settings in config.yaml and verify that "
                            "the target environment has enough permissions."
                        ),
                    )

                if telemetry_logger_instance:
                    telemetry_logger_instance.log_batch_deployed_status(
                        optional_extensions=enabled_modules_types
                    )
                for action in self.post_actions:
                    logger.info("Executing post-deployment action: %s", action.__class__.__name__)
                    if not action.execute(self.global_config, target, self.output_dir):
                        raise CortexDeployError(
                            f"Post-deployment action failed for target '{target_type}'.",
                            hint=(
                                "Check the logs for post-deployment action details and "
                                "check your target resources."
                            ),
                        )

                    if telemetry_logger_instance:
                        telemetry_logger_instance.log_batch_post_deploy_success_status(
                            optional_extensions=enabled_modules_types
                        )

            except CortexError:
                raise
            except Exception as e:
                raise CortexDeployError(
                    f"Deployer logic for '{target_type}' failed unexpectedly: {e}",
                    hint=(
                        "Check the traceback in logs or contact the Cortex Framework team for help."
                    ),
                ) from e

        return all_successful


def main(args=None):
    setup_logging()
    parser = argparse.ArgumentParser(description="Deploying Cortex Data Foundation")
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
        help="Enable required APIs without prompting",
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
            global_config, enable_apis=args.enable_apis, create_datasets=args.create_datasets
        )
        checker.validate_all()

        output_dir = args.output_dir
        if not output_dir.is_absolute():
            output_dir = pathlib.Path.cwd() / output_dir

        orchestrator = DeploymentOrchestrator(
            global_config,
            output_dir,
            enable_apis=args.enable_apis,
            create_datasets=args.create_datasets,
        )
        success = orchestrator.execute_deployments()

        if not success:
            raise CortexDeployError(
                "Deployment completed with errors.",
                hint=(
                    "Verify target deployment logs or console output above to identify "
                    "details about the target errors."
                ),
            )

        logger.info("Deployment completed successfully.")
        telemetry_logger.EventLogger.wait_for_telemetry()
    except CortexError as e:
        logger.error(str(e))
        sys.exit(1)
    except Exception:
        logger.exception("An unexpected error occurred:")
        sys.exit(1)


if __name__ == "__main__":
    main()
