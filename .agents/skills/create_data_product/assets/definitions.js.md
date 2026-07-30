# definitions.js Template Snippets

## Placeholders & Config
```javascript
// ___MODULE_CONTEXT___
// ___TABLE_CONFIG___

const moduleConfig = config.product[moduleContext.moduleId];
```

## Source References (`ctx.ref`)
Always extract the dataset from `sapModule.datasetId` when referencing source tables natively (note that `sapModule` is the local dependency key that is defined in the manifest):
```javascript
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbak")} AS vbak
```

## System Fields & Incremental Logic
**Single Table Logic:**
```javascript
IFNULL(
  Table1.recordstamp,
  TIMESTAMP('1900-01-01 00:00:00+00')
) AS source_last_updated_at,
CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ...
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["Table1"])
])}
```

**Multi-Table Logic:** 
*(Use `GREATEST` to protect against NULLs if left joined records are missing)*
```javascript
GREATEST(
  IFNULL(Table1.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
  IFNULL(Table2.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
) AS source_last_updated_at,
CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ...
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["Table1", "Table2"])
])}
```

## Publish Settings
Recommended standard approach using the reusable core `publish_config` helper:
```javascript
const publish_config = require("includes/cortex/publish_config.js");

const materializationType = tableConfig.materializationType || "incremental";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    // ⚠️ CRITICAL: List primary key columns here to ensure UPSERTs work correctly and prevent duplicates.
    // - Single Table: Use the primary keys of the source table (e.g., "client_mandt", "document_number_vbeln").
    // - Multiple Tables: Consult the user to identify the primary key(s) or the grain of the resulting row.
    "client_mandt",
    "unique_key_field"
  ]
);

publish("table_name_snake_case", publishConfig).query(
  (ctx) => `
    ...
  `
);
```

Alternatively, if manual configuration is required for custom, non-standard parameters:
```javascript
const materializationType = tableConfig.materializationType || "incremental";

const publishConfig = {
  type: materializationType,
  database: moduleConfig.targetProjectId,
  schema: moduleConfig.targetDatasetId,
  tags: tableConfig.tags
};

// If materialization is incremental, configure the MERGE logic parameters
if (materializationType === "incremental") {
  publishConfig.onSchemaChange = "EXTEND";
  publishConfig.uniqueKey = [
    "client_mandt",
    "unique_key_field"
  ];
}

// Pass along optional bigquery configs (e.g. partitionBy, clusterBy) if applicable
if ((materializationType === "incremental" || materializationType === "table") && tableConfig.bigquery) {
  publishConfig.bigquery = tableConfig.bigquery;
}

publish('table_name_snake_case', publishConfig).query(
  (ctx) => `
    ...
  `
);
```

## Currencies & Decimal Shift (If Applicable)
```javascript
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
...
${currency.amountWithDecimalShift("Table1.netwr", "currency_decimal")} AS net_value_netwr,
...
LEFT JOIN currency_decimal
  ON Table1.waerk = currency_decimal.currkey
```

## Date Dimensions Join (If Applicable)
```javascript
WITH date_dimension AS (
  ${date.getDateDimension()}
)
...
LEFT JOIN date_dimension AS dimensional_date_aedat
  ON Table1.aedat = dimensional_date_aedat.date
```
