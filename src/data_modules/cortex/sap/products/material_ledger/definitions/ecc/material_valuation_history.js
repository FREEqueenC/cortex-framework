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
    "valuation_type_bwtar",
    "fiscal_year_lfgja",
    "posting_period_lfmon"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
),
unioned_valuation AS (
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
    mbew.lbkum AS total_stock_lbkum,
    mbew.stprs,
    mbew.salk3,
    mbew.verpr,
    mbew.salkv,
    mbew.vksal,
    IFNULL(mbew.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS recordstamp,
    t001.waers AS currency_key_waers
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mbew")} AS mbew
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001k")} AS t001k
    ON mbew.mandt = t001k.mandt AND mbew.bwkey = t001k.bwkey
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
    ON t001k.mandt = t001.mandt AND t001k.bukrs = t001.bukrs
  ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["mbew"])
  ])}

  UNION ALL

  SELECT
    mbewh.mandt AS client_mandt,
    mbewh.matnr AS material_number_matnr,
    mbewh.bwkey AS valuation_area_bwkey,
    mbewh.bwtar AS valuation_type_bwtar,
    mbewh.lfgja AS fiscal_year_lfgja,
    mbewh.lfmon AS posting_period_lfmon,
    mbewh.peinh AS price_unit_peinh,
    mbewh.vprsv AS price_control_indicator_vprsv,
    mbewh.bklas AS valuation_class_bklas,
    mbewh.lbkum AS total_stock_lbkum,
    mbewh.stprs,
    mbewh.salk3,
    mbewh.verpr,
    mbewh.salkv,
    mbewh.vksal,
    IFNULL(mbewh.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS recordstamp,
    t001.waers AS currency_key_waers
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mbewh")} AS mbewh
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mbew")} AS mbew_check
    ON mbewh.mandt = mbew_check.mandt
    AND mbewh.matnr = mbew_check.matnr
    AND mbewh.bwkey = mbew_check.bwkey
    AND mbewh.bwtar = mbew_check.bwtar
    AND mbewh.lfgja = mbew_check.lfgja
    AND mbewh.lfmon = mbew_check.lfmon
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001k")} AS t001k
    ON mbewh.mandt = t001k.mandt AND mbewh.bwkey = t001k.bwkey
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
    ON t001k.mandt = t001.mandt AND t001k.bukrs = t001.bukrs
  ${sql_helper.buildDynamicWhere([
    "mbew_check.matnr IS NULL",
    incremental.getFilter(ctx, ["mbewh"])
  ])}
)
SELECT
  client_mandt,
  material_number_matnr,
  valuation_area_bwkey,
  valuation_type_bwtar,
  fiscal_year_lfgja,
  posting_period_lfmon,
  price_unit_peinh,
  price_control_indicator_vprsv,
  valuation_class_bklas,
  total_stock_lbkum,
  ${currency.amountWithDecimalShift("stprs", "currency_decimal")} AS standard_cost_stprs,
  ${currency.amountWithDecimalShift("salk3", "currency_decimal")} AS value_of_total_valuated_stock_salk3,
  ${currency.amountWithDecimalShift("verpr", "currency_decimal")} AS moving_average_price_verpr,
  ${currency.amountWithDecimalShift("salkv", "currency_decimal")} AS value_at_moving_average_price_salkv,
  ${currency.amountWithDecimalShift("vksal", "currency_decimal")} AS total_value_at_sales_price_vksal,
  currency_key_waers,
  IFNULL(recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM unioned_valuation
LEFT JOIN currency_decimal
  ON currency_key_waers = currency_decimal.currkey
`
);
