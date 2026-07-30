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
    "invoice_document_number_belnr",
    "fiscal_year_gjahr",
    "invoice_item_buzei",
    "sequential_number_account_assignment_zekkn",
    "sequential_number_cobl_nr"
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
    rbco.mandt AS client_mandt,
    rbco.belnr AS invoice_document_number_belnr,
    rbco.gjahr AS fiscal_year_gjahr,
    rbco.buzei AS invoice_item_buzei,
    rbco.zekkn AS sequential_number_account_assignment_zekkn,
    rbco.cobl_nr AS sequential_number_cobl_nr,
    rbco.anln1 AS main_asset_number_anln1,
    rbco.anln2 AS asset_subnumber_anln2,
    rbco.aplzl AS routing_number_aplzl,
    rbco.aufnr AS order_number_aufnr,
    rbco.dabrz AS settlement_reference_date_dabrz,
    rbco.fipos AS commitment_item_fipos,
    rbco.fistl AS funds_center_fistl,
    rbco.fkber AS functional_area_fkber,
    rbco.geber AS fund_geber,
    rbco.grant_nbr AS grant_number_grant_nbr,
    rbco.gsber AS business_area_gsber,
    rbco.imkey AS real_estate_object_key_imkey,
    rbco.kokrs AS controlling_area_kokrs,
    rbco.kostl AS cost_center_kostl,
    rbco.kstrg AS cost_object_kstrg,
    rbco.paobjnr AS profitability_segment_number_paobjnr,
    rbco.prctr AS profit_center_prctr,
    rbco.ps_psp_pnr AS wbs_element_ps_psp_pnr,
    rbco.recid AS rules_issuing_invoice_recid,
    rbco.saknr AS general_ledger_account_saknr,
    rbco.vbeln AS sales_document_number_vbeln,
    rbco.vbelp AS sales_document_item_vbelp,
    rbco.vptnr AS partner_account_number_vptnr,
    rbco.xunpl AS unplanned_account_assignment_indicator_xunpl,
    rbco.lstar AS activity_type_lstar,
    rbco.prznr AS business_process_prznr,
    rbco.aufpl AS routing_number_operations_order_aufpl,
    rbco.bzdat AS asset_value_date_bzdat,
    rbco.xnegp AS negative_posting_indicator_xnegp,
    rbco.erlkz AS used_earmarked_funds_indicator_erlkz,
    rbco.fikrs AS financial_management_area_fikrs,
    rbco.kblnr AS earmarked_funds_document_number_kblnr,
    rbco.kblpos AS earmarked_funds_document_item_number_kblpos,
    rbco.pargb AS trading_partner_business_area_pargb,
    rbco.pernr AS personnel_number_pernr,
    rbco.nplnr AS network_number_account_assignment_nplnr,
    rbco.vornr AS operation_activity_number_vornr,
    rbco.zuonr AS assignment_number_zuonr,
    rbco.mwart AS tax_type_mwart,
    rbco.abper AS settlement_period_abper,
    rbco.ledat AS delivery_creation_date_ledat,
    rbco.menge_f AS quantity_menge_f,
    rbco.bpmng_f AS quantity_po_price_unit_bpmng_f,
    rbco.werks AS plant_werks,
    rbco.shkzg AS debit_credit_indicator_shkzg,
    rbco.mwskz AS tax_code_mwskz,
    rbco.txjcd AS tax_jurisdiction_txjcd,
    rbco.menge AS quantity_menge,
    rbco.bpmng AS quantity_po_price_unit_bpmng,
    rbco.meins AS base_unit_measure_meins,
    rbco.sgtxt AS item_text_sgtxt,
    rbco.xskrl AS line_item_cash_discount_not_liable_indicator_xskrl,
    ${currency.amountWithDecimalShift("rbco.wrbtr", "currency_decimal")} AS amount_wrbtr,
    ${currency.amountWithDecimalShift("rbco.bnkan_fw", "currency_decimal")} AS delivery_costs_distribution_amount_bnkan_fw,
    ${currency.amountWithDecimalShift("rbco.fwbas", "currency_decimal")} AS tax_base_amount_fwbas,
    ${currency.amountWithDecimalShift("rbco.hwbas", "currency_decimal")} AS tax_base_amount_local_currency_hwbas,
    dimensional_date_bzdat.cal_year AS year_of_asset_value_date_bzdat,
    dimensional_date_bzdat.cal_month AS month_of_asset_value_date_bzdat,
    dimensional_date_bzdat.cal_quarter AS quarter_of_asset_value_date_bzdat,
    dimensional_date_bzdat.cal_week AS week_of_asset_value_date_bzdat,
    dimensional_date_ledat.cal_year AS year_of_delivery_creation_date_ledat,
    dimensional_date_ledat.cal_month AS month_of_delivery_creation_date_ledat,
    dimensional_date_ledat.cal_quarter AS quarter_of_delivery_creation_date_ledat,
    dimensional_date_ledat.cal_week AS week_of_delivery_creation_date_ledat,
    IFNULL(
      rbco.recordstamp,
      TIMESTAMP('1900-01-01 00:00:00+00')
    ) AS source_last_updated_at,
    CURRENT_TIMESTAMP() AS bq_loaded_at
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rbco")} AS rbco
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rbkp")} AS rbkp
    ON rbco.mandt = rbkp.mandt
    AND rbco.belnr = rbkp.belnr
    AND rbco.gjahr = rbkp.gjahr
  LEFT JOIN currency_decimal
    ON rbkp.waers = currency_decimal.currkey
  LEFT JOIN date_dimension AS dimensional_date_bzdat
    ON rbco.bzdat = dimensional_date_bzdat.date
  LEFT JOIN date_dimension AS dimensional_date_ledat
    ON rbco.ledat = dimensional_date_ledat.date
  ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["rbco"])
  ])}
  `
);
