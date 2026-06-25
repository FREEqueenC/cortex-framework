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

from common.clients.bigquery import BigQueryManager
from common.deployers.actions import PostDeploymentAction
from common.schemas.config_schema import GlobalConfig
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.config_validator import ConfigValidator
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.utils.file_utils import load_yaml
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

            logger.info("Executing plugin deployer for target type: %s", target_type)
            try:
                deployer = self._get_deployer(target_type)
                if not deployer:
                    all_successful = False
                    continue

                result = deployer.deploy(self.global_config, target, self.output_dir)
                if not result:
                    logger.error("Deployer plugin '%s' reported a failure status.", target_type)
                    all_successful = False
                    continue

                for action in self.post_actions:
                    logger.info("Executing post-deployment action: %s", action.__class__.__name__)
                    if not action.execute(self.global_config, target, self.output_dir):
                        logger.error("Post-deployment action failed.")
                        all_successful = False
                        break

            except Exception as e:
                logger.error(
                    "Deployer logic for %s failed unexpectedly: %s",
                    target_type,
                    e,
                    exc_info=True,
                )
                all_successful = False
                continue

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

    config_file = args.config

    if not config_file.exists():
        logger.error("Config file not found at %s", config_file)
        sys.exit(1)

    is_valid, validation_errors = ConfigValidator.validate(config_file)
    if not is_valid:
        logger.error("Configuration validation failed with the following errors:")
        for err in validation_errors:
            logger.error("  - %s", err)
        sys.exit(1)

    global_config_dict = load_yaml(config_file)
    global_config_dict = ConfigPreprocessor().process(global_config_dict)

    global_config = GlobalConfig.model_validate(
        global_config_dict, context={"config_dir": config_file.parent}
    )

    checker = GcpEnvironmentChecker(
        global_config, enable_apis=args.enable_apis, create_datasets=args.create_datasets
    )
    if not checker.validate_all():
        logger.error("GCP Environment checks failed. Aborting execution.")
        sys.exit(1)

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
        logger.error("Deployment completed with errors.")
        sys.exit(1)

    logger.info("Deployment completed successfully.")


if __name__ == "__main__":
    main()
