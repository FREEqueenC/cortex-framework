---
name: data_modeling_standards
description: Reference guide for business rules, naming conventions, and data modeling standards enforced during data product development.
---

# Data Modeling Standards and Business Rules

This skill serves as the single source of truth for organizational standards, naming conventions, and repeating data modeling patterns within the Cortex Framework. All agents creating or modifying data products **MUST** consult this guide to ensure consistency, design integrity, and compliance across the workspace.

---

## 1. Column Naming Conventions (Traceability)

In Cortex, column names must provide both business readability and technical traceability back to the source system.

*   **Rule:** Target columns **MUST** be named in lowercase `snake_case`.
*   **Traceability Suffix:** Column names **MUST** end with the original SAP field name as a suffix (e.g., `_<sap_field_name>`).
*   **Examples:**
    *   `mandt` (Client) -> `client_mandt`
    *   `bukrs` (Company Code) -> `company_code_bukrs`
    *   `belnr` (Accounting Document Number) -> `document_number_belnr`
    *   `waers` (Currency Key) -> `currency_key_waers`

---

## 2. Currency Decimal Shifts

SAP stores currency amounts as integer/decimal values without decimals, shifting the actual values depending on the specific currency key (e.g., Japanese Yen JPY has 0 decimals, whereas USD has 2). We must adjust these amounts using the standard currency decimal shift configuration.

### Implementation Checklist
1.  **Require the Currency helper:**
    ```javascript
    const currency = require("includes/cortex/currency.js");
    ```
2.  **Define the `currency_decimal` CTE** at the top of the SQL query, passing the dataset reference for the replicated `tcurx` table:
    ```javascript
    WITH currency_decimal AS (
      ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
    )
    ```
3.  **Apply the decimal shift expression** to amount fields in the `SELECT` block:
    ```javascript
    ${currency.amountWithDecimalShift("bseg.dmbtr", "currency_decimal_hwaer")} AS amount_in_local_currency_dmbtr,
    ${currency.amountWithDecimalShift("bseg.wrbtr", "currency_decimal_waers")} AS amount_in_document_currency_wrbtr,
    ```
4.  **Join the `currency_decimal` CTE** in the `FROM` / `JOIN` section for each currency key:
    ```javascript
    LEFT JOIN currency_decimal AS currency_decimal_waers
      ON bkpf.waers = currency_decimal_waers.currkey
    LEFT JOIN currency_decimal AS currency_decimal_hwaer
      ON bkpf.hwaer = currency_decimal_hwaer.currkey
    ```

---

## 3. Date Dimension Joins and Attribute Breakdowns

To ensure consistent time-based reporting, every primary SAP date column (e.g., posting date, document date) is expanded into four additional temporal attributes: year, month, quarter, and week.

### Implementation Checklist
1.  **Require the Date helper:**
    ```javascript
    const date = require("includes/cortex/date.js");
    ```
2.  **Define the `date_dimension` CTE** at the top of the SQL query:
    ```javascript
    WITH date_dimension AS (
      ${date.getDateDimension()}
    )
    ```
3.  **Project the date breakdown fields** in the `SELECT` block for each relevant date:
    ```javascript
    // For posting_date_budat:
    dimensional_date_budat.cal_year AS year_of_posting_date_budat,
    dimensional_date_budat.cal_month AS month_of_posting_date_budat,
    dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
    dimensional_date_budat.cal_week AS week_of_posting_date_budat,
    ```
4.  **Join the `date_dimension` CTE** on the corresponding base date field:
    ```javascript
    LEFT JOIN date_dimension AS dimensional_date_budat
      ON bkpf.budat = dimensional_date_budat.date
    ```

---

## 4. Standard Audit & Metadata Columns

Every materialized data product table **MUST** contain standard audit fields to track data updates and synchronization.

*   `source_last_updated_at`: Calculated using `GREATEST` and `IFNULL` across the `recordstamp` columns of all source tables joined in the model. Use `TIMESTAMP('1900-01-01 00:00:00+00')` as the fallback default.
*   `bq_loaded_at`: Standard `CURRENT_TIMESTAMP()`.

