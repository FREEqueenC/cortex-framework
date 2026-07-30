# manifest.yaml Template

```yaml
displayName: <DisplayName>
description: <Description of the data product>
category: source_aligned_product # or consumption_product
type: <type> # e.g., sales_orders
dependencies:
  sapModule:
    modulePath: cortex.sap.foundations.sap
    supportedVersions:
      - ecc
      - s4
    tables:
      common:
        - <table_name_1>
        - <table_name_2>
builder: sap_product

```
