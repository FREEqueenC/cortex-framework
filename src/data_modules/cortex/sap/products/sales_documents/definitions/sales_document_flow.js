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
    "sales_order_vbelv",
    "sales_order_item_posnv",
    "delivery_vbelv",
    "delivery_item_posnv",
    "billing_vbeln",
    "billing_item_posnn"
  ]
);

const filters = tableConfig.filters || {};
const precedingCats = filters.preceding_document_categories || ['C'];
const deliveryCats = filters.delivery_document_categories || ['J', 'T'];
const billingCats = filters.billing_document_categories || ['M'];

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  SO.mandt AS client_mandt,
  SO.vbelv AS sales_order_vbelv,
  SO.posnv AS sales_order_item_posnv,
  Deliveries.vbelv AS delivery_vbelv,
  Deliveries.posnv AS delivery_item_posnv,
  Deliveries.vbeln AS billing_vbeln,
  Deliveries.posnn AS billing_item_posnn,
  SO.rfmng AS delivered_qty_rfmng,
  SO.meins AS delivered_uom_meins,
  Deliveries.rfmng AS billed_qty_rfmng,
  Deliveries.meins AS billed_uom_meins,
  Deliveries.rfwrt AS billed_value_rfwrt,
  Deliveries.waers AS billing_currency_waers,
  GREATEST(
    IFNULL(SO.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(Deliveries.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbfa")} AS SO
LEFT OUTER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbfa")} AS Deliveries
  ON
    SO.vbeln = Deliveries.vbelv
    AND SO.mandt = Deliveries.mandt
    AND SO.posnn = Deliveries.posnv
${sql_helper.buildDynamicWhere([
  `SO.vbtyp_v IN (${sql_helper.formatFilterArray(precedingCats)})`,
  `SO.vbtyp_n IN (${sql_helper.formatFilterArray(deliveryCats)})`,
  `Deliveries.vbtyp_n IN (${sql_helper.formatFilterArray(billingCats)})`,
  incremental.getFilter(ctx, ["SO", "Deliveries"])
])}
`,
);
