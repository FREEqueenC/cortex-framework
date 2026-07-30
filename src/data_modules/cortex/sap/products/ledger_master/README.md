# Ledger Master Data Product

This data product includes information about SAP ledger master from the Financial Accounting (FI) module in the Finance domain in SAP S/4HANA or SAP ECC. The `ledger_master` data product provides a unified view of SAP Ledgers (from table `t881`) and their corresponding language-specific descriptions (from table `t881t`). It serves as a master data catalog for financial and general ledger reporting.

## 1. Overview & Business Value

*   **Business Purpose:** Provides a single, comprehensive, and consistent view of ledger master records across the business. Used to identify the currencies, ledger types, and configurations of different ledgers.
*   **Key Metrics & Use Cases:**
    *   **Master Data Auditing:** Auditing of ledger configurations and currency setups.
    *   **Financial Reporting Integration:** Supporting G/L account and financial statement reports with ledger names and details.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `ledger_master` | This view is based on SAP S/4HANA or SAP ECC Financial Accounting (FI) module in the Finance domain and provides Ledger Master details containing ledger characteristics and language-specific names The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `t881` | Ledger Master | `Common` | `ledger_master` |
| `t881t` | FI-SL Ledger text | `Common` | `ledger_master` |

## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

*   **`ledger_master`**: The grain of this asset is one row per ledger and language. Row uniqueness is strictly enforced on `client_mandt`, `ledger_rldnr`, and `language_key_langu`.

### B. Joins & Relationship Logic

*   **`ledger_master`**:
    *   Joined `t881` with `t881t` on `t881.mandt = t881t.mandt` and `t881.rldnr = t881t.rldnr`.
    *   *Rationale:* A LEFT JOIN is used to retain all ledger records from `t881` even if their corresponding description in `t881t` is not maintained.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   **`ledger_master`**: Delta updates are performed using the GREATEST of `t881.recordstamp` and `t881t.recordstamp` comparison.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   **`ledger_master`**:
    *   *Comparison:* No schema differences identified. The same fields are used for both ECC and S/4HANA.

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 30.06.2026 | Feature | Initial creation of the `ledger_master` data product. |
