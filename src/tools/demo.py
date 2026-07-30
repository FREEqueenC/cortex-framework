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
from collections.abc import Sequence

from common.deployers.actions import DataformDemoAction, PostDeploymentAction
from common.errors import CortexError
from common.services.config_loader import ConfigLoader
from common.services.config_preprocessor import ConfigPreprocessor
from common.services.gcp_environment_checker import GcpEnvironmentChecker
from common.services.sample_data_seeder import SampleDataSeeder
from common.services.telemetry.consent_manager import TelemetryConsentManager
from common.services.telemetry.telemetry_logger import EventLogger
from common.utils.logging import setup_logging
from tools.build import DataformBuilder
from tools.deploy import DeploymentOrchestrator

logger = logging.getLogger(__name__)


def main(args: Sequence[str] | None = None) -> None:
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
        type=str.lower,
        choices=["ecc", "s4"],
        default="s4",
        help="SAP version (ecc or s4)",
    )
    parser.add_argument(
        "--source_sap_raw_dataset_id",
        type=str,
        default=None,
        help="Source raw dataset ID. Defaults to cortex_demo_sap_<sap_version>_raw",
    )
    parser.add_argument(
        "--target_sap_foundation_dataset_id",
        type=str,
        default=None,
        help=(
            "Target foundation dataset ID. "
            "Defaults to cortex_demo_sap_<sap_version>_data_foundation"
        ),
    )
    parser.add_argument(
        "--target_dp_dataset_id",
        type=str,
        default=None,
        help="Target Data Product dataset ID. Defaults to cortex_demo_data_product",
    )
    parser.add_argument(
        "--target_samples_dataset_id",
        type=str,
        default="cortex_demo_samples",
        help="Target samples dataset ID",
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

    parsed_args = parser.parse_args(args)

    # Dynamically resolve dataset defaults based on sap_version if not provided
    if parsed_args.source_sap_raw_dataset_id is None:
        parsed_args.source_sap_raw_dataset_id = f"cortex_demo_sap_{parsed_args.sap_version}_raw"
    if parsed_args.target_sap_foundation_dataset_id is None:
        parsed_args.target_sap_foundation_dataset_id = (
            f"cortex_demo_sap_{parsed_args.sap_version}_data_foundation"
        )
    if parsed_args.target_dp_dataset_id is None:
        parsed_args.target_dp_dataset_id = "cortex_demo_data_product"

    TelemetryConsentManager.setup(parsed_args.disable_telemetry)

    if not parsed_args.project_id and not os.getenv("PROJECT_ID"):
        logger.error(
            "Required argument --project_id or environment variable PROJECT_ID is missing."
        )
        sys.exit(1)

    if parsed_args.create_workflow_configs and not parsed_args.service_account:
        logger.error("--service_account is required when --create_workflow_configs is set.")
        sys.exit(1)

    global_config_dict = {
        "buildEnvironment": {"buildProjectId": "${BUILD_PROJECT_ID}"},
        "data": {
            "bigQueryLocation": "${LOCATION}",
            "namespaces": [
                {"name": "cortex", "path": "src/data_modules/cortex"},
                {"name": "cortex_samples", "path": "src/data_modules/cortex_samples"},
            ],
            "datasets": [
                {
                    "id": "sap_raw",
                    "projectId": "${PROJECT_ID}",
                    "datasetId": "${SOURCE_SAP_RAW_DATASET_ID}",
                },
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
                {
                    "id": "samples_target",
                    "projectId": "${PROJECT_ID}",
                    "datasetId": "${TARGET_SAMPLES_DATASET_ID}",
                },
            ],
            "modules": {
                "foundations": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {"sapVersion": "${SAP_VERSION}", "mandt": "100"},
                    }
                ],
                "products": [
                    {
                        "moduleId": "sap_accounting_documents",
                        "modulePath": "cortex.sap.products.accounting_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_accounts_payable",
                        "modulePath": "cortex.sap.products.accounts_payable",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_accounts_receivable",
                        "modulePath": "cortex.sap.products.accounts_receivable",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_addresses",
                        "modulePath": "cortex.sap.products.addresses",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_agency_settlement_documents",
                        "modulePath": "cortex.sap.products.agency_settlement_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_bill_of_materials",
                        "modulePath": "cortex.sap.products.bill_of_materials",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_billing_documents",
                        "modulePath": "cortex.sap.products.billing_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_treasury_positions",
                        "modulePath": "cortex.sap.products.treasury_positions",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_business_partners",
                        "modulePath": "cortex.sap.products.business_partners",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_condition_contracts",
                        "modulePath": "cortex.sap.products.condition_contracts",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_controlling_areas_and_cost_elements",
                        "modulePath": "cortex.sap.products.controlling_areas_and_cost_elements",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_controlling_documents",
                        "modulePath": "cortex.sap.products.controlling_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_cash_and_liquidity_management",
                        "modulePath": "cortex.sap.products.cash_and_liquidity_management",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_cost_and_profit_centers",
                        "modulePath": "cortex.sap.products.cost_and_profit_centers",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_currency_conversion",
                        "modulePath": "cortex.sap.products.currency_conversion",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_customers",
                        "modulePath": "cortex.sap.products.customers",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_delivery_documents",
                        "modulePath": "cortex.sap.products.delivery_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_financial_statement_structure_versions",
                        "modulePath": "cortex.sap.products.financial_statement_structure_versions",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_financial_hierarchies",
                        "modulePath": "cortex.sap.products.financial_hierarchies",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_fiscal_year_variants",
                        "modulePath": "cortex.sap.products.fiscal_year_variants",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_fixed_assets",
                        "modulePath": "cortex.sap.products.fixed_assets",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_asset_documents",
                        "modulePath": "cortex.sap.products.asset_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_general_ledger_accounts",
                        "modulePath": "cortex.sap.products.general_ledger_accounts",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_global_settings",
                        "modulePath": "cortex.sap.products.global_settings",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_batches",
                        "modulePath": "cortex.sap.products.material_batches",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_material_ledger",
                        "modulePath": "cortex.sap.products.material_ledger",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_materials",
                        "modulePath": "cortex.sap.products.materials",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_materials_movement",
                        "modulePath": "cortex.sap.products.materials_movement",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_product_hierarchies",
                        "modulePath": "cortex.sap.products.product_hierarchies",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_plants_and_storage",
                        "modulePath": "cortex.sap.products.plants_and_storage",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_treasury_market_data",
                        "modulePath": "cortex.sap.products.treasury_market_data",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_project_structure",
                        "modulePath": "cortex.sap.products.project_structure",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_purchasing_documents",
                        "modulePath": "cortex.sap.products.purchasing_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_purchasing_organizational_structure",
                        "modulePath": "cortex.sap.products.purchasing_organizational_structure",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_documents",
                        "modulePath": "cortex.sap.products.sales_documents",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_organizational_structure",
                        "modulePath": "cortex.sap.products.sales_organizational_structure",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_units_of_measurement",
                        "modulePath": "cortex.sap.products.units_of_measurement",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_vendor_invoices",
                        "modulePath": "cortex.sap.products.vendor_invoices",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_vendors",
                        "modulePath": "cortex.sap.products.vendors",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_object_statuses",
                        "modulePath": "cortex.sap.products.object_statuses",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_budget_allocations",
                        "modulePath": "cortex.sap.products.budget_allocations",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_ledger_master",
                        "modulePath": "cortex.sap.products.ledger_master",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_order_master_data",
                        "modulePath": "cortex.sap.products.order_master_data",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_production_orders",
                        "modulePath": "cortex.sap.products.production_orders",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_pricing_conditions",
                        "modulePath": "cortex.sap.products.sales_pricing_conditions",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target",
                    },
                    {
                        "moduleId": "sap_sales_performance",
                        "modulePath": "cortex_samples.sap.products.sales_performance",
                        "dependencyBindings": {
                            "sapCustomers": "sap_customers",
                            "sapMaterials": "sap_materials",
                            "sapSalesOrganizationalStructure": (
                                "sap_sales_organizational_structure"
                            ),
                            "sapSalesDocuments": "sap_sales_documents",
                            "sapDeliveryDocuments": "sap_delivery_documents",
                        },
                        "dataTargetId": "samples_target",
                    },
                    {
                        "moduleId": "sap_supplier_spend_analysis",
                        "modulePath": "cortex_samples.sap.products.supplier_spend_analysis",
                        "dependencyBindings": {
                            "sapMaterials": "sap_materials",
                            "sapPurchasingDocuments": "sap_purchasing_documents",
                            "sapPurchasingOrganizationalStructure": (
                                "sap_purchasing_organizational_structure"
                            ),
                            "sapVendors": "sap_vendors",
                        },
                        "dataTargetId": "samples_target",
                    },
                ],
            },
        },
        "deployment": {
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

    sa_to_use = parsed_args.service_account or ""

    context = {
        "PROJECT_ID": parsed_args.project_id,
        "REGION": parsed_args.dataform_region,
        "LOCATION": parsed_args.bigquery_location,
        "BUILD_PROJECT_ID": parsed_args.project_id,
        "BUILD_REGION": parsed_args.dataform_region,
        "BUILD_LOCATION": parsed_args.bigquery_location,
        "SERVICE_ACCOUNT": sa_to_use,
        "SOURCE_SAP_RAW_DATASET_ID": parsed_args.source_sap_raw_dataset_id,
        "TARGET_SAP_FOUNDATION_DATASET_ID": parsed_args.target_sap_foundation_dataset_id,
        "TARGET_DP_DATASET_ID": parsed_args.target_dp_dataset_id,
        "TARGET_SAMPLES_DATASET_ID": parsed_args.target_samples_dataset_id,
        "DATAFORM_REPOSITORY": parsed_args.repository_name,
        "DATAFORM_WORKSPACE": parsed_args.workspace_name,
        "SAP_VERSION": parsed_args.sap_version,
    }
    demo_config_dict = ConfigPreprocessor(context).process(global_config_dict)

    # Conditionally add sap_universal_journal only if version is s4
    if parsed_args.sap_version == "s4":
        demo_config_dict["data"]["modules"]["products"].append(
            {
                "moduleId": "sap_universal_journal",
                "modulePath": "cortex.sap.products.universal_journal",
                "dependencyBindings": {"sapModule": "erp"},
                "dataTargetId": "product_target",
            }
        )

    # Conditionally add sap_general_ledger_items only if version is ecc
    if parsed_args.sap_version == "ecc":
        demo_config_dict["data"]["modules"]["products"].append(
            {
                "moduleId": "sap_general_ledger_items",
                "modulePath": "cortex.sap.products.general_ledger_items",
                "dependencyBindings": {"sapModule": "erp"},
                "dataTargetId": "product_target",
            }
        )

    # Conditionally add sap_inventory_and_special_stocks only if version is ecc
    if parsed_args.sap_version == "ecc":
        demo_config_dict["data"]["modules"]["products"].append(
            {
                "moduleId": "sap_inventory_and_special_stocks",
                "modulePath": "cortex.sap.products.inventory_and_special_stocks",
                "dependencyBindings": {"sapModule": "erp"},
                "dataTargetId": "product_target",
            }
        )

    demo_config, errors = ConfigLoader.load_and_validate_dict(
        demo_config_dict,
        config_dir=pathlib.Path.cwd(),
    )
    if errors or not demo_config:
        for error in errors:
            logger.error(error)
        sys.exit(1)

    checker = GcpEnvironmentChecker(
        demo_config,
        seeder_enabled=True,
        enable_apis=parsed_args.enable_apis,
        create_datasets=parsed_args.create_datasets,
    )
    try:
        checker.validate_all()

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
            config_dir=pathlib.Path.cwd(),
        )
        if not builder.build():
            logger.error("Dataform build failed.")
            sys.exit(1)

        # Deploy
        logger.info("Running deployment...")
        demo_actions: list[PostDeploymentAction] = (
            [DataformDemoAction()] if parsed_args.create_workflow_configs else []
        )
        orchestrator = DeploymentOrchestrator(
            global_config=demo_config,
            output_dir=pathlib.Path.cwd() / "dist",
            post_actions=demo_actions,
        )
        if not orchestrator.execute_deployments():
            logger.error("Deployment failed.")
            sys.exit(1)

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
