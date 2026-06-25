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

from common.schemas.config_schema import GlobalConfig
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.config_validator import ConfigValidator
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.utils.file_utils import load_yaml
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
        global_config,
        enable_apis=args.enable_apis,
        create_datasets=args.create_datasets,
    )
    if not checker.validate_all():
        logger.error("GCP Environment checks failed. Aborting execution.")
        sys.exit(1)

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
        logger.error("Dataform build failed.")
        sys.exit(1)

    # Deploy
    logger.info("Running deployment...")
    orchestrator = DeploymentOrchestrator(
        global_config=global_config,
        output_dir=output_dir,
        enable_apis=args.enable_apis,
        create_datasets=args.create_datasets,
    )
    if not orchestrator.execute_deployments():
        logger.error("Deployment failed.")
        sys.exit(1)

    logger.info("All workflow steps completed successfully.")


if __name__ == "__main__":
    main()
