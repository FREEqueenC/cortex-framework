# Asset Documents Data Product

This data product includes information about SAP asset documents from the Financial Accounting (FI) module in the Finance domain in SAP S/4HANA or SAP ECC. The Asset Documents data product provides structured models for asset accounting, allowing enterprise analysis of asset transaction types, postings, and master data configurations. It serves as a foundational component for asset lifecycle tracking and financial reporting.

## 1. Overview & Business Value

*   **Business Purpose:** Enables auditing and classification of asset transactions by providing a clean, consolidated view of asset transaction types, their posting rules (e.g., capitalization, retirement, affiliate transfers), and their multi-language descriptions. It also provides detailed asset posting document headers and line items for ECC, and unified asset documents for S/4HANA, to support asset valuation, depreciation analysis, and audit trails.
*   **Key Metrics & Use Cases:**
    *   **Asset Transaction Classification:** Auditing transaction types used in postings.
    *   **Financial Sheet Reporting:** Mapping transaction types to asset history sheet groups.
    *   **Asset Posting Audit:** Reviewing individual asset acquisitions, retirements, and transfers.
    *   **Depreciation Analysis:** Analyzing ordinary, special, and unplanned depreciation postings.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `asset_transaction_types` | This view is based on SAP S/4HANA or SAP ECC Financial Accounting (FI) module in the Finance domain and provides Asset Transaction Types details the business transaction types used in asset accounting, including capitalization flags, retirement rules, and group mappings. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
