# Cortex Framework Configuration Setup Report

The Cortex Framework configuration has been successfully established and validated using the `setup-cortex-config` developer skill.

> [!NOTE]
> The active configuration file is located at:
> [cortex-framework-core/config/config.yaml](file:///[CONFIG_FILE_PATH])

---

## 🛠️ Configuration Overview

Based on the settings provided, the active environment parameters have been populated:

| Parameter | Configured Value | Description |
| :--- | :--- | :--- |
| **Build Project ID** | `[BUILD_PROJECT_ID]` | Host project for build operations |
| **Source Project ID** | `[SOURCE_PROJECT_ID]` | GCP Project hosting raw tables |
| **Source Dataset** | `[SOURCE_DATASET_ID]` | BigQuery dataset with raw replicated SAP tables |
| **Foundation Target Project** | `[FOUNDATION_PROJECT_ID]` | GCP Project for transformed foundation models |
| **Foundation Dataset** | `[FOUNDATION_DATASET_ID]` | BigQuery dataset for foundation models |
| **Product Target Project** | `[PRODUCT_PROJECT_ID]` | GCP Project for final business insight views |
| **Product Dataset** | `[PRODUCT_DATASET_ID]` | BigQuery dataset for data products |
| **Dataform Repo Project** | `[DATAFORM_REPO_PROJECT_ID]` | Project containing the Dataform repo |
| **Dataform Region** | `[DATAFORM_REGION]` | GCP region for Dataform |
| **Dataform Repo Name** | `[REPOSITORY_NAME]` | Unique repository identifier |
| **Dataform Workspace** | `[WORKSPACE_NAME]` | Active Dataform workspace |
| **Execution Service Account** | `[SERVICE_ACCOUNT_OR_DEFAULT]` *(Optional)* | Custom account override for Dataform |

---

## ✅ Validation Status

We executed validation using the configuration setup utility, and the setup validation results are captured below:

*   **Command:** `python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py validate --config [CONFIG_FILE_PATH]`
*   **Validation Result:** **[PASS / FAIL]**

> [!TIP]
> **Validator Output Log:**
> ```
> [Validator output snippets / error lists if any validation warnings occurred]
> ```

---

## 🚀 Next Steps

Now that the environment configuration has been registered and validated:
1.  **Validate raw source tables**: Run the `validate_data_product` skill tools to ensure the raw datasets contain the appropriate columns and types.
2.  **Build and deploy pipelines**: Use the `build_and_deploy_data_product` skill to run the build compiler and push models to Dataform.
