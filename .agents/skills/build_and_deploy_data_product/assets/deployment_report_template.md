# Data Product Deployment Report

The Dataform pipeline has been successfully compiled and deployed using the `build-and-deploy-data-product` developer skill.

> [!IMPORTANT]
> **Active Target Environment:**
> *   **GCP Project:** `[GCP_PROJECT_ID]`
> *   **BigQuery Location:** `[BIGQUERY_LOCATION]`
> *   **Dataform Repository:** `[REPOSITORY_NAME]` (`[DATAFORM_REGION]`)
> *   **Dataform Workspace:** `[WORKSPACE_NAME]`
> *   **Execution Service Account:** `[SERVICE_ACCOUNT_OR_DEFAULT]` *(Optional)*

---

## 🚀 Execution Timeline

```mermaid
gantt
    title Cortex V7 Deployment Timeline
    dateFormat  HH:mm:ss
    axisFormat %H:%M:%S
    
    %% Include Setup section only if seeding or external prep was executed
    section Setup
    [SETUP_STEP_NAME_OR_SEEDING]        :active, [SETUP_START_TIME], [SETUP_END_TIME]
    
    section Execution
    Dataform Build       :active, [BUILD_START_TIME], [BUILD_END_TIME]
    Dataform Deploy      :active, [DEPLOY_START_TIME], [DEPLOY_END_TIME]
```

### 1. Environment Setup & Data Seeding (Optional / Condition-Based)
*   **Action:** `[Describe if sample seeding or API setup was performed, e.g., Seeded mock raw tables into [SOURCE_DATASET]]`
*   **Status:** `[Completed / Skipped / Custom Setup]`
*   **Details:** `[List tables seeded or APIs enabled, e.g., vbak, vbap, tcurc, or service usage checks]`

### 2. Dataform Build
*   **Command:** `uv run cortex-build --config [CONFIG_PATH]`
*   **Compilation:** **[Passed / Failed]**
*   **Assets Generated:** Transformed foundation tables and modular data products compiled into static SQLX and JS assets under `/dist`.

### 3. Workspace Deployment
*   **Command:** `uv run cortex-deploy --config [CONFIG_PATH]`
*   **Status:** **[Passed / Failed]**
*   **Repository Sync:** Pushed all updated and newly compiled configurations directly to Dataform.

---

## 🔗 Access Your Dataform Workspace

You can view the compiled definitions, execute dry-runs, and trigger the workspace compilation execution directly in the Google Cloud Console:

> [!TIP]
> **[👉 Open Workspace in Google Cloud Console](https://console.cloud.google.com/bigquery/dataform/locations/[DATAFORM_REGION]/repositories/[REPOSITORY_NAME]/workspaces/[WORKSPACE_NAME]?project=[GCP_PROJECT_ID])**

---

## 💎 Next Actions & Verification
*   **Execute Pipeline:** Open the console link above, select **Start Execution** -> **All actions** inside the Dataform console to populate target datasets in BigQuery.
*   **Verify Materializations:** Use standard SQL or BigQuery console to query transformed tables under foundation and product target datasets (e.g., `[PRODUCT_DATASET_ID]`).
*   **Run Assertions (Optional):** `[Mention if custom Dataform assertions were run, e.g., assertions.sqlx]`
