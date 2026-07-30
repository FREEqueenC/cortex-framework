# Production Orders Data Product

This data product includes information about SAP production orders from the Production Planning (PP) module in the Manufacturing domain in SAP S/4HANA or SAP ECC. The Production Orders data product provides structured analytical datasets for manufacturing order management. It exposes conformed header details and item-level transactions, facilitating operational reporting, capacity planning, cost estimation, and stock movement analysis across both SAP ECC and S/4HANA systems.

## 1. Overview & Business Value

*   **Business Purpose:** Tracks manufacturing execution, scheduled operations, material requirements, and actual goods receipt values across the enterprise.
*   **Key Metrics & Use Cases:**
    *   **Operational Execution:** Monitoring start/finish dates, scrap ratios, and yield quantities.
    *   **Costing Analysis:** Analyzing planned vs. actual costs and estimated manufacturing expenses.
    *   **Inventory Reconciliation:** Tracking goods receipt value (`wewrt`) and quantity differences.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `production_order_header` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP) module in the Manufacturing domain and provides Scheduled dates, supervisor keys, quantities, and statuses of production orders The data is captured at the granularity of Client (System) and Order Number, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
| `production_order_item` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP) module in the Manufacturing domain and provides Item-level material numbers, plants, batch assignments, and goods receipt values The data is captured at the granularity of Client (System), Order Number, and Order Item Number, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `aufk` | Order Master Data | `Common` | `production_order_item` |
| `afko` | Production Order Header Data | `Common` | `production_order_header` |
| `afpo` | Production Order Item Data | `Common` | `production_order_item` |
| `tcurx` | Decimal Places for Currency Codes | `Common` | `production_order_item` |

## 4. Transformations & Design Decisions

### A. Granularity & Primary Keys

*   **`production_order_header`**: The grain is one row per production order. Key fields: `client_mandt`, `order_number_aufnr`.
*   **`production_order_item`**: The grain is one row per order item. Key fields: `client_mandt`, `order_number_aufnr`, `order_item_number_posnr`.

### B. Joins & Relationship Logic

*   **`production_order_item`**:
    *   Joined `afpo` with `aufk` on `mandt` and `aufnr` to retrieve the transaction currency key `waers`.
    *   Joined the resulting record with `tcurx` to calculate shifted goods receipt values.
    *   *Rationale:* `afpo` does not store the currency key column `waers` directly, so joining with the order record (`aufk`) is necessary to perform currency decimal adjustments.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   Delta updates are performed using the `recordstamp` column of the underlying foundation tables.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   **Unified Definitions:**
    *   Although S/4HANA raw tables contain additional fields (e.g., `EB_POST` in `aufk`, `TL_VERSN` in `afko`), these are minor. To simplify maintenance and avoid version-specific subfolders, only fields common to both ECC and S/4HANA are projected into the unified definitions directly under the main `definitions/` directory.

### E. Field Conversions & Calculations

*   **Decimal Shifts (Currency):** Uses `currencyDecimalShift` helper joined to `tcurx` to adjust decimal representation of goods received values (`afpo.wewrt`).

## 5. Unit Testing & Validation

Each data product includes dedicated unit tests to validate schema correctness, filters, and transformations.

*   **Test File:** `tests/unit/cortex/test_production_orders.py`
*   **Key Validation Points:**
    *   **Join keys integrity:** Ensures joins do not lead to row multiplication.
    *   **Currency Conversion:** Validates correct shifting of currency values based on `tcurx`.
*   **How to Run Tests:**
    ```shell
    pytest tests/unit/cortex/test_production_orders.py
    ```

## 6. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 2026-06-29 | Feature | Initial creation of the Production Orders data product. |
