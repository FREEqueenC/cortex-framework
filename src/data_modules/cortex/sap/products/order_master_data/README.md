# Order Master Data Data Product

This data product includes information about SAP order master data from the Production Planning (PP), Controlling (CO) module in the Manufacturing, Finance domain in SAP S/4HANA or SAP ECC. The Order Master Data data product provides structured analytical datasets for order-level master data records in SAP systems. It exposes conformed master data details, facilitating operational reporting and tracking order attributes across SAP ECC and S/4HANA systems.

## 1. Overview & Business Value

*   **Business Purpose:** Enriches and normalizes the central order header status, class, hierarchy, and currency-adjusted planning parameters.
*   **Key Metrics & Use Cases:**
    *   **Order Master Reporting:** Evaluating entered dates, changing user activities, responsible cost centers, and associated profit centers.
    *   **Cost & Variant Profiling:** Reviewing estimated costs (`user4`) and tracking variations/classes.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `order_master_data` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP), Controlling (CO) module in the Manufacturing, Finance domain and provides Enriched master records for all SAP system orders The data is captured at the granularity of Client (System) and Order Number, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |## 3. Data Foundation & Source Tables

To build this asset, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `aufk` | Order Master Data | `Common` | `order_master_data` |
| `tcurx` | Decimal Places for Currency Codes | `Common` | `order_master_data` |

## 4. Transformations & Design Decisions

### A. Granularity & Primary Keys

*   **`order_master_data`**: The grain of this asset is one row per order. Key fields: `client_mandt`, `order_number_aufnr`.

### B. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   Delta updates are performed using the `recordstamp` column of the underlying foundation tables.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### C. Field Conversions & Calculations

*   **Decimal Shifts (Currency):** Uses `currencyDecimalShift` helper joined to `tcurx` to adjust decimal representation of estimated costs (`aufk.user4`).
