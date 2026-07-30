# Data Product Validation Report

The modular data product validation checks have been successfully executed and verified using the `validate-data-product` developer skill.

> [!IMPORTANT]
> **Validation Environment & Target:**
> *   **Data Product Module ID:** `[DATA_PRODUCT_ID]`
> *   **Active Config File:** `[CONFIG_FILE_PATH]`
> *   **GCP Project ID:** `[GCP_PROJECT_ID]`
> *   **BigQuery Target Dataset:** `[TARGET_DATASET_ID]`

---

## 📋 Final Validation Ledger

The validation results for every sub-step of the Quality Gate are detailed in the ledger below:

| ID | Check Category | Sub-Step | Status | Key Findings / Fixes |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Compilation | Cortex Build | `[Pass / Fail]` | `[Describe findings, errors, or fixes]` |
| **1.2** | Compilation | Dataform Compile | `[Pass / Fail]` | `[Describe findings, errors, or fixes]` |
| **2.1** | Testing | Pytest | `[Pass / Fail]` | `[Describe unit tests run/failed]` |
| **2.2** | Testing | Mypy | `[Pass / Fail]` | `[Describe static typing errors/results]` |
| **2.3** | Testing | Dataform Test | `[Pass / Fail]` | `[Describe Dataform unit test results]` |
| **3.1** | Structure | moduleConfig & Refs | `[Pass / Fail]` | `[Verify correct refs rather than hardcoding]` |
| **3.2** | Structure | Naming & Filenames | `[Pass / Fail]` | `[Confirm snake_case & camelCase rules]` |
| **4.1** | Integrity | Field Verification | `[Pass / Fail]` | `[Verify fields exist in source annotations]` |
| **4.2** | Integrity | SAP Logic/Types | `[Pass / Fail]` | `[Ensure dates and empty values match SAP logic]` |
| **5.1** | Config | Table Settings (ECC/S4) | `[Pass / Fail]` | `[Confirm YAML target mappings]` |
| **6.1** | Execution | Dataform Run | `[Pass / Fail]` | `[Output details of Dataform run execution]` |

> [!CAUTION]
> If any ledger item is marked as **Fail**, you must implement the required code correction, rebuild, and re-run the Quality Gate validators before requesting deployment approval.

---

## 📊 Validation Details & Logs

### 1. Syntax & Compilation Logs
```
[Insert relevant snippets from `cortex-build` or `dataform compile` console outputs]
```

### 2. Test Suite Execution Output
```
[Insert relevant snippets from `pytest` or `mypy` console outputs]
```

---

## 🚀 Next Steps
*   **If 100% Green (Passed):** Propose deployment to the live development environment using the `build-and-deploy-data-product` skill.
*   **If Failures Exist:** Correct the failing definitions or settings and re-run the validation checks.
