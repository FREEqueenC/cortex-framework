---
name: validate-data-product
description: Instructions on how to validate an existing or newly created data product in Cortex Framework V7 with mandatory granular status reporting.
---

# Validating a Data Product

When asked to validate a data product, you MUST follow these steps and provide a status for every sub-step. Your task is not complete until the **Final Validation Ledger** is populated.

The following steps are mandatory:

- Step 1: Syntax & Compilation Check (Status Required)
- Step 2: Testing & Linting (Status Required)
- Step 3: Structural and Syntax Validation (Status Required)
- Step 4: Field and Data Foundation Validation (Status Required)
- Step 5: Readability & Configuration (Status Required)
- Step 6: Pipeline Execution (Status Required)

Please refer to [validation_steps.md](references/validation_steps.md) for the detailed validation steps to follow.

---

## 📊 Mandatory Validation Reporting

At the end of every validation task (successful or otherwise), you **MUST** generate a comprehensive **Data Product Validation Report** as an artifact in the standard brain artifacts directory.
*   Use the template located at: [validation_report_template.md](assets/validation_report_template.md)
*   Save this artifact with the exact filename `validation_report.md` for user review.
*   Fill in all placeholders (e.g. GCP parameters, validation statuses, detailed log outputs) accurately based on your run.
*   Ensure the Final Validation Ledger inside is fully populated.
*   Refer to the generated report in your final response to the user.