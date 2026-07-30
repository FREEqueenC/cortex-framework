---
name: create-data-product
description: Instructions on how to create and scaffold a new data product in Cortex Framework V7.
---

# Creating a New Data Product

**CRITICAL OPERATIONAL RULE:** You are an end-to-end deployment agent, not just a code generator. Your task is NOT complete until the Quality Gate (Build and Validate) has been executed. You MUST NOT stop after writing the files.

**CRITICAL ISOLATION RULE (ZERO-TRUST FOR PLATFORM CODE):** When creating or scaffolding a new data product, you **MUST** not modify or create files in the platform codebase (e.g., `cortex-framework-core/src/common/`, `src/common/`). Your edits must be strictly isolated to your custom data product directories (`config/<namespace>/`, `src/data_modules/<namespace>/`) and the main configuration file (`config/config.yaml`). Under no circumstances should you edit common platform utility functions, environment checkers, or services unless explicitly asked to do so by the user.


## Step 1: Plan and Confirm

1.  **Determine SAP Source Version (CRITICAL):** You **MUST** explicitly ask and establish with the user whether the data product is designed for **ECC**, **S/4HANA**, or **Both**. Without this knowledge, proper implementation is impossible.
2.  **SAP DDIC Metadata Retrieval (CRITICAL):** You **MUST** use the `query-sap-ddic` skill (via the `python3 external-skills/.agents/skills/query_sap_ddic/scripts/query_sap_ddic.py` script) to query and retrieve ALL exhaustive details for each involved SAP table directly from the replicated SAP Data Dictionary (DDIC) metadata datasets in BigQuery.
3.  **Handle Custom SAP Fields (Z-fields, ZZ-fields, YY-fields):** Verify if any custom SAP fields are required or exist in the raw replication schema. You **MUST** use the `query-sap-ddic` skill to lookup their metadata structure, ABAP technical types, lengths, and check tables, and explicitly document their mapping in your implementation plan.
4.  **Handle Schema Differences Explicitly:** Analyze the retrieved schema specs and explicitly identify and list any structural, field name, or data type differences between ECC and S/4HANA. Your implementation plan must explicitly handle these differences (e.g., using separate folders like `annotations/ecc/` vs `annotations/s4/`, or conditional logic in the SQL definitions).
5.  **Identify and Validate Foundations:** Check available data foundations in `src/data_modules/<namespace>/<source>/foundations/sap/` and `config/<namespace>/<source>/foundations/sap/`. You **MUST** verify all required tables exist in `src/data_modules/<namespace>/<source>/foundations/sap/table_settings.default.yaml`. If any tables are missing, explicitly document them in your implementation plan and define a sub-plan to manually scaffold them:
    - **Developer Role (extending the codebase):** Modify `table_settings.default.yaml` directly to add the missing tables.
    - **End User/Deployer Role (configuring a target deployment):** Do NOT modify `table_settings.default.yaml` directly. Instead, make a copy of `table_settings.default.yaml` with a custom name (e.g., `table_settings.yaml`), add the missing tables to it, and reference this new file in the active `config.yaml` using the `tableSettings` property.
    *Ensure any new tables are inserted at the correct position to preserve alphabetical sorting by `tableName` within `s4`, `ecc`, and `common`. Fetch their schema via DDIC lookup skills, and generate their `annotations.yaml` files in the foundation directory.*
6.  **Verify Custom Namespace:** In accordance with the Cortex V7 Extensibility Guide, custom development **MUST** be placed in a custom namespace (e.g., `custom`, `myorg`) rather than the standard `cortex` namespace to prevent conflicts and ensure clean upgrades.
    - If a custom namespace has not been specified, you **MUST** explicitly ask the user to provide a custom namespace name before proposing the plan.
    - If the user explicitly instructs you to use the standard `cortex` namespace, you **MUST** warn them that modifying the standard namespace is against extensibility best practices and risks being overwritten during future upgrades. Obtain explicit confirmation before proceeding with the `cortex` namespace.