### Implementation Checklist
1.  **Select the audit fields** at the end of the `SELECT` list:
    ```javascript
    GREATEST(
      IFNULL(bseg.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(bkpf.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS source_last_updated_at,
    CURRENT_TIMESTAMP() AS bq_loaded_at
    ```
2.  **Annotate the audit columns** in the companion `.yaml` annotations files:
    ```yaml
    - name: source_last_updated_at
      description: Source Last Updated At
    - name: bq_loaded_at
      description: BigQuery Loaded At
    ```

---

## 5. Dynamic Filtering and Incremental Materialization

To optimize query execution and BigQuery costs, tables are materialized incrementally using dynamic filtering.

### Implementation Checklist
1.  **Require the helpers:**
    ```javascript
    const incremental = require("includes/cortex/incremental.js");
    const sql_helper = require("includes/cortex/sql_helper.js");
    ```
2.  **Apply `buildDynamicWhere` and `getFilter`** at the end of the query:
    ```javascript
    ${sql_helper.buildDynamicWhere([
      incremental.getFilter(ctx, ["bseg", "bkpf"])
    ])}
    ```
    *Note: Pass the source table aliases to `getFilter()`. If a specific timestamp column is needed instead of `recordstamp`, include it explicitly.*

---

## 6. Parsing SAP Validity Timestamps

SAP uses 14-digit numeric values (YYYYMMDDHHMMSS) to represent validity start and end timestamps. These must be parsed into proper BigQuery `TIMESTAMP` types with standard fallbacks for missing or infinity dates.

### Implementation Checklist
1.  **Require the SQL helper:**
    ```javascript
    const sql_helper = require("includes/cortex/sql_helper.js");
    ```
2.  **Call the validity parser helpers** in the `SELECT` list:
    ```javascript
    ${sql_helper.parseValidityFromTimestamp("but0bk.bk_valid_from")} AS valid_from,
    ${sql_helper.parseValidityToTimestamp("but0bk.bk_valid_to")} AS valid_to,
    ```
    *Note:*
    *   `parseValidityFromTimestamp` defaults `0` or null values to `TIMESTAMP('1900-01-01 00:00:00+00')`.
    *   `parseValidityToTimestamp` defaults `0`, null, or `99991231235959` values to `TIMESTAMP('9999-12-31 23:59:59+00')`.

---

## 7. SAP Specific Data Handling and Exclusions

### 1. Custom SAP Fields (Z-fields, ZZ-fields, YY-fields)
Custom fields prefixed with `ZZ` or `YY` (e.g., `ZZ_REG_CD`, `YY_LOCTN`) **MUST** be mapped and preserved if they exist in the replication raw schema or are specified in user requirements. They must follow the standard naming convention: `snake_case_description_originalfieldname` (e.g., `custom_region_code_zz_reg_cd`, `custom_location_yy_loctn`).

### 2. Special Characters in SAP Field Names
If a source field contains SAP namespaces or special characters like `/` (e.g., `/BEV1/LULEINH`), you **MUST** replace `/` with `_` when mapping it, while preserving the standard naming suffix rule (e.g., `description__bev1_luleinh`).

### 3. SAP Dummy Dates & Date Nullability
SAP uses dummy date strings (like `'00000000'`) to represent blank/missing dates. When querying or filtering date columns, always compare against standard SQL `NULL` or map to `NULL` (e.g., `NULLIF(field, '00000000')`). Never use raw `'00000000'` comparisons as it causes runtime casting errors when fields are mapped as BigQuery `DATE` type. Use standard SQL `IS [NOT] NULL` for checking date values.

### 4. Excluded System Fields (`_dataaging`)
Most SAP S/4HANA raw tables contain an internal system field called `_dataaging` (not present in ECC). This field is used internally by SAP S/4HANA for data aging partitions and is explicitly **out of scope for Cortex**. You **MUST EXCLUDE** `_dataaging` (or `_DATAAGING`) from all `.js` definitions and `.yaml` annotations.
