# Material Batches Data Product

The `material_batches` data product serves as the consolidated repository for all SAP material batch management and inventory stock levels. It provides comprehensive visibility into batch master records at both the cross-plant (client) and plant levels, alongside real-time batch stock quantities at specific storage locations.

## 1. Overview & Business Value

The `material_batches` data product serves as the consolidated repository for all SAP material batch management and inventory stock levels. It provides comprehensive visibility into batch master records at both the cross-plant (client) and plant levels, alongside real-time batch stock quantities at specific storage locations.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `material_cross_plant_batches` | Central cross-plant registry for SAP material batches from MCH1, tracking universal batch details such as manufacturing and expiration dates, shelf life properties, supplier references, and batch status. | `SAP ECC` / `SAP S/4HANA` |
| `material_plant_batches` | Provides plant-level batch definitions and valuation settings from SAP MCHA, tracking plant-specific batch assignments, status keys, and manufacturing parameters. | `SAP ECC` / `SAP S/4HANA` |
| `material_batch_stocks` | Tracks physical batch stock quantities per plant and storage location from SAP MCHB, including unrestricted, blocked, in-transit, restricted, and returns stock volumes. | `SAP ECC` / `SAP S/4HANA` |

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    makt {
        string client_mandt PK
        string material_number_matnr PK
        string language_key_spras PK
    }
    material_batch_stocks {
        string client_mandt PK
        string material_number_matnr PK
        string plant_werks PK
        string storage_location_lgort PK
        string batch_number_charg PK
        string language_key_spras PK
    }
    material_cross_plant_batches {
        string client_mandt PK
        string material_number_matnr PK
        string batch_number_charg PK
        string language_key_spras PK
    }
    material_plant_batches {
        string client_mandt PK
        string material_number_matnr PK
        string plant_werks PK
        string batch_number_charg PK
        string language_key_spras PK
    }
    mch1 {
        string client_mandt PK
        string material_number_matnr PK
        string batch_number_charg PK
    }
    mcha {
        string client_mandt PK
        string material_number_matnr PK
        string plant_werks PK
        string batch_number_charg PK
    }
    mchb {
        string client_mandt PK
        string material_number_matnr PK
        string plant_werks PK
        string storage_location_lgort PK
        string batch_number_charg PK
    }
    t001w {
        string client_mandt PK
        string plant_werks PK
    }

    material_cross_plant_batches ||--o{ material_plant_batches : "client, material, batch, language"
    material_plant_batches ||--o{ material_batch_stocks : "client, material, plant, batch, language"
    mch1 ||--|| material_cross_plant_batches : "source"
    mcha ||--|| material_plant_batches : "source"
    mchb ||--|| material_batch_stocks : "source"
    makt ||--o{ material_cross_plant_batches : "joins description on material/language"
    makt ||--o{ material_plant_batches : "joins description on material/language"
    makt ||--o{ material_batch_stocks : "joins description on material/language"
    t001w ||--o{ material_plant_batches : "joins plant name"
    t001w ||--o{ material_batch_stocks : "joins plant name"
```

## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `mch1` | Operational source table for cross-plant batches. | `Common` | `material_cross_plant_batches` |
| `mcha` | Operational source table for plant batches. | `Common` | `material_plant_batches` |
| `mchb` | Operational source table for batch stocks. | `Common` | `material_batch_stocks` |
| `makt` | Operational source table for material descriptions. | `Common` | `material_cross_plant_batches`, `material_plant_batches`, `material_batch_stocks` |
| `t001w` | Operational source table for plants. | `Common` | `material_plant_batches`, `material_batch_stocks` |

## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

* **material_cross_plant_batches:** Client (`client_mandt`), Material (`material_number_matnr`), Batch (`batch_number_charg`), and Language (`language_key_spras`).
* **material_plant_batches:** Client (`client_mandt`), Material (`material_number_matnr`), Plant (`plant_werks`), Batch (`batch_number_charg`), and Language (`language_key_spras`).
* **material_batch_stocks:** Client (`client_mandt`), Material (`material_number_matnr`), Plant (`plant_werks`), Storage Location (`storage_location_lgort`), Batch (`batch_number_charg`), and Language (`language_key_spras`).

### B. Joins & Relationship Logic

* **material_cross_plant_batches:** Joins left with `makt` on `mandt`, `matnr`, and `spras` to resolve material descriptions.
* **material_plant_batches:** Joins left with `makt` on `mandt`, `matnr`, and `spras` to resolve material descriptions, and left with `t001w` on `mandt` and `werks` to resolve plant name.
* **material_batch_stocks:** Joins left with `makt` on `mandt`, `matnr`, and `spras` to resolve material descriptions, and left with `t001w` on `mandt` and `werks` to resolve plant name.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
* **material_cross_plant_batches:** Incremental updates are tracked using `mch1.recordstamp`.
* **material_plant_batches:** Incremental updates are tracked using `mcha.recordstamp`.
* **material_batch_stocks:** Incremental updates are tracked using `mchb.recordstamp`.

### D. ERP Source System Differences (ECC vs. S/4HANA)

* **material_cross_plant_batches:** S/4HANA includes extended fields like global unique `batch_id` and single unit batch indicators. Separate definitions are maintained under `ecc` and `s4` folders.
* **material_plant_batches:** S/4HANA includes extended fields. Separate definitions are maintained under `ecc` and `s4` folders.
* **material_batch_stocks:** Unified model, no structural differences.

### E. Field Conversions & Calculations

*   **Currency & Conversions:** Standardized using built-in currency shift logic for currencies with non-standard decimal formats (e.g. JPY, IDR).
*   **Field Selections:** Enriched with operational data and standard language text mappings where applicable.

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 24.06.2026 | Release | Release candidate validation completed. |
