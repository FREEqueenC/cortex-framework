/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ___MODULE_CONTEXT___
// ___TABLE_CONFIG___

const moduleConfig = config.product[moduleContext.moduleId];
const materializationType = tableConfig.materializationType || "incremental";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "language_key_spras",
    "product_hierarchy_l1_prodh1",
    "product_hierarchy_l2_prodh2",
    "product_hierarchy_l3_prodh3",
    "product_hierarchy_l4_prodh4",
    "product_hierarchy_l5_prodh5",
    "product_hierarchy_l6_prodh6",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH h1 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l1_prodh1,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l1_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '1'
),

h2 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l2_prodh2,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l2_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '2'
),

h3 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l3_prodh3,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l3_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '3'
),

h4 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l4_prodh4,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l4_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '4'
),

h5 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l5_prodh5,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l5_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '5'
),

h6 AS (
  SELECT
    t179.mandt AS client_mandt,
    t179.prodh AS product_hierarchy_l6_prodh6,
    t179t.spras AS language_key_spras,
    t179t.vtext AS description_l6_vtext,
    GREATEST(
      IFNULL(t179.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(t179t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS recordstamp
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
  INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
    ON t179.mandt = t179t.mandt
    AND t179.prodh = t179t.prodh
  WHERE t179.stufe = '6'
)

SELECT
  h1.client_mandt,
  h1.language_key_spras,
  h1.product_hierarchy_l1_prodh1,
  h1.description_l1_vtext,
  h2.product_hierarchy_l2_prodh2,
  h2.description_l2_vtext,
  h3.product_hierarchy_l3_prodh3,
  h3.description_l3_vtext,
  h4.product_hierarchy_l4_prodh4,
  h4.description_l4_vtext,
  h5.product_hierarchy_l5_prodh5,
  h5.description_l5_vtext,
  h6.product_hierarchy_l6_prodh6,
  h6.description_l6_vtext,
  GREATEST(
    IFNULL(h1.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(h2.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(h3.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(h4.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(h5.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(h6.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM h1
LEFT JOIN h2
  ON h1.client_mandt = h2.client_mandt
  AND h1.language_key_spras = h2.language_key_spras
  AND STARTS_WITH(h2.product_hierarchy_l2_prodh2, h1.product_hierarchy_l1_prodh1)
LEFT JOIN h3
  ON h2.client_mandt = h3.client_mandt
  AND h2.language_key_spras = h3.language_key_spras
  AND STARTS_WITH(h3.product_hierarchy_l3_prodh3, h2.product_hierarchy_l2_prodh2)
LEFT JOIN h4
  ON h3.client_mandt = h4.client_mandt
  AND h3.language_key_spras = h4.language_key_spras
  AND STARTS_WITH(h4.product_hierarchy_l4_prodh4, h3.product_hierarchy_l3_prodh3)
LEFT JOIN h5
  ON h4.client_mandt = h5.client_mandt
  AND h4.language_key_spras = h5.language_key_spras
  AND STARTS_WITH(h5.product_hierarchy_l5_prodh5, h4.product_hierarchy_l4_prodh4)
LEFT JOIN h6
  ON h5.client_mandt = h6.client_mandt
  AND h5.language_key_spras = h6.language_key_spras
  AND STARTS_WITH(h6.product_hierarchy_l6_prodh6, h5.product_hierarchy_l5_prodh5)
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["h1", "h2", "h3", "h4", "h5", "h6"])
])}
`
);
