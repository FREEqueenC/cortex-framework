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
const date = require("includes/date.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "fiscal_year_gjahr",
    "sequence_number_lnran",
    "depreciation_area_afabe"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH 
  date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  anep.mandt AS client_mandt,
  anep.bukrs AS company_code_bukrs,
  anep.anln1 AS asset_number_anln1,
  anep.anln2 AS asset_subnumber_anln2,
  anep.gjahr AS fiscal_year_gjahr,
  anep.lnran AS sequence_number_lnran,
  anep.afabe AS depreciation_area_afabe,
  anep.zujhr AS acquisition_year_zujhr,
  anep.zucod AS acquisition_code_zucod,
  anep.peraf AS depreciation_period_peraf,
  anep.belnr AS accounting_document_number_belnr,
  anep.buzei AS accounting_document_line_item_buzei,
  anep.bzdat AS asset_value_date_bzdat,
  anep.bwasl AS transaction_type_bwasl,
  anep.xafar AS ordinary_depreciation_indicator_xafar,
  ${currency.amountWithDecimalShift("anep.anbtr", "currency_decimal")} AS amount_posted_anbtr,
  ${currency.amountWithDecimalShift("anep.nafab", "currency_decimal")} AS ordinary_depreciation_nafab,
  ${currency.amountWithDecimalShift("anep.safab", "currency_decimal")} AS special_depreciation_safab,
  ${currency.amountWithDecimalShift("anep.zinsb", "currency_decimal")} AS interest_posted_zinsb,
  anep.xantw AS proportional_values_indicator_xantw,
  anep.xawbt AS transfer_of_residual_value_indicator_xawbt,
  anep.lnsan AS sequence_number_lnsan,
  anep.anupd AS update_indicator_anupd,
  anep.augln AS clearing_line_item_augln,
  t001.waers AS local_currency_waers,
  dimensional_date_bzdat.cal_year AS year_of_asset_value_date_bzdat,
  dimensional_date_bzdat.cal_month AS month_of_asset_value_date_bzdat,
  dimensional_date_bzdat.cal_quarter AS quarter_of_asset_value_date_bzdat,
  dimensional_date_bzdat.cal_week AS week_of_asset_value_date_bzdat,
  IFNULL(
    anep.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anep")} AS anep
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON anep.mandt = t001.mandt
  AND anep.bukrs = t001.bukrs
LEFT JOIN currency_decimal
  ON t001.waers = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_bzdat
  ON anep.bzdat = dimensional_date_bzdat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anep"])
])}
`,
);
