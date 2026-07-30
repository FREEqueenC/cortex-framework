# Data Product Style Guide & Formatting Rules

## General Rules
*   **Naming:** All `.js` and `.yaml` files **MUST** be `snake_case`.
*   **JavaScript Naming:** JavaScript functions inside `.js` modules **MUST** be `camelCase`.
*   **Acronym Rules:** When handling acronyms, keep them together (e.g., `sap_erp`, NOT `sap_e_r_p`).
*   **Folder Structure Rule:**
    *   Place files directly in the `annotations/` and `definitions/` directories if they are identical for both ECC and S4.
    *   If there are differences between the source systems, you **MUST** create and use `ecc` and `s4` subfolders.
*   **Template Literals (CRITICAL AVOIDANCE RULE):** You MUST NOT escape the dollar sign `$`. NEVER write `\${ctx.ref(..., 'table')}` in your JS files. Writing `\${` explicitly breaks Dataform compilation because it produces a literal `\$` in the file instead of allowing Dataform to evaluate it. The correct format for `ctx.ref` inside `.query` must be EXACTLY `${ctx.ref(..., 'table')}`.
*   **Quality Check:** Run a critique loop on your JS code at least twice to ensure correctness.

## Field Mapping & Definitions
*   **Source Field Names:** Source table field names **MUST** be lower case in the definitions.
*   **Data Modeling Standards (CRITICAL):** All target columns, custom fields, special characters, and system field exclusions (such as `_dataaging`) **MUST** follow the centralized naming and mapping rules defined in the [Data Modeling Standards](../../data_modeling_standards/SKILL.md) guide.
*   **Source Verification:** NEVER assume a field exists. **MUST** verify existence in `src/data_modules/<namespace>/<source>/foundations/sap/annotations/`. Do not assume the presence of columns based on other tables or common knowledge.

## SQL Standards
*   **SQL Keywords:** SQL keywords **MUST** be `UPPERCASE`.
*   **Aliases & CTEs:** CTE names, CTE aliases, table aliases, and source table aliases **MUST** be `snake_case`.
*   **CTEs vs Subqueries:** CTEs **SHOULD** be preferred over nested subqueries for readability.

## Logic Configuration
*   **Data Modeling Standards (CRITICAL):** For all standard data patterns—such as currency decimal shifts, date dimension breakdowns, audit columns (`source_last_updated_at`, `bq_loaded_at`), incremental filtering, and validity timestamps—you **MUST** refer to and follow the [Data Modeling Standards](../../data_modeling_standards/SKILL.md) guide.
*   **Placeholders & Config (CRITICAL):** Insert placeholders `// ___MODULE_CONTEXT___` and `// ___TABLE_CONFIG___` exactly at the top of definition files. Always use `.sources`, NOT `.dependencies` when extracting module config source.
*   **Publish Settings (CRITICAL):** Target location and table type must be configured from `moduleConfig`. Data products should typically be incremental with `onSchemaChange: "EXTEND"` and define their primary keys in `uniqueKey`.

## Table Settings Configuration
*   **Configuration Rule (CRITICAL):** You MUST explicitly define tables under `ecc` and `s4` keys in `table_settings.default.yaml` (or `table_settings.yaml` if an explicit override is used). Do NOT use `common` in data product table settings, even if the tables are identical across ECC and S4.
*   **Tags & Optimization:**
    *   `tags` should accurately reflect the data and usage for example: `[sap, dataproduct, sales_orders]`.
    *   Include `clusterDetails` and `partitionDetails` for large tables to optimize BigQuery performance.
*   **Partitioning Guidance (`partitionDetails`):**
    *   **DATE**: Use for date fields. Valid `timeGrain` values: `DAY`, `MONTH`, `YEAR`.
    *   **DATETIME / TIMESTAMP**: Use for timestamp fields. Valid `timeGrain` values: `DAY`, `MONTH`, `YEAR`, `HOUR`.
    *   **INTEGER**: Use for integer ID fields. Must provide `rangeStart`, `rangeEnd`, and `rangeInterval` instead of `timeGrain`.
