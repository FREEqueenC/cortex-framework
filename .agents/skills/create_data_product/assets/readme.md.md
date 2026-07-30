# <Data Product Name> Data Product

<A concise paragraph (2-3 sentences) summarizing the Data Product, the business domains it covers, and the overall benefit it provides to enterprise analytics and AI-ready use cases.>

## 1. Overview & Business Value

*   **Business Purpose:** <Describe the core business problem solved by this data product. E.g., "Provides a single, comprehensive, and consistent view of customer master records across the business." (Refer to business value or key stakeholders).>
*   **Key Metrics & Use Cases:**
    *   **<Metric/Use Case 1>:** <E.g., Customer relationship management, master data auditing, geo-analytics, or demand forecasting.>
    *   **<Metric/Use Case 2>:** <E.g., High-fidelity reporting and dashboard integration.>

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `<Asset Name>` |  | `SAP ECC` / `SAP S/4HANA` |
| ... | ... | ... |


## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `<table_name>` (e.g., `kna1`) | <E.g., Customer Master General Data> | `Common` / `ECC-only` / `S4-only` | `<Asset Name>` |
| ... | ... | ... | ... |


## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

*   **`<Asset Name>`**: The grain of this asset is `<describe grain, e.g., one row per vendor>`. Row uniqueness is strictly enforced on `<primary key columns>`.

### B. Joins & Relationship Logic

*   **`<Asset Name>`**:
    *   Joined `<table>` with `<table>` on `<join condition>`.
    *   *Rationale:* <E.g., "A LEFT JOIN is used to retain all records from the base table even if address records are missing.">
    *   *Gotchas & Filters:* <E.g., "Filtered by `date_to = '9999-12-31'` to ensure only active addresses are matched, avoiding row multiplication." or "Joined text tables require language key filtering to prevent duplication.">

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental` | `table` | `view`
*   **Incremental Logic:**
    *   **`<Asset Name>`**: Delta updates are performed using `<recordstamp column or GREATEST recordstamp comparison>`.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   **`<Asset Name>`**:
    *   *Comparison:* <E.g., "No schema differences" OR "S/4HANA features consolidated tables where status columns reside directly in the main table. Separate JS definitions are maintained in `ecc/` and `s4/` folders to handle this.">

### E. Field Conversions & Calculations

*   **Decimal Shifts (Currency):** <E.g., "Uses helper `currencyDecimalShift` joined to `tcurx` to adjust decimal representations of currency fields.">
*   **Fallbacks & Logic:** <E.g., "Postal code uses kna1.pstlz as a primary source and adrc.post_code1 as a fallback if kna1.pstlz is not maintained (using COALESCE(...))">


## 5. Unit Testing & Validation

Each data product includes dedicated unit tests to validate schema correctness, filters, and transformations.

*   **Test File:** `tests/unit/<namespace>/test_<type>.py`
*   **Key Validation Points:**
    1.  **Join keys integrity:** Ensures joins do not lead to row multiplication.
    2.  **Edge cases & Null values:** Validates `COALESCE` fallbacks and date default values.
    3.  **Target columns check:** Ensures both ECC and S/4HANA compile to standard target schemas.
*   **How to Run Tests:**
    ```shell
    pytest tests/unit/<namespace>/test_<type>.py
    ```


## 6. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 15.06.2026 | <Feature, Fix, Change, Known Issue, Deprecation> | <E.g., "Added `vendor_category` column to align with the updated MDM schema. Fixed `COALESCE` logic to handle null values in `dispatch_date`"> |

