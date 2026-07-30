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
    "material_matnr",
    "plant_werks",
    "batch_charg",
    "special_stock_indicator_sobkz",
    "vendor_lifnr",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mslb.mandt AS client_mandt,
  mslb.matnr AS material_matnr,
  mslb.werks AS plant_werks,
  mslb.charg AS batch_charg,
  mslb.sobkz AS special_stock_indicator_sobkz,
  mslb.lifnr AS vendor_lifnr,
  t148t.spras AS language_key_spras,
  t148t.sotxt AS special_stock_description_sotxt,
  mslb.lfgja AS fiscal_year_current_period_lfgja,
  mslb.lfmon AS current_period_lfmon,
  mslb.lbspr AS physical_inventory_blocking_indicator_lbspr,
  mslb.lblab AS unrestricted_stock_lblab,
  mslb.lbins AS stock_in_quality_inspection_lbins,
  mslb.lbvla AS unrestricted_stock_previous_period_lbvla,
  mslb.lbvin AS stock_in_quality_inspection_previous_period_lbvin,
  mslb.lbill AS unrestricted_stock_current_year_lbill,
  mslb.lbilq AS stock_in_quality_inspection_current_year_lbilq,
  mslb.lbvll AS unrestricted_stock_previous_year_lbvll,
  mslb.lbvlq AS stock_in_quality_inspection_previous_year_lbvlq,
  mslb.lbfll AS unrestricted_stock_following_year_lbfll,
  mslb.lbflq AS stock_in_quality_inspection_following_year_lbflq,
  mslb.lbdll AS date_of_last_physical_inventory_count_lbdll,
  mslb.lbein AS restricted_use_stock_lbein,
  mslb.lbvei AS restricted_use_stock_previous_period_lbvei,
  mslb.ersda AS created_on_ersda,
  mslb.lbjin AS fiscal_year_current_physical_inventory_indicator_lbjin,
  mslb.lbrue AS mslb_lbrue,
  mslb.lbuml AS stock_in_transfer_lbuml,
  mslb.sgt_scat AS stock_segment_sgt_scat,
  GREATEST(
    IFNULL(mslb.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t148t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mslb")} AS mslb
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t148t")} AS t148t
  ON mslb.mandt = t148t.mandt
  AND mslb.sobkz = t148t.sobkz
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mslb", "t148t"])
])}
`
);
