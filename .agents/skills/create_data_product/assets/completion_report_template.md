# Data Product Creation Completion Report

The modular data product **`[DATA_PRODUCT_ID]`** has been successfully designed, implemented, and verified using the `create-data-product` developer skill.

> [!IMPORTANT]
> **Data Product Metadata:**
> *   **Module ID:** `[DATA_PRODUCT_ID]`
> *   **Module Type:** `[MODULE_TYPE]` *(e.g., cortex.purchasing_organizations)*
> *   **Target Namespace:** `[NAMESPACE]` *(e.g., cortex)*
> *   **SAP Module Dependency:** `[DEPENDS_ON_SAP_MODULE]` *(e.g., erp)*
> *   **SAP Version Compatibility:** `[SAP_VERSION_COMPATIBILITY]` *(e.g., ecc, s4, or both)*

---

## 📂 Created Assets & Files

The following modular files were successfully created and integrated within the workspace:

| Asset / File | Path | Description |
| :--- | :--- | :--- |
| **Manifest File** | [manifest.yaml](file:///[MANIFEST_PATH]) | Standard V7 metadata and description manifest |
| **JS Definitions** | [[DEFINITIONS_FILE_NAME]](file:///[DEFINITIONS_PATH]) | Core Dataform query logic and materialization parameters |
| **Table Settings** | [table_settings.default.yaml](file:///[TABLE_SETTINGS_PATH]) | Performance clustering and partitioning overrides |
| **Annotations File** | [annotations.yaml](file:///[ANNOTATIONS_PATH]) | Column-level documentation and user annotations |
| **Readme Document** | [README.md](file:///[README_PATH]) | High-level documentation and user guides for the product |
| **Python Test File** | [[TEST_FILE_NAME]](file:///[TEST_PATH]) | Pytest unit test file validating join keys, filters, and projected fields |
| **ER Diagram** | [[ER_DIAGRAM_FILE_NAME]](file:///[ER_DIAGRAM_PATH]) | Visual Entity-Relationship Diagram outlining table schemas and grains |

---

## 🔗 Data Foundation & Source Dependencies

This data product builds upon the standard SAP foundation layer using clean, normalized sources:

*   **Source Tables Referenced:**
    *   `[List each table referenced, e.g., KNA1 (Customers), LFA1 (Vendors)]`
*   **Target Materialization:**
    *   Dataset/Schema Target: `[TARGET_DATA_PRODUCT_DATASET]`
    *   Table/View Type: `[table / view / incremental]`

---

## ✅ Local Validation Checklist

Before final integration, the new data product successfully passed the following verification gates:

| Verification Step | Status | Details / Output Log |
| :--- | :--- | :--- |
| **Syntax Check** | **[Passed / Failed]** | Evaluated JavaScript definition structure |
| **Dataform Compilation** | **[Passed / Failed]** | Workspace compiles cleanly with no dependency cycles |
| **Table Settings Integrity** | **[Passed / Failed]** | Correctly namespaces partitions and indexes |
| **JSDoc & Comments** | **[Passed / Failed]** | All exported configurations are documented |
| **Python Unit Tests** | **[Passed / Failed]** | Executed pytest on unit test file; verified all assertions passed |


---

## 🚀 Build and Deploy Steps

Now that the data product assets are successfully generated and compiled:

1.  **Verify active configurations**: Ensure target datasets and GCP project IDs are updated inside `cortex-framework-core/config/config.yaml`.
2.  **Deploy data products**: Run deployment tool using the `build-and-deploy-data-product` skill:
    ```bash
    uv run cortex-deploy --config config/config.yaml
    ```
