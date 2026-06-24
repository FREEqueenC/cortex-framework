# Agency Settlement Documents Data Product

The Agency Settlement Documents data product provides analytics-ready models for agency business and settlement document headers and items from SAP ERP (WBRK/WBRP). It supports sales rebate tracking, commission settlement analytics, and third-party purchasing/sales flow reporting.

## 1. Overview & Business Value

*   **Business Purpose:** Captures header and line-item agency settlement transaction records across SAP ECC and S/4HANA systems. It tracks incremental updates via recordstamps and provides structured data for settlement financial reconciliation.
*   **Key Metrics & Use Cases:**
    *   **Rebate & Commission Analytics:** Vendor and customer rebate settlements, broker commissions, and payment agency fees.
    *   **Document Flow Auditing:** Tracking settlement status, billing document types, and partner assignments.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `agency_settlement_document_headers` | Captures header-level agency business and settlement document metadata from SAP WBRK (e.g., partner details, posting status, and currency keys) to support rebate tracking and commission settlement analytics. | `SAP ECC` / `SAP S/4HANA` |
| `agency_settlement_document_items` | Captures line-item agency business and settlement document details from SAP WBRP (e.g., material numbers, quantities, pricing conditions, and net values) to support financial reconciliation and third-party purchase/sales flow reporting. | `SAP ECC` / `SAP S/4HANA` |

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    agency_settlement_document_headers {
        string client_mandt PK
        string agency_document_number_wbeln PK
    }
    agency_settlement_document_items {
        string client_mandt PK
        string agency_document_number_wbeln PK
        string item_number_mposnr PK
    }

    agency_settlement_document_headers ||--o{ agency_settlement_document_items : "joins"
```

## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `wbrk` | Agency Business: Document Header | `Common` | `agency_settlement_document_headers`, `agency_settlement_document_items` |
| `wbrp` | Agency Business: Document Item | `Common` | `agency_settlement_document_items` |

## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

*   **`agency_settlement_document_headers`**: Granularity is one row per agency document header. Primary keys are `client_mandt` and `agency_document_number_wbeln`.
*   **`agency_settlement_document_items`**: Granularity is one row per settlement line item. Primary keys are `client_mandt`, `agency_document_number_wbeln`, and `item_number_mposnr`.

### B. Joins & Relationship Logic

*   **`agency_settlement_document_headers`**: Sourced directly from `wbrk`.
*   **`agency_settlement_document_items`**: s4/ecc models join `wbrp` with `wbrk` on `client_mandt` and `agency_document_number_wbeln` to align header timestamps and partner context.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   **`agency_settlement_document_headers`**: Delta updates are performed using the `recordstamp` column on `wbrk`.
    *   **`agency_settlement_document_items`**: Delta updates track modifications using the `GREATEST` `recordstamp` comparison between `wbrp` and `wbrk`.
    *   **Merge Policy:** `EXTEND` on schema change.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   **`agency_settlement_document_headers` & `agency_settlement_document_items`**: Separate JS definitions are maintained in `ecc/` and `s4/` subdirectories to handle version-specific fields and status columns.

### E. Field Conversions & Calculations

*   **Monetary & Quantity Mappings:** Maps technical SAP settlement fields to standardized business naming conventions.

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 24.06.2026 | Release | Release candidate validation completed. |
