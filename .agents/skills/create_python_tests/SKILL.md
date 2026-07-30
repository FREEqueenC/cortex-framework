---
name: create-python-tests
description: Instructions on how to write Python unit tests to verify a Cortex data product's transformation logic, filters, and field mappings.
---

# Creating Python Unit Tests for a Data Product

When a new data product is created or updated, you **MUST** create a corresponding Python unit test using `pytest`. This test ensures that the compiled SQL query correctly implements the business logic, transformations, joins, and filtering criteria documented in the implementation plan.

---

## Workflow

### Step 1: Analyze the Implementation Plan and Code
1.  **Retrieve Assumptions & Transformations:** Read the implementation plan (from `/create-data-product`) to identify:
    *   Which source tables are joined (e.g., `KNA1` and `ADRC`).
    *   What filtering rules are applied (e.g., `mandt = '100'`, specific system versions).
    *   What columns are expected and how they are transformed (e.g., coalesced fields, calculations).
2.  **Locate Scaffolding Files:** Locate the custom data product's definition file (`src/data_modules/<namespace>/<source>/products/<type>/definitions/*.js`).
3.  **Leverage SAP & Domain Knowledge (CRITICAL):** Apply your technical understanding of SAP DDIC structures (e.g., how client-specific data is separated, document lines vs headers, translation checks) and the business domain (e.g., Order-to-Cash, Procure-to-Pay, General Ledger) to design meaningful assertions. If any transformations or business rules are complex, custom, or ambiguous, you **MUST** ask the user for clarifying inputs on how those requirements should be verified in the unit tests before writing the test file.

### Step 2: Scaffold the Test File
1.  **Test Location:** Create the test file under `tests/unit/<namespace>/` named `test_<type>.py`.
2.  **Template Reference:** Use the base test template in [test_template.py.md](assets/test_template.py.md) to structure the test file.

### Step 3: Implement Test Assertions
Write assertions to verify the following from the compiled query:
1.  **Join Logic Verification:** Parse the query to assert that the correct source tables are joined on the appropriate keys.
    *   *Example:* Verify that `KNA1` is joined with `ADRC` on `kunnr`.
2.  **Filter Logic Verification:** Assert that filtering constraints from the user profile or assumptions are present in the SQL.
    *   *Example:* Verify that `mandt = '100'` or `mandt = "100"` is enforced in the `WHERE` or `ON` clauses.
3.  **Field Transformations Verification:** Verify that specific aliased or transformed fields exist in the SELECT statement.
    *   *Example:* Verify that `COALESCE` is used on postal code fields or region fields.
4.  **Important Field Existence Verification:** Verify that key or important fields (like primary keys, key foreign relations, and required business dimensions) are actively selected and projected in the final SQL statement.
    *   *Example:* Verify that fields like `customer_number_kunnr` or `valid_from_date` are selected.
5.  **Custom Z-Fields Assertions:** If the data product maps custom SAP fields (Z-fields, ZZ-fields, or YY-fields), write explicit assertions to verify that these custom columns are correctly projected in the SELECT query and adhere to the snake_case description mapping convention (e.g., asserting that `'zz_'` or `'yy_'` matches are present).

### Step 4: Run the Unit Tests
1.  Compile the workspace first: `uv run cortex-build --config config/config.yaml`.
2.  Execute the unit tests using `pytest`. You **MUST** run the targeted test file for your custom data product to verify assertions quickly and efficiently:
    ```bash
    uv run pytest tests/unit/<namespace>/test_<type>.py -s
    ```
3.  **If any Test Fails:** Fix the query definitions, configs, or test assertions and recompile/retest until the targeted test passes cleanly.
4.  **Full Suite Verification (CRITICAL):** Once the targeted test passes, you **MUST** run the entire suite (`uv run pytest`) to ensure you haven't broken any other existing tests or core functionalities. ALL available unit tests must pass.

---

## 📊 Quality Gate Integration
Any Python unit tests created with this skill must be included in the **Final Quality Report** as part of the Quality Gate execution. Report the number of unit tests executed, passed, and failed.