7.  **Propose Name:** Suggest a descriptive name using snake_case.
8.  **Legacy Model Reference:** If legacy specifications or references are available, check if the data product models an existing or similar legacy data model.
9.  **Research Field Mappings:** Research the relevant field mappings between the data foundation and the new data product models, including the reasoning for each mapping, so the user can adjust them if needed.
10. **Evaluate Need for ABAP Source Code (CRITICAL):** Depending on the user-provided requirements, your general understanding of SAP systems, the target version (ECC/S4HANA), and the business logic/modeling goals, evaluate if custom or standard ABAP program details are necessary to model the data product correctly (e.g. to replicate complex transaction statuses, calculations, or custom business rules). If required, you **MUST** explicitly ask the user for the relevant ABAP program names, specifications, or source code blocks.
11. **Propose Unit Tests Structure:** Formulate the strategy for verifying the product via automated testing by proposing a dedicated Python unit test. Specify the target `pytest` paths and the relational assertions required to validate the compiled SQL joins, filters, and primary transformations.
12. **Propose Plan**: You **MUST** read the template file using your file reading tool at `assets/plan_template.md`. The plan you propose **MUST** exactly follow the markdown headings and structure outlined in that file. Do not invent your own structure.
13. **WAIT for user confirmation on the plan before writing any code.**

## Step 2: Scaffold Directories

Create the required target directories isolation framework, replacing `<namespace>`, `<source>`, and `<type>`:
- `src/data_modules/<namespace>/<source>/products/<type>/`
- `src/data_modules/<namespace>/<source>/products/<type>/annotations/` (Add `ecc/` and `s4/` subdirectories if there are differences between the source systems)
- `src/data_modules/<namespace>/<source>/products/<type>/definitions/` (Add `ecc/` and `s4/` subdirectories if there are differences between the source systems)
- `config/<namespace>/<source>/products/<type>/` (Optional: only needed if creating custom config overrides)

## Step 3: Create Files

**CRITICAL:** You MUST strictly follow the formatting and styling rules defined in [style_guide.md](references/style_guide.md).

### 1. `manifest.yaml` (`src/data_modules/<namespace>/<source>/products/<type>/`)
Use the template found at: [manifest.yaml.md](assets/manifest.yaml.md)

### 2. Table Settings (e.g., `table_settings.default.yaml` or custom `table_settings.yaml`)
Depending on your role, choose the correct approach:
* **Developer Role (building/extending data modules in the codebase):**
  - **New Product (Scenario A):** Create a new `table_settings.default.yaml` containing the default configuration for the product. Use the template: [table_settings.yaml.md](assets/table_settings.yaml.md)
  - **Adding Assets (Scenario B):** Update the existing `table_settings.default.yaml` directly to add the new tables/views to the default distribution (for both product and foundation modules).
* **End User/Deployer Role (configuring a target deployment or overriding settings):**
  - **NEVER** modify `table_settings.default.yaml` directly. Instead, make a copy named `table_settings.yaml` (or target-specific name) in the same directory, make your custom changes there, and point to it using the `tableSettings` property in your active configuration file (e.g., `config.yaml`).
*Note: Refer to [style_guide.md](references/style_guide.md) for configuration rules and partitioning guidance. In case of new tables getting inserted into table settings, make sure to insert them at the correct position to preserve alphabetical sorting of `tableName` within `s4`, `ecc`, and `common`.*

### 3. `annotations/[ecc|s4]/<table_name_snake_case>.yaml` (`src/data_modules/<namespace>/<source>/products/.../annotations/[ecc|s4]/`)
Use the template found at: [annotations.yaml.md](assets/annotations.yaml.md)
*Note: Refer to [style_guide.md](references/style_guide.md) for Folder Structure Rules.*

