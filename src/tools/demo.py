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
import os
import pathlib
import sys

from common.deployers.actions import DataformDemoAction
from common.schemas.config_schema import GlobalConfig
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.services.sample_data_seeder import SampleDataSeeder
from common.utils.logging import setup_logging
from tools.build import DataformBuilder
from tools.deploy import DeploymentOrchestrator

logger = logging.getLogger(__name__)


def main(args=None):
    setup_logging()
    parser = argparse.ArgumentParser(description="Build and Deploy Cortex Data Foundation")
    parser.add_argument(
        "--project_id",
        type=str,
        default=None,
        help="Deployment project ID",
    )
    parser.add_argument(
        "--dataform_region",
        type=str,
        default="us-central1",
        help="Dataform region",
    )
    parser.add_argument(
        "--bigquery_location",
        type=str,
        default="US",
        help="BigQuery location",
    )
    parser.add_argument(
        "--service_account",
        type=str,
        default=None,
        help="Dataform execution service account email",
    )
    parser.add_argument(
        "--sap_version",
        type=str,
        default="s4",
        help="SAP version (ecc or s4)",
    )
    parser.add_argument(
        "--source_sap_raw_dataset_id",
        type=str,
        default="cortex_demo_sap_ecc_raw",
        help="Source raw dataset ID",
    )
    parser.add_argument(
        "--target_sap_foundation_dataset_id",
        type=str,
        default="cortex_demo_sap_ecc_data_foundation",
        help="Target foundation dataset ID",
    )
    parser.add_argument(
        "--target_dp_dataset_id",
        type=str,
        default="cortex_demo_data_product",
        help="Target Data Product dataset ID",
    )
    parser.add_argument(
        "--repository_name",
        type=str,
        default="cortex-framework-demo",
        help="Dataform repository name",
    )
    parser.add_argument(
        "--workspace_name",
        type=str,
        default="demo",
        help="Dataform workspace name",
    )
    parser.add_argument(
        "--create_workflow_configs",
        action="store_true",
        help="Create a Dataform workflow configuration and trigger post-deployment steps",
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

    args = parser.parse_args(args)

    if not args.project_id and not os.getenv("PROJECT_ID"):
        logger.error(
            "Required argument --project_id or environment variable PROJECT_ID is missing."
        )
        sys.exit(1)

    if args.create_workflow_configs and not args.service_account:
        logger.error("--service_account is required when --create_workflow_configs is set.")
        sys.exit(1)

    global_config_dict = {
        "buildEnvironment": {"buildProjectId": "${BUILD_PROJECT_ID}"},
        "data": {
            "bigQueryLocation": "${LOCATION}",
            "namespaces": [{"name": "cortex", "path": "cortex"}],
            "sources": [
                {
                    "id": "sap_raw",
                    "projectId": "${PROJECT_ID}",
                    "datasetId": "${SOURCE_SAP_RAW_DATASET_ID}",
                }
            ],
            "targets": [
                {
                    "id": "sap_foundation",
                    "projectId": "${PROJECT_ID}",
                    "datasetId": "${TARGET_SAP_FOUNDATION_DATASET_ID}",
                },
                {
                    "id": "product_target",
                    "projectId": "${PROJECT_ID}",
                    "datasetId": "${TARGET_DP_DATASET_ID}",
                },
            ],
            "modules": {
                "foundation": [
                    {
                        "moduleId": "erp",
                        "type": "cortex.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "${SAP_VERSION}", "mandt": "100"},
                    }
                ],
                "product": [
                    {
                        "moduleId": "sap_purchasing_organizations",
                        "type": "cortex.purchasing_organizations",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_purchasing_documents",
                        "type": "cortex.purchasing_documents",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_vendors",
                        "type": "cortex.vendors",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_customers",
                        "type": "cortex.customers",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_documents",
                        "type": "cortex.sales_documents",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_organizations",
                        "type": "cortex.sales_organizations",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_delivery_blocking_reasons",
                        "type": "cortex.delivery_blocking_reasons",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_delivery_documents",
                        "type": "cortex.delivery_documents",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_groups",
                        "type": "cortex.material_groups",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_types",
                        "type": "cortex.material_types",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_materials",
                        "type": "cortex.materials",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_plants",
                        "type": "cortex.material_plants",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_cross_plant_batches",
                        "type": "cortex.material_cross_plant_batches",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_movement_types",
                        "type": "cortex.material_movement_types",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_materials_movement",
                        "type": "cortex.materials_movement",
                        "dependsOn": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                ],
            },
        },
        "deployment": {
            "createTargetDatasets": True,
            "targets": [
                {
                    "type": "dataform",
                    "targetSettings": {
                        "repositoryProjectId": "${BUILD_PROJECT_ID}",
                        "repositoryRegion": "${BUILD_REGION}",
                        "repositoryName": "${DATAFORM_REPOSITORY}",
                        "workspaceName": "${DATAFORM_WORKSPACE}",
                        "serviceAccount": "${SERVICE_ACCOUNT}",
                    },
                }
            ],
        },
    }

    # Update the demo config with the project id, region and location

    sa_to_use = args.service_account or ""

    context = {
        "PROJECT_ID": args.project_id,
        "REGION": args.dataform_region,
        "LOCATION": args.bigquery_location,
        "BUILD_PROJECT_ID": args.project_id,
        "BUILD_REGION": args.dataform_region,
        "BUILD_LOCATION": args.bigquery_location,
        "SERVICE_ACCOUNT": sa_to_use,
        "SOURCE_SAP_RAW_DATASET_ID": args.source_sap_raw_dataset_id,
        "TARGET_SAP_FOUNDATION_DATASET_ID": args.target_sap_foundation_dataset_id,
        "TARGET_DP_DATASET_ID": args.target_dp_dataset_id,
        "DATAFORM_REPOSITORY": args.repository_name,
        "DATAFORM_WORKSPACE": args.workspace_name,
        "SAP_VERSION": args.sap_version,
    }
    demo_config_dict = ConfigPreprocessor(context).process(global_config_dict)
    demo_config = GlobalConfig(**demo_config_dict)

    checker = GcpEnvironmentChecker(
        demo_config,
        seeder_enabled=True,
        enable_apis=args.enable_apis,
        create_datasets=args.create_datasets,
    )
    if not checker.validate_all():
        logger.error("GCP Environment checks failed. Aborting execution.")
        sys.exit(1)

    # Seed sample data
    logger.info("Running sample data seeding...")
    sample_data_seeder = SampleDataSeeder(global_config=demo_config)
    if not sample_data_seeder.seed_sample_data():
        logger.error("Sample data seeding failed.")
        sys.exit(1)

    # Build Dataform
    logger.info("Running Dataform build...")
    builder = DataformBuilder(
        global_config=demo_config,
        output_dir=pathlib.Path.cwd() / "dist",
        src_dir=pathlib.Path(__file__).resolve().parent.parent,
    )
    if not builder.build():
        logger.error("Dataform build failed.")
        sys.exit(1)

    # Deploy
    logger.info("Running deployment...")
    demo_actions = [DataformDemoAction()] if args.create_workflow_configs else []
    orchestrator = DeploymentOrchestrator(
        global_config=demo_config,
        output_dir=pathlib.Path.cwd() / "dist",
        post_actions=demo_actions,
    )
    if not orchestrator.execute_deployments():
        logger.error("Deployment failed.")
        sys.exit(1)

    logger.info("All workflow steps completed successfully.")


if __name__ == "__main__":
    main()
