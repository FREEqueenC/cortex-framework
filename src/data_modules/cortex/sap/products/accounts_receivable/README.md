# Accounts Receivable Data Product

This data product includes information about SAP accounts receivable from the Financial Accounting (FI) module in the Finance domain in SAP S/4HANA or SAP ECC. It consolidates customer accounting transactions, open invoices, and cleared items into a standardized reporting layer. This empowers treasury teams and analytics platforms with insights into DSO (Days Sales Outstanding), aging analyses, and credit-risk modeling.

## 1. Overview & Business Value

*   **Business Purpose:** Consolidates customer accounting transactions, open invoices, and cleared items into a standardized reporting layer. This empowers treasury teams and analytics platforms with insights into DSO (Days Sales Outstanding), aging analyses, and credit-risk modeling.

*   **Key Metrics & Use Cases:**
    *   **Metric/Use Case 1:** Unified enterprise reporting and operational tracking.
    *   **Metric/Use Case 2:** High-fidelity analytics and AI-ready data ingestion.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `accounts_receivable` | This view is based on SAP S/4HANA Financial Accounting (FI) module in the Finance domain and provides a unified view of accounts receivable from the SAP S/4HANA universal ledger journal entries (ACDOCA, BKPF, BSEG), filtered by Customer account type to support DSO (Days Sales Outstanding) analysis, aging reporting, and credit-risk modeling. The data is captured at the granularity of Client (System), Company Code, Accounting Document Number, Fiscal Year, and Ledger G L Line Item, ensuring a unique audit trail for every record. | `SAP S/4HANA` |
| `customer_open_items` | This view is based on SAP ECC Financial Accounting (FI) module in the Finance domain and provides a detailed view of open customer transaction line items from SAP ECC (BSID) to support operational tracking and outstanding invoice analysis. The data is captured at the granularity of Client (System), Company Code, Customer Number, Accounting Document Number, Fiscal Year, and Document Line Item, ensuring a unique audit trail for every record. | `SAP ECC` |
| `customer_cleared_items` | This view is based on SAP ECC Financial Accounting (FI) module in the Finance domain and provides a detailed view of cleared customer transaction line items from SAP ECC (BSAD) to support historical reconciliation and customer payment auditing. The data is captured at the granularity of Client (System), Company Code, Customer Number, Accounting Document Number, Fiscal Year, and Document Line Item, ensuring a unique audit trail for every record. | `SAP ECC` |### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    accounts_receivable {
        string client_mandt PK
        string company_code_bukrs PK
        string accounting_document_number_belnr PK
        integer fiscal_year_gjahr PK
        string ledger_g_l_line_item_docln PK
    }
    customer_cleared_items {
        string client_mandt PK
        string company_code_bukrs PK
        string customer_number_kunnr PK
        string accounting_document_number_belnr PK
        integer fiscal_year_gjahr PK
        string document_line_item_buzei PK
    }
    customer_open_items {
        string client_mandt PK
        string company_code_bukrs PK
        string customer_number_kunnr PK
        string accounting_document_number_belnr PK
        integer fiscal_year_gjahr PK
        string document_line_item_buzei PK
    }
```

## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `bsid` | Operational source table. | `Common` | `customer_open_items` |
| `bsad` | Operational source table. | `Common` | `customer_cleared_items` |
| `acdoca` | Operational source table. | `Common` | `accounts_receivable` |
| `bkpf` | Operational source table. | `Common` | `accounts_receivable` |
| `bseg` | Operational source table. | `Common` | `accounts_receivable` |

## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

* `customer_open_items` (ECC): One record per customer transaction line item (defined by BSID primary keys).
* `customer_cleared_items` (ECC): One record per cleared customer transaction line item (defined by BSAD primary keys).
* `accounts_receivable` (S4): One record per customer accounting entry line item (filtered by KOART = 'D' from ACDOCA joined to BKPF).
* `customer_open_items` (ECC): `client_mandt`, `company_code_bukrs`, `customer_kunnr`, `sp_g_l_trans_type_umsks`, `special_g_l_ind_umskz`, `clearing_date_augdt`, `clearing_document_augbl`, `assignment_zuonr`, `fiscal_year_gjahr`, `document_number_belnr`, `line_item_buzei`.
* `customer_cleared_items` (ECC): Same as `customer_open_items`.
* `accounts_receivable` (S4): `client_rclnt`, `ledger_rldnr`, `company_code_rbukrs`, `fiscal_year_gjahr`, `document_number_belnr`, `line_item_docln`.

### B. Joins & Relationship Logic

* `accounts_receivable` (S4): `acdoca` is joined to `bkpf` on client (`rclnt`/`mandt`), company code (`rbukrs`/`bukrs`), fiscal year (`gjahr`), and document number (`belnr`) to filter for customer entries. Additionally, `acdoca` is left joined to `bseg` on client (`rclnt`/`mandt`), company code (`rbukrs`/`bukrs`), fiscal year (`gjahr`), document number (`belnr`), and line item (`buzei`) to enrich with operational subledger fields.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental` | `table` | `view`
*   **Incremental Logic:**
* `customer_open_items` (ECC): `incremental`
* `customer_cleared_items` (ECC): `incremental`
* `accounts_receivable` (S4): `incremental`
* `customer_open_items` (ECC): Filtered dynamically using `bsid.recordstamp` timestamp.
* `customer_cleared_items` (ECC): Filtered dynamically using `bsad.recordstamp` timestamp.
* `accounts_receivable` (S4): Filtered dynamically using `acdoca.recordstamp`, `bkpf.recordstamp`, or `bseg.recordstamp` timestamps.

### D. ERP Source System Differences (ECC vs. S/4HANA)

* `customer_open_items` (ECC) and `customer_cleared_items` (ECC) are legacy ECC transactional tables (`bsid`, `bsad`). In S4, they are combined into the unified journal table `acdoca`. We select customer specific entries (`koart = 'D'`) in S4 to represent similar accounts receivable records.
* **Field Selections:**
* `customer_open_items` (ECC): All operational fields from BSID.
* `customer_cleared_items` (ECC): All operational fields from BSAD.
* `accounts_receivable` (S4): All operational fields from ACDOCA joined to BKPF, and enriched with subledger-specific logistical fields (payment terms, blocks, dunning, etc.) from BSEG.

### E. Field Conversions & Calculations

*   **Currency & Conversions:** Standardized using built-in currency shift logic for currencies with non-standard decimal formats (e.g. JPY, IDR).
*   **Field Selections:** Enriched with operational data and standard language text mappings where applicable.

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 24.06.2026 | Release | Release candidate validation completed. |