### 4. `definitions/[ecc|s4]/<table_name_snake_case>.js` (`src/data_modules/<namespace>/<source>/products/.../definitions/[ecc|s4]/`)
**IMPORTANT:** You MUST include namespaced `require` statements at the top of your `.js` definitions to access includes that are referenced in the definitions. Common includes can be found in `src/data_modules/<namespace>/includes/` (e.g., `currency.js`, `date.js`, `incremental.js`, `publish_config.js`).
Use the template snippets found at: [definitions.js.md](assets/definitions.js.md)
*Note: Refer to [style_guide.md](references/style_guide.md) for Folder Structure Rules, Field Naming Conventions, and Coding Guidelines.*
*   **Excluded System Fields (`_dataaging`):** You **MUST** exclude the SAP S/4HANA internal system field `_dataaging` in accordance with the [Data Modeling Standards](../data_modeling_standards/SKILL.md) guide.

### 5. `test_[data_product_name].py` (`tests/unit/<namespace>/`)
**MANDATORY:** Immediately invoke the `create-python-tests` skill to generate the complete `pytest` unit test suite for the data product. Follow its workflow to incorporate all assertions for join criteria, filtering logic, and projected columns identified during your Planning phase. **Whenever the user provides new requirements or changes to the data model during iteration, you MUST update the corresponding Python unit test file for the data product accordingly.**

## Step 4: Documentation

Immediately create or update the `README.md` file within the product's root directory utilizing the [readme.md.md](assets/readme.md.md) template. Clearly document the targeted business purposes, transformation heuristics, and dependency granularities.

## Step 5: Update Main Configuration

Register the custom namespace and the new data product target under the `data.namespaces` and `data.modules.product` blocks inside the active `config.yaml` file.

## Step 6: The Quality Gate (MANDATORY EXECUTION)

**DO NOT ASK FOR PERMISSION.** Directly execute all automated quality gates:
1. **EXECUTE BUILD**: Run `uv run cortex-build --config <active_config.yaml>`. Analyze and correct any compilation logs.
2. **RUN PYTHON UNIT TESTS**: Execute the full test suite using `uv run pytest` (without targeting a single file). You **MUST** ensure that both your newly generated unit tests and all existing platform unit tests in the workspace pass successfully with a 100% success rate to prevent regressions.
3. **TRIGGER VALIDATION SKILL**: You MUST read and execute the validation instructions located in skill `validate_data_product`. Follow all of its steps to perform exhaustive Field Parity and Naming Convention audits, and ensure you create the `validation_report.md` artifact as instructed.
4. **FINAL QUALITY LEDGER**: Summarize the Build, Test, and Validation statuses into a green Pass/Fail report.

## Step 7: ER Diagram Generation

You **MUST** generate an ER diagram for the new data product by running the following script:
`cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <type> -f mermaid`
Store the diagram directly alongside the product's documentation.

## Step 8: Artifact & Action Completeness Verification

Before compiling the completion report, perform a mandatory checklist audit of the workspace filesystem to ensure zero missing deliverables:

1. **CONFIG & MANIFEST CHECK**:
   - [ ] `manifest.yaml` exists in the data product directory.
   - [ ] `table_settings.default.yaml` exists in the data product directory (or `table_settings.yaml` if explicit override specified).
   - [ ] Product is registered inside `config.yaml`.
2. **MODEL & ANNOTATION CHECK**:
   - [ ] JS materialization models exist under `definitions/`.
   - [ ] Column descriptions and metadata exist under `annotations/`.
3. **DOCUMENTATION & DIAGRAM CHECK**:
   - [ ] Data product `README.md` is compiled using the standard template.
   - [ ] One or more ER diagram formats are present.
4. **QUALITY GATES VERIFICATION**:
   - [ ] `uv run pytest` executed with 100% success rate.
   - [ ] `validate-data-product` executed with zero field parity errors.

*If any check fails, resolve the missing action immediately before proceeding.*

## Step 9: Completion Report

Compile the final **Data Product Creation Completion Report** artifact and save it inside the standard brain artifacts directory using the [completion_report_template.md](assets/completion_report_template.md) template. Save this artifact with the exact filename `completion_report.md`. Sections and bullets inside the report **MUST NOT BE REMOVED**; if a section does not apply, mark it explicitly as "Not Applicable", "Missing", or "None".

## Step 10: Deploy

Present the completed, validated product and its visual ER diagram to the user. **REQUEST EXPLICIT APPROVAL** before initiating live workspace deployment.
