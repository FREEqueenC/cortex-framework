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
    "client_rclnt",
    "fiscal_year_ryear",
    "document_number_docnr",
    "ledger_rldnr",
    "company_code_rbukrs",
    "line_item_docln"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  faglflexa.rclnt AS client_rclnt,
  faglflexa.ryear AS fiscal_year_ryear,
  faglflexa.docnr AS document_number_docnr,
  faglflexa.rldnr AS ledger_rldnr,
  faglflexa.rbukrs AS company_code_rbukrs,
  faglflexa.docln AS line_item_docln,
  faglflexa.activ AS transaction_activ,
  faglflexa.rmvct AS transaction_type_rmvct,
  faglflexa.rtcur AS transaction_currency_rtcur,
  faglflexa.runit AS base_unit_of_measure_runit,
  faglflexa.awtyp AS reference_procedure_awtyp,
  faglflexa.rrcty AS record_type_rrcty,
  faglflexa.rvers AS version_rvers,
  faglflexa.logsys AS logical_system_logsys,
  faglflexa.racct AS account_number_racct,
  faglflexa.cost_elem AS cost_element_cost_elem,
  faglflexa.rcntr AS cost_center_rcntr,
  faglflexa.prctr AS profit_center_prctr,
  faglflexa.rfarea AS functional_area_rfarea,
  faglflexa.rbusa AS business_area_rbusa,
  faglflexa.kokrs AS controlling_area_kokrs,
  faglflexa.segment AS segment_segment,
  faglflexa.scntr AS sender_cost_center_scntr,
  faglflexa.pprctr AS partner_profit_ctr_pprctr,
  faglflexa.sfarea AS partner_func_area_sfarea,
  faglflexa.sbusa AS trading_part_ba_sbusa,
  faglflexa.rassc AS trading_partner_rassc,
  faglflexa.psegment AS partner_segment_psegment,
  ${currency.amountWithDecimalShift("faglflexa.tsl", "currency_decimal_rtcur")} AS amount_in_transaction_currency_tsl,
  ${currency.amountWithDecimalShift("faglflexa.hsl", "currency_decimal_t001")} AS amount_in_local_currency_hsl,
  faglflexa.ksl AS amount_in_group_currency_ksl,
  faglflexa.osl AS amount_in_another_currency_osl,
  faglflexa.msl AS quantity_msl,
  ${currency.amountWithDecimalShift("faglflexa.wsl", "currency_decimal_rwcur")} AS amount_in_original_transaction_currency_wsl,
  faglflexa.drcrk AS debit_credit_indicator_drcrk,
  faglflexa.poper AS posting_period_poper,
  faglflexa.rwcur AS original_transaction_currency_rwcur,
  faglflexa.gjahr AS fiscal_year_gjahr,
  faglflexa.budat AS posting_date_budat,
  faglflexa.belnr AS document_number_belnr,
  faglflexa.buzei AS line_item_buzei,
  faglflexa.bschl AS posting_key_bschl,
  faglflexa.bstat AS document_status_bstat,
  faglflexa.linetype AS item_category_linetype,
  faglflexa.xsplitmod AS changed_document_splitting_xsplitmod,
  faglflexa.usnam AS user_name_usnam,
  faglflexa.timestamp AS timestamp_timestamp,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  IFNULL(
    faglflexa.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "faglflexa")} AS faglflexa
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON faglflexa.rclnt = t001.mandt
  AND faglflexa.rbukrs = t001.bukrs
LEFT JOIN currency_decimal AS currency_decimal_rtcur
  ON faglflexa.rtcur = currency_decimal_rtcur.currkey
LEFT JOIN currency_decimal AS currency_decimal_t001
  ON t001.waers = currency_decimal_t001.currkey
LEFT JOIN currency_decimal AS currency_decimal_rwcur
  ON faglflexa.rwcur = currency_decimal_rwcur.currkey
LEFT JOIN date_dimension AS dimensional_date_budat
  ON faglflexa.budat = dimensional_date_budat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["faglflexa"])
])}
`
);
