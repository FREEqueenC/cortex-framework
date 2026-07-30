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
const currency = require("includes/currency.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "material_number_matnr",
    "valuation_area_bwkey",
    "valuation_type_bwtar"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  mbew.mandt AS client_mandt,
  mbew.matnr AS material_number_matnr,
  mbew.bwkey AS valuation_area_bwkey,
  mbew.bwtar AS valuation_type_bwtar,
  mbew.lfgja AS fiscal_year_lfgja,
  mbew.lfmon AS posting_period_lfmon,
  mbew.peinh AS price_unit_peinh,
  mbew.vprsv AS price_control_indicator_vprsv,
  mbew.bklas AS valuation_class_bklas,
  mbew.bwtty AS valuation_category_bwtty,
  mbew.lvorm AS deletion_flag_valuation_type_lvorm,
  mbew.mlmaa AS material_ledger_active_mlmaa,
  mbew.mlast AS material_price_determination_control_mlast,
  mbew.hkmat AS material_origin_indicator_hkmat,
  mbew.xlifo AS lifo_fifo_relevant_indicator_xlifo,
  mbew.mypol AS lifo_pool_mypol,
  mbew.lbkum AS total_stock_lbkum,
  ${currency.amountWithDecimalShift("mbew.stprs", "currency_decimal")} AS standard_cost_stprs,
  ${currency.amountWithDecimalShift("mbew.salk3", "currency_decimal")} AS value_of_total_valuated_stock_salk3,
  ${currency.amountWithDecimalShift("mbew.verpr", "currency_decimal")} AS moving_average_price_verpr,
  ${currency.amountWithDecimalShift("mbew.salkv", "currency_decimal")} AS value_at_moving_average_price_salkv,
  ${currency.amountWithDecimalShift("mbew.vksal", "currency_decimal")} AS total_value_at_sales_price_vksal,
  ${currency.amountWithDecimalShift("mbew.stprv", "currency_decimal")} AS previous_price_stprv,
  ${currency.amountWithDecimalShift("mbew.zkprs", "currency_decimal")} AS future_price_zkprs,
  mbew.laepr AS date_of_last_price_change_laepr,
  mbew.zkdat AS future_price_valid_from_date_zkdat,
  ${currency.amountWithDecimalShift("mbew.zplpr", "currency_decimal")} AS future_planned_price_zplpr,
  ${currency.amountWithDecimalShift("mbew.zplp1", "currency_decimal")} AS planned_price_1_zplp1,
  mbew.zpld1 AS planned_price_date_1_zpld1,
  ${currency.amountWithDecimalShift("mbew.zplp2", "currency_decimal")} AS planned_price_2_zplp2,
  mbew.zpld2 AS planned_price_date_2_zpld2,
  ${currency.amountWithDecimalShift("mbew.zplp3", "currency_decimal")} AS planned_price_3_zplp3,
  mbew.zpld3 AS planned_price_date_3_zpld3,
  mbew.kaln1 AS product_cost_estimate_number_kaln1,
  mbew.kalnr AS cost_estimate_number_kalnr,
  mbew.eklas AS sales_order_stock_valuation_class_eklas,
  mbew.qklas AS project_stock_valuation_class_qklas,
  t001.waers AS currency_key_waers,
  IFNULL(mbew.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mbew")} AS mbew
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001k")} AS t001k
  ON mbew.mandt = t001k.mandt AND mbew.bwkey = t001k.bwkey
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON t001k.mandt = t001.mandt AND t001k.bukrs = t001.bukrs
LEFT JOIN currency_decimal
  ON t001.waers = currency_decimal.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mbew"])
])}
`
);
