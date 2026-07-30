# Cortex v6 Compatibility Layer

This data module provides schema-compatible views that mimic the structure, names, and schemas of older Cortex versions (specifically Cortex v6). It allows downstream consumption layers, such as legacy Looker dashboards or custom reporting scripts, to run seamlessly on top of a Cortex v7 deployment without requiring breaking changes to their queries.

---

## 1. Key Features
* Exposes the same reporting view names, columns, and casing as legacy Cortex v6.
* Isolates compatibility views from the main v7 tables using a dedicated target dataset.
* Supports both **SAP ECC** and **SAP S/4HANA** source systems automatically based on the underlying v7 data foundation.

---

## 2. Key Deployment Requirements

### A. Separate Target Dataset
The compatibility layer **must be deployed to a separate BigQuery dataset** from the first-party Cortex v7 core product. 
Many tables in the compatibility layer share identical physical names (e.g., `cost_centers`, `profit_centers`, `billing`, `deliveries`) with the v7 core tables. To avoid namespace shadowing and physical table collisions in BigQuery, you must map `cortex_v6_compatibility_target` to a unique dataset:

* **Example Target Mapping (`config.yaml`):**
```yaml
data:
  datasets:
    - id: product_target
      projectId: your-gcp-project
      datasetId: prod_sap_dataproducts # Core v7 tables
    - id: cortex_v6_compatibility_target
      projectId: your-gcp-project
      datasetId: prod_sap_cortex6 # Compatibility v6 tables
```

### B. Enable All Compatibility Modules Together
Because there are extensive cross-module dependencies within the compatibility layer (e.g., compatibility billing views depending on compatibility master data tables, and compatibility inventory snapshotting views depending on compatibility calendar dims), **all modules in the compatibility namespace must be enabled together**.
Do not attempt to deploy them selectively, as this will lead to compilation errors inside Dataform.

Ensure your configuration enables all of:
* `sap_cortex_v6_compatibility_master_data`
* `sap_cortex_v6_compatibility_accounts_payable`
* `sap_cortex_v6_compatibility_finance`
* `sap_cortex_v6_compatibility_inventory`
* `sap_cortex_v6_compatibility_purchasing`
* `sap_cortex_v6_compatibility_sales`

Refer to the production sample configuration files (e.g., `config.prod.s4.yaml` or `config.prod.ecc.yaml`) for reference implementations.

---

## 3. Configuration Example

Add the following to your deployment `config.yaml` file:

```yaml
data:
  datasets:
    - id: cortex_v6_compatibility_target
      projectId: your-gcp-project
      datasetId: your_compat_dataset_name

  namespaces:
    - name: cortex_v6_compatibility
      path: src/data_modules/cortex_v6_compatibility

  modules:
    products:
      - moduleId: sap_cortex_v6_compatibility_master_data
        modulePath: cortex_v6_compatibility.sap.products.master_data
        enabled: true
        dependencyBindings:
          sapModule: erp
        dataTargetId: cortex_v6_compatibility_target
        moduleSettings:
          targetCurrencies: ['USD']
          rateType: 'M'
          languages: ['E']

      - moduleId: sap_cortex_v6_compatibility_inventory
        modulePath: cortex_v6_compatibility.sap.products.inventory
        enabled: true
        dependencyBindings:
          sapModule: erp
        dataTargetId: cortex_v6_compatibility_target
        moduleSettings:
          targetCurrencies: ['USD']
          rateType: 'M'
```

---

## 4. Operational Requirements (Incremental Snapshots)

The weekly and monthly inventory snapshots (**`stock_weekly_snapshots`** and **`stock_monthly_snapshots`**) **must be configured and run as incremental tables**.

### Why Incremental is Required:
In Cortex v6, inventory snapshots calculate a running cumulative total of stock quantities and values.
1. **Initial Run**: The tables process the entire history of movement transactions to establish the starting stock levels.
2. **Subsequent Runs**: Dataform processes only the movements posted since the last snapshot execution, adding them to the previous period's cumulative totals.

If these tables are run in full-refresh (non-incremental) mode, they will recalculate the entire movement history from scratch on every run. This is highly inefficient, expensive, and can cause incorrect cumulative calculations if source tables contain date gaps.

Ensure that the materialization type for these tables remains `incremental` (which is the default configuration).
