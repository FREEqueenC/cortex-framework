# Bill of Materials Data Product

This data product includes information about SAP bill of materials from the Production Planning (PP) module in the Manufacturing domain in SAP S/4HANA or SAP ECC. It provides a comprehensive and structured view of Bill of Materials (BOM) data, covering BOM headers, BOM items, and BOM item selections. This data product serves manufacturing analytics, production planning, inventory management, and cost roll-up calculations in SAP ERP environments.

## 1. Overview & Business Value

*   **Business Purpose:** Bill of Materials (BOM) is a critical master data component in Manufacturing and Supply Chain. It defines the hierarchical structure of assemblies, sub-assemblies, and components required to produce a finished product. This data product simplifies access to BOMs, enabling manufacturing audits, cost estimations, engineering change analysis, and material requirement planning (MRP).
*   **Key Metrics & Use Cases:**
    *   **Production Planning:** Analyzing BOM structures to determine component requirements.
    *   **Costing & Valuation:** Rolling up material costs from component levels to assemblies.
    *   **Engineering Change Management:** Auditing changes to BOMs over time using change numbers.

## 2. Data Assets Catalog

This data product exposes the following BigQuery data assets:

| Data Asset | Description | Source Systems |
| :--- | :--- | :--- |
| `bill_of_materials_headers` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP) module in the Manufacturing domain and provides BOM header details including validity dates, base quantities, and BOM status. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
| `bill_of_materials_items` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP) module in the Manufacturing domain and provides BOM item/component details, including component quantities, scrap percentages, and item categories. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
| `bill_of_materials_item_selections` | This view is based on SAP S/4HANA or SAP ECC Production Planning (PP) module in the Manufacturing domain and provides BOM item selection details mapping item nodes to alternative BOMs. The data is captured at the granularity of system default keys, ensuring a unique audit trail for every record. | `SAP ECC` / `SAP S/4HANA` |
## 3. Data Foundation & Source Tables

To build these assets, the following source tables must be available in the data foundation layer:

| Source Table | Name / Description | System Source | Used by Asset(s) |
| :--- | :--- | :--- | :--- |
| `stko` | BOM Header | `Common` | `bill_of_materials_headers` |
| `stpo` | BOM Item | `Common` | `bill_of_materials_items` |
| `stas` | BOMs - Item Selection | `Common` | `bill_of_materials_item_selections` |


## 4. Transformations & Design Decisions

This section details the critical engineering and design decisions behind the transformations.

### A. Granularity & Primary Keys

*   **`bill_of_materials_headers`**: One row per BOM header alternative. Primary Keys: `client_mandt`, `bom_category_stlty`, `bill_of_material_stlnr`, `alternative_bom_stlal`, `counter_stkoz`.
*   **`bill_of_materials_items`**: One row per BOM item node. Primary Keys: `client_mandt`, `bom_category_stlty`, `bill_of_material_stlnr`, `item_node_stlkn`, `counter_stpoz`.
*   **`bill_of_materials_item_selections`**: One row per BOM item selection. Primary Keys: `client_mandt`, `bom_category_stlty`, `bill_of_material_stlnr`, `alternative_bom_stlal`, `item_node_stlkn`, `counter_stasz`.

### B. Joins & Relationship Logic

*   All three assets are source-aligned master data assets. They map directly to their corresponding data foundation tables without complex joins.

### C. Incremental Load Strategy

*   **Supported Materialization Types:** `incremental`
*   **Incremental Logic:**
    *   **`bill_of_materials_headers`**: Delta updates are performed using `stko.recordstamp`.
    *   **`bill_of_materials_items`**: Delta updates are performed using `stpo.recordstamp`.
    *   **`bill_of_materials_item_selections`**: Delta updates are performed using `stas.recordstamp`.
    *   **Merge Policy:** `EXTEND` on schema change to allow seamless field additions.

### D. ERP Source System Differences (ECC vs. S/4HANA)

*   No schema differences between ECC and S/4HANA for these tables in the data foundation layer. Version-agnostic JS definitions are maintained directly under the `definitions/` folder.

### E. Field Conversions & Calculations

*   **Excluded Fields:** The `guid` field in `stpo` has been excluded as it is marked as "Temporarily not used" in the SAP metadata.

## 5. Change Log

| Date | Type of change | Change details |
| :--- | :--- | :--- |
| 30.06.2026 | Feature | Initial creation of the `bill_of_materials` data product with three assets: `bill_of_materials_headers`, `bill_of_materials_items`, and `bill_of_materials_item_selections`. |
