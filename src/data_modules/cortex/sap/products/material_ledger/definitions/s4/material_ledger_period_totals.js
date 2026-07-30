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
    "valuation_header_kalnr",
    "fiscal_year_lfgja",
    "posting_period_lfmon",
    "value_structure_type_untper",
    "currency_type_curtp"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  ckmlcr.mandt AS client_mandt,
  ckmlcr.kalnr AS valuation_header_kalnr,
  ckmlcr.bdatj AS fiscal_year_lfgja,
  ckmlcr.poper AS posting_period_lfmon,
  ckmlcr.untper AS value_structure_type_untper,
  ckmlcr.curtp AS currency_type_curtp,
  ckmlhd.matnr AS material_number_matnr,
  ckmlhd.bwkey AS valuation_area_bwkey,
  ckmlhd.bwtar AS valuation_type_bwtar,
  ckmlcr.peinh AS price_unit_peinh,
  ckmlcr.vprsv AS price_control_indicator_vprsv,
  ckmlcr.waers AS currency_key_waers,
  ${currency.amountWithDecimalShift("ckmlcr.stprs", "currency_decimal")} AS standard_price_stprs,
  ${currency.amountWithDecimalShift("ckmlcr.pvprs", "currency_decimal")} AS moving_average_price_verpr,
  ${currency.amountWithDecimalShift("ckmlcr.salk3", "currency_decimal")} AS value_of_total_valuated_stock_salk3,
  ${currency.amountWithDecimalShift("ckmlcr.salkv", "currency_decimal")} AS value_at_periodic_unit_price_salkv,
  ${currency.amountWithDecimalShift("ckmlcr.zuumb_o", "currency_decimal")} AS revaluation_amount_pup_zuumb_o,
  ${currency.amountWithDecimalShift("ckmlcr.absalk3", "currency_decimal")} AS beg_inv_value_absalk3,
  ${currency.amountWithDecimalShift("ckmlcr.markup_o", "currency_decimal")} AS intercompany_profit_markup_o,
  ${currency.amountWithDecimalShift("ckmlcr.abprd_o", "currency_decimal")} AS beg_inv_single_level_price_diff_abprd_o,
  ${currency.amountWithDecimalShift("ckmlcr.abkdm_o", "currency_decimal")} AS beg_inv_single_level_exch_rate_diff_abkdm_o,
  ${currency.amountWithDecimalShift("ckmlcr.zuprd_o", "currency_decimal")} AS receipts_single_level_price_diff_zuprd_o,
  ${currency.amountWithDecimalShift("ckmlcr.zukdm_o", "currency_decimal")} AS receipts_single_level_exch_rate_diff_zukdm_o,
  ${currency.amountWithDecimalShift("ckmlcr.vpprd_o", "currency_decimal")} AS other_movements_single_level_price_diff_vpprd_o,
  ${currency.amountWithDecimalShift("ckmlcr.vpkdm_o", "currency_decimal")} AS other_movements_single_level_exch_rate_diff_vpkdm_o,
  ${currency.amountWithDecimalShift("ckmlcr.vnprd_o", "currency_decimal")} AS consumption_single_level_price_diff_vnprd_o,
  ${currency.amountWithDecimalShift("ckmlcr.vnkdm_o", "currency_decimal")} AS consumption_single_level_exch_rate_diff_vnkdm_o,
  ${currency.amountWithDecimalShift("ckmlcr.ekprd_o", "currency_decimal")} AS po_price_differences_ekprd_o,
  ${currency.amountWithDecimalShift("ckmlcr.ekkdm_o", "currency_decimal")} AS po_exch_rate_differences_ekkdm_o,
  ${currency.amountWithDecimalShift("ckmlcr.ebprd_ea", "currency_decimal")} AS end_inv_single_level_price_diff_ebprd_ea,
  ${currency.amountWithDecimalShift("ckmlcr.ebkdm_ea", "currency_decimal")} AS end_inv_single_level_exch_rate_diff_ebkdm_ea,
  ${currency.amountWithDecimalShift("ckmlcr.abprd_mo", "currency_decimal")} AS beg_inv_multilevel_price_diff_abprd_mo,
  ${currency.amountWithDecimalShift("ckmlcr.abkdm_mo", "currency_decimal")} AS beg_inv_multilevel_exch_rate_diff_abkdm_mo,
  ${currency.amountWithDecimalShift("ckmlcr.zuprd_mo", "currency_decimal")} AS receipts_multilevel_price_diff_zuprd_mo,
  ${currency.amountWithDecimalShift("ckmlcr.zukdm_mo", "currency_decimal")} AS receipts_multilevel_exch_rate_diff_zukdm_mo,
  ${currency.amountWithDecimalShift("ckmlcr.ebprd_ma", "currency_decimal")} AS end_inv_multilevel_price_diff_ebprd_ma,
  ${currency.amountWithDecimalShift("ckmlcr.ebkdm_ma", "currency_decimal")} AS end_inv_multilevel_exch_rate_diff_ebkdm_ma,
  ${currency.amountWithDecimalShift("ckmlcr.vksal", "currency_decimal")} AS total_value_at_sp_vksal,
  GREATEST(
    IFNULL(ckmlcr.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(ckmlhd.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ckmlcr")} AS ckmlcr
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ckmlhd")} AS ckmlhd
  ON ckmlcr.mandt = ckmlhd.mandt
    AND ckmlcr.kalnr = ckmlhd.kalnr
LEFT JOIN currency_decimal
  ON ckmlcr.waers = currency_decimal.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ckmlcr", "ckmlhd"])
])}
`
);
