## Step 1: Syntax & Compilation Check (Status Required)

To finalize validation, run the development tools. Check which config file to use (e.g., `.cortex/<your_name>.local.yaml` or user-specific).

*(Note: If you encounter dependency errors, ensure your environment is synced by running `gpkg setup` and `uv sync` before proceeding).*

1. **Build Dataform**: Execute `uv run cortex-build --config <config_file>`.
   * *Report:* [Success/Fail] + Log Summary
2. **Deep Compilation Check**: Navigate to `dist/` and run `npx dataform compile`.
   * *Report:* [Success/Fail] + Error details
3. **Pitfall Check**: Verify no hardcoded IDs, no double-backslash escaping `\\$`, and correct `ctx.ref` usage.
   * *Report:* [Verified Clean / Issues Found]

## Step 2: Testing & Linting (Status Required)

Each suite must be reported individually.

1. **Python Unit Tests**: Ensure custom Pytest unit tests are written for the new/updated data product using the `create-python-tests` skill. You **MUST** execute and pass **both** your custom unit tests and **all** existing platform unit tests in the workspace (run `uv run pytest`).
   * *Report:* [X Passed / Y Failed] (confirming 100% pass rate across custom and baseline tests)


2. **Mypy Type Checking**: Execute `uv run mypy src tests`.
   * *Report:* [Clean / X Errors]
3. **Dataform Tests**: Execute `npx dataform test dist`.
   * *Report:* [Success/Fail]

## Step 3: Structural and Syntax Validation (Status Required)

Review `.js` definition files manually or via grep.

1. **moduleConfig Check**: Is `moduleConfig` declared correctly at the top?
   * *Report:* [Yes/No]
2. **Source References**: Are you using `moduleConfig.sources.<source>` instead of `.dependencies`?
   * *Report:* [Correct/Needs Fix]
3. **Targeting**: Do `publish()` calls use `database` and `schema` from `moduleConfig`?
   * *Report:* [Correct/Needs Fix]
4. **Naming**: Are files, BigQuery columns, CTEs, and all aliases (CTE, table, source table) strictly `snake_case`? Are JavaScript functions `camelCase` and acronyms kept together?
   * *Report:* [Correct/Needs Fix]
5. **SQL Standards**: Are all SQL keywords `UPPERCASE` and source table field names lowercase? Are CTEs used instead of nested subqueries where applicable?
   * *Report:* [Correct/Needs Fix]
6. **Directory Structure**: Verify that the directory structure matches the `type` defined in `manifest.yaml`.
   * *Report:* [Verified/Needs Fix]

## Step 4: Field and Data Foundation Validation (Status Required)

1. **Field Existence**: Verify every field against `src/data_modules/<namespace>/<source>/foundations/sap/annotations/`.
   * *Report:* [All Verified / List Missing]
2. **Completeness**: Are all relevant fields from the foundation included?
   * *Report:* [Complete / Minimalist]
3. **SAP Logic**: Are dates compared using `IS NOT NULL` instead of `'00000000'`?
   * *Report:* [Verified/Needs Fix]
4. **Excluded System Fields (`_dataaging`)**: Verify that the SAP S/4HANA internal system field `_dataaging` is excluded in accordance with the [Data Modeling Standards](../../data_modeling_standards/SKILL.md) guide.
   * *Report:* [Verified Excluded / Violation Found (Must Remove)]
5. **Annotation Descriptions**: Verify that required annotation descriptions are filled out in the YAML files.
   * *Report:* [Verified/Needs Fix]

## Step 5: Readability & Configuration (Status Required)

1. **JSDoc & Formatting**: Helper functions must have JSDoc. SQL code must be clean and readable.
   * *Report:* [Pass/Fail]
2. **Table Settings**: Verify `src/data_modules/<namespace>/<source>/products/<name>/table_settings.default.yaml` (or custom `table_settings.yaml` if overridden) uses `ecc` and `s4` keys (NOT `common`). Also verify that it correctly uses the dictionary structure with table names as keys, and includes `dataformTags` and `bigQueryLabels`.
   * *Report:* [Correct/Needs Fix]

## Step 6: Pipeline Execution (Status Required)

1. **Dataform Run**: Execute `npx dataform run dist`.
   * *Report:* [Success/Fail]