| `asset_document_headers` | This view is based on SAP ECC Financial Accounting (FI) module in the Finance domain and provides Asset Document Headers (ECC) - Captures asset posting document header-level transaction metadata from SAP ANEK (such as company code, asset number, fiscal year, posting date, and entry time), enriched with calendar date dimensions to support asset transaction analysis. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` |
| `asset_document_items` | This view is based on SAP ECC Financial Accounting (FI) module in the Finance domain and provides Asset Document Line Items (ECC) - Captures asset posting document line item-level transaction metadata from SAP ANEP (such as depreciation area, transaction type, posted amount, ordinary depreciation, and interest), enriched with calendar date dimensions to support asset valuation and depreciation analysis. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` |
| `asset_documents` | This view is based on SAP S/4HANA Financial Accounting (FI) module in the Finance domain and provides Asset Documents (S/4HANA) - Captures asset posting ledger transactions from the SAP S/4HANA Universal Journal (ACDOCA) joined with BKPF (such as asset number, depreciation area, transaction type, posted amounts in local and transaction currencies, and document metadata), filtered by asset account type ('A') and enriched with calendar date dimensions. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP S/4HANA` |
| `asset_accounting_statistical_line_items` | This view is based on SAP S/4HANA Financial Accounting (FI) module in the Finance domain and provides Asset Accounting Statistical Line Items (S/4HANA) - Captures statistical line items for asset postings from the SAP S/4HANA FAAT_DOC_IT table, including asset number, depreciation area, transaction type, posted amounts in company code and global currencies, and document metadata, enriched with calendar date dimensions. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP S/4HANA` |
| `planned_depreciations_and_revaluations` | This view is based on SAP S/4HANA Financial Accounting (FI) module in the Finance domain and provides Planned Depreciations and Revaluations (S/4HANA) - Captures planned depreciation values and revaluations from the SAP S/4HANA FAAT_PLAN_VALUES table, including asset number, depreciation area, posting period, and planned amounts in company code and global currencies. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP S/4HANA` |
| `asset_annual_cumulative_balances` | This view is based on SAP S/4HANA or SAP ECC Financial Accounting (FI) module in the Finance domain and provides Asset Annual Cumulative Balances - Tracks cumulative asset values (APC, ordinary, special, and unplanned depreciation) along with expired useful life attributes by fiscal year and depreciation area. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `tabw` | Asset Transaction Types | `Common` | `asset_transaction_types` |
| `tabwh` | Asset Transaction Type Group Texts | `Common` | `asset_transaction_types` |
| `tabwt` | Asset Transaction Type Texts | `Common` | `asset_transaction_types` |
| `anek` | Asset Posting Document Header | `ECC` | `asset_document_headers` |
| `anep` | Asset Line Items | `ECC` | `asset_document_items` |
| `anlc` | Asset Value Record: Year | `ECC` | `asset_annual_cumulative_balances` |
| `bkpf` | Accounting Document Header | `S/4HANA` | `asset_documents` |
| `acdoca` | Universal Journal | `S/4HANA` | `asset_documents`, `asset_annual_cumulative_balances` |
| `faat_ydda` | Asset Values: Year-Dependent Data | `S/4HANA` | `asset_annual_cumulative_balances` |
| `faat_doc_it` | Asset Accounting: Statistical Line Items | `S/4HANA` | `asset_accounting_statistical_line_items` |
| `faat_plan_values` | Asset Values: Planned Values and Revaluations | `S/4HANA` | `planned_depreciations_and_revaluations` |

<!-- ERD_START -->
```mermaid
erDiagram
    "anek (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string lnran PK
    }
    "anep (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string lnran PK
        string afabe PK
    }
    "acdoca (Source)" {
        string rclnt PK
        string rbukrs PK
        string belnr PK
        string gjahr PK
        string buzei PK
    }
    "bkpf (Source)" {
        string mandt PK
        string bukrs PK
        string belnr PK
        string gjahr PK
    }
    "anlc (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string afabe PK
    }
    "faat_ydda (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string afabe PK
    }
    "faat_doc_it (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string awtyp PK
        string awref PK
        string aworg PK
        string awsys PK
        string subta PK
        string afabe PK
        string slalittype PK
        string drcrk PK
    }
    "faat_plan_values (Source)" {
        string mandt PK
        string bukrs PK
        string anln1 PK
        string anln2 PK
        string gjahr PK
        string afabe PK
        string poper PK
        string slalittype PK
    }
    "asset_document_headers (ECC)" {
        string client_mandt PK
        string company_code_bukrs PK
        string asset_number_anln1 PK
        string asset_subnumber_anln2 PK
        string fiscal_year_gjahr PK
        string sequence_number_lnran PK
    }
    "asset_document_items (ECC)" {
        string client_mandt PK
        string company_code_bukrs PK
        string asset_number_anln1 PK
        string asset_subnumber_anln2 PK
        string fiscal_year_gjahr PK
        string sequence_number_lnran PK
        string depreciation_area_afabe PK
    }
    "asset_documents (S/4HANA)" {
        string client_mandt PK
        string company_code_bukrs PK
        string accounting_document_number_belnr PK
        string fiscal_year_gjahr PK
        string accounting_document_line_item_buzei PK
    }
    "asset_accounting_statistical_line_items (S/4HANA)" {
        string client_mandt PK
        string company_code_bukrs PK
        string asset_number_anln1 PK
        string asset_subnumber_anln2 PK
        string fiscal_year_gjahr PK
        string reference_procedure_awtyp PK
        string reference_document_awref PK
        string reference_org_unit_aworg PK
        string logical_system_source_awsys PK
        string sub_transaction_subta PK
        string depreciation_area_afabe PK
        string sla_line_item_type_slalittype PK
        string debit_credit_indicator_drcrk PK
    }
    "planned_depreciations_and_revaluations (S/4HANA)" {
        string client_mandt PK
        string company_code_bukrs PK
        string asset_number_anln1 PK
        string asset_subnumber_anln2 PK
        string fiscal_year_gjahr PK
        string depreciation_area_afabe PK
        string poper PK
        string sla_line_item_type_slalittype PK
    }
    "asset_annual_cumulative_balances (ECC/S4)" {
        string client_mandt PK
        string company_code_bukrs PK
        string asset_number_anln1 PK
        string asset_subnumber_anln2 PK
        string depreciation_area_afabe PK
        string fiscal_year_gjahr PK
    }

    "anek (Source)" ||--|| "asset_document_headers (ECC)" : "projects to"
    "anep (Source)" ||--|| "asset_document_items (ECC)" : "projects to"
    "acdoca (Source)" ||--|| "asset_documents (S/4HANA)" : "projects to"
    "bkpf (Source)" ||--o| "asset_documents (S/4HANA)" : "joins to"
    "anlc (Source)" ||--|| "asset_annual_cumulative_balances (ECC/S4)" : "projects to"
    "faat_ydda (Source)" ||--|| "asset_annual_cumulative_balances (ECC/S4)" : "projects to"
    "acdoca (Source)" ||--o{ "asset_annual_cumulative_balances (ECC/S4)" : "aggregates to"
    "faat_doc_it (Source)" ||--|| "asset_accounting_statistical_line_items (S/4HANA)" : "projects to"
    "faat_plan_values (Source)" ||--|| "planned_depreciations_and_revaluations (S/4HANA)" : "projects to"
}
```
<!-- ERD_END -->

## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

*   **`asset_transaction_types`**: The grain of this asset is one row per client, language, and transaction type. Row uniqueness is strictly enforced on `client_mandt`, `language_key_spras`, and `transaction_type_bwasl`.
*   **`asset_document_headers`**: One row per asset document header. Unique on `client_mandt`, `company_code_bukrs`, `asset_number_anln1`, `asset_subnumber_anln2`, `fiscal_year_gjahr`, and `sequence_number_lnran`.
*   **`asset_document_items`**: One row per asset document line item. Unique on `client_mandt`, `company_code_bukrs`, `asset_number_anln1`, `asset_subnumber_anln2`, `fiscal_year_gjahr`, `sequence_number_lnran`, and `depreciation_area_afabe`.
*   **`asset_documents`**: One row per asset ledger posting line item. Unique on `client_mandt`, `company_code_bukrs`, `accounting_document_number_belnr`, `fiscal_year_gjahr`, and `accounting_document_line_item_buzei`.
*   **`asset_accounting_statistical_line_items`**: One row per statistical line item. Unique on `client_mandt`, `company_code_bukrs`, `asset_number_anln1`, `asset_subnumber_anln2`, `fiscal_year_gjahr`, `reference_procedure_awtyp`, `reference_document_awref`, `reference_org_unit_aworg`, `logical_system_source_awsys`, `sub_transaction_subta`, `depreciation_area_afabe`, `sla_line_item_type_slalittype`, and `debit_credit_indicator_drcrk`.
*   **`planned_depreciations_and_revaluations`**: One row per planned value/revaluation. Unique on `client_mandt`, `company_code_bukrs`, `asset_number_anln1`, `asset_subnumber_anln2`, `fiscal_year_gjahr`, `depreciation_area_afabe`, `posting_period_poper`, and `sla_line_item_type_slalittype`.
*   **`asset_annual_cumulative_balances`**: One row per asset annual cumulative balance. Unique on `client_mandt`, `company_code_bukrs`, `asset_number_anln1`, `asset_subnumber_anln2`, `depreciation_area_afabe`, and `fiscal_year_gjahr`.

### B. Joins & Relationship Logic

*   **`asset_transaction_types`**:
    *   Joined `tabw` with `tabwt` on client (`mandt`) and transaction type (`bwasl`) to retrieve transaction type names.
    *   Joined `tabw` with `tabwh` on client (`mandt`), transaction type group (`bwagrp`), and language (`spras` matching `tabwt.spras`) to retrieve group names.
    *   *Rationale:* LEFT JOINs are used to preserve all transaction types even if texts are not maintained in specific languages.
*   **`asset_document_items`**:
    *   Joined `anep` with `t001` on client and company code to retrieve the local currency key (`waers`) for currency decimal shifting.
*   **`asset_documents`**:
    *   Joined `acdoca` with `bkpf` on client (`rclnt`/`mandt`), company code (`rbukrs`/`bukrs`), document number (`belnr`), and fiscal year (`gjahr`) to retrieve header fields (such as document date, posting date, entry time, and user).
    *   Joined with `currency_decimal` on local currency key (`rhcur`) and transaction currency key (`rwcur`) to apply decimal shifting.
*   **`asset_annual_cumulative_balances`**:
    *   *ECC:* No joins; uses `anlc` directly.
    *   *S/4HANA:* Left-joins `faat_ydda` (Year-Dependent Data) with annual movements aggregated from `acdoca` (Universal Journal line items) to compute cumulative balances over years.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   **`asset_transaction_types`**: Delta updates are performed using a `GREATEST` recordstamp comparison between `tabw.recordstamp`, `tabwt.recordstamp`, and `tabwh.recordstamp` (defaulting null values to `1900-01-01 00:00:00+00`).
    *   **`asset_document_headers`**: Incremental updates based on `anek.recordstamp`.
    *   **`asset_document_items`**: Incremental updates based on `anep.recordstamp`.
    *   **`asset_documents`**: Incremental updates based on the `GREATEST` recordstamp of `acdoca.recordstamp` and `bkpf.recordstamp`.
    *   **`asset_accounting_statistical_line_items`**: Incremental updates based on `faat_doc_it.recordstamp`.
    *   **`planned_depreciations_and_revaluations`**: Incremental updates based on `faat_plan_values.recordstamp`.
    *   **`asset_annual_cumulative_balances`**:
        *   *ECC:* Incremental updates based on `anlc.recordstamp`.
        *   *S/4HANA:* In incremental mode, the query first identifies assets with new/updated records in `acdoca` or `faat_ydda` since the last load, and then recalculates the entire history for only those assets. This ensures correct cumulative sums.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   **`asset_transaction_types`**:
    *   *Comparison:* No schema differences exist for `TABW`, `TABWH`, or `TABWT` between ECC and S/4HANA.
*   **Asset Posting Documents**:
    *   *ECC Design:* Uses the traditional header/item table split where `ANEK` stores document headers and `ANEP` stores line items. The data assets `asset_document_headers` and `asset_document_items` are created specifically for ECC.
    *   *S/4HANA Design:* Uses the Universal Journal (`ACDOCA`) as the single source of truth for asset postings, eliminating the need for `ANEK` and `ANEP`. The unified data asset `asset_documents` is created for S/4HANA.
*   **`asset_annual_cumulative_balances`**:
    *   *ECC Design:* Source table is `ANLC`, which directly stores annual cumulative totals.
    *   *S/4HANA Design:* Source tables are `ACDOCA` (Universal Journal line items) and `FAAT_YDDA` (year-dependent asset attributes). Cumulative balances (APC, Ordinary Dep, Special Dep, Unplanned Dep) are calculated dynamically by aggregating transaction amounts.
    *   *Value Type Filters:* In S/4HANA, the value types are filtered using `SLALITTYPE` (Subledger-Specific Line Item Type) which are configurable via `table_settings.default.yaml` filters (`acquisition_and_production_costs`, `ordinary_depreciation`, `special_depreciation`, `unplanned_depreciation`).

### E. Field Conversions & Calculations

*   **Technical/Obsolete Fields:** Field `XCOPSP` ("Not used") has been excluded from `tabw` per project rules.
*   **Currency Decimal Shifting:** All currency amount fields (`anbtr`, `nafab`, `safab`, `zinsb` in `ANEP`, and `hsl`, `wsl` in `ACDOCA`) are shifted using the `currencyDecimalShift` utility.

---

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 02.07.2026 | Feature | Initial creation of the `asset_documents` data product, including `asset_transaction_types`, `asset_document_headers` (ECC), `asset_document_items` (ECC), `asset_documents` (S/4HANA), `asset_accounting_statistical_line_items` (S/4HANA), `planned_depreciations_and_revaluations` (S/4HANA), and `asset_annual_cumulative_balances` (ECC/S4). |
