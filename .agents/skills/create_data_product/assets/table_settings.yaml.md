# table_settings.default.yaml Template

```yaml
ecc:
  <table_name_1>:
    materializationType: incremental
    dataformTags: [sap, dataproduct, transactional] # or masterdata
    bigQueryLabels:
    - key: line_of_business
      value: <line_of_business>
    - key: sap_module
      value: <sap_module>
    # Optional advanced BigQuery configurations:
    clusterDetails:
      columns: [<ClusterColumn1>, <ClusterColumn2>]
    partitionDetails:
      column: <PartitionDateColumn>
      partitionType: DATE
      timeGrain: MONTH
s4:
  <table_name_1>:
    materializationType: incremental
    dataformTags: [sap, source_aligned_product, transactional] # or masterdata
    bigQueryLabels:
    - key: line_of_business
      value: <line_of_business>
    - key: sap_module
      value: <sap_module>
    # Optional advanced BigQuery configurations:
    clusterDetails:
      columns: [<ClusterColumn1>, <ClusterColumn2>]
    partitionDetails:
      column: <PartitionDateColumn>
      partitionType: DATE
      timeGrain: MONTH
```
