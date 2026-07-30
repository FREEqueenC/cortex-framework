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
  ["client_mandt", "valuation_area_bwkey"]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t001k.mandt AS client_mandt,
  t001k.bwkey AS valuation_area_bwkey,
  t001w.name1 AS plant_name_name1,
  t001k.bukrs AS company_code_bukrs,
  t001.butxt AS company_text_butxt,
  t001k.bwmod AS valuation_grouping_code_bwmod,
  t001k.xbkng AS negative_stocks_allowed_xbkng,
  t001k.mlbwa AS material_ledger_active_mlbwa,
  t001k.mlbwv AS material_ledger_active_compulsory_mlbwv,
  t001k.xvkbw AS sales_price_valuation_xvkbw,
  t001k.erklaerkom AS explanation_facility_for_material_ledger_active_erklaerkom,
  t001k.uprof AS retail_revaluation_profile_uprof,
  t001k.wbpro AS value_based_inventory_management_profile_wbpro,
  t001k.mlast AS material_price_determination_control_mlast,
  t001k.mlasv AS price_determination_is_binding_in_valuation_area_mlasv,
  t001k.bdifp AS stock_correction_tolerance_bdifp,
  t001k.xlbpd AS price_difference_posting_in_goods_receipt_for_subcontract_order_xlbpd,
  t001k.xewrx AS post_purchase_account_with_receipt_value_xewrx,
  t001k.x2fdo AS two_fi_documents_with_purchase_account_x2fdo,
  t001k.prsfr AS price_release_prsfr,
  t001k.mlccs AS actual_cost_component_split_active_mlccs,
  t001k.xefre AS delivery_costs_to_price_difference_account_xefre,
  t001k.efrej AS start_of_validity_period_for_delivery_costs_in_price_difference_account_efrej,
  GREATEST(
    IFNULL(t001k.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001w.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001k")} AS t001k
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001w")} AS t001w
  ON t001k.mandt = t001w.mandt
  AND t001k.bwkey = t001w.werks
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON t001k.mandt = t001.mandt
  AND t001k.bukrs = t001.bukrs
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t001k", "t001w", "t001"])
])}
`
);
