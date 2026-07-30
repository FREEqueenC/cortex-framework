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
    "invoice_item_buzei"
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
    rseg.mandt AS client_mandt,
    rseg.belnr AS invoice_document_number_belnr,
    rseg.gjahr AS fiscal_year_gjahr,
    rseg.buzei AS invoice_item_buzei,
    rseg.ebeln AS purchasing_document_number_ebeln,
    rseg.ebelp AS purchasing_document_item_ebelp,
    rseg.zekkn AS sequential_number_account_assignment_zekkn,
    rseg.matnr AS material_number_matnr,
    rseg.bwkey AS valuation_area_bwkey,
    rseg.bwtar AS valuation_type_bwtar,
    rseg.bstme AS purchase_order_unit_measure_bstme,
    rseg.bprme AS order_price_unit_bprme,
    rseg.lbkum AS total_valuated_stock_lbkum,
    rseg.vrkum AS total_valuated_stock_previous_period_vrkum,
    rseg.pstyp AS purchase_order_item_category_pstyp,
    rseg.knttp AS account_assignment_category_knttp,
    rseg.bklas AS valuation_class_bklas,
    rseg.erekz AS final_invoice_indicator_erekz,
    rseg.exkbe AS update_purchase_order_history_indicator_exkbe,
    rseg.xekbz AS update_purchase_order_delivery_costs_indicator_xekbz,
    rseg.tbtkz AS subsequent_debit_credit_indicator_tbtkz,
    rseg.spgrp AS blocking_reason_price_spgrp,
    rseg.spgrm AS blocking_reason_quantity_spgrm,
    rseg.spgrt AS blocking_reason_date_spgrt,
    rseg.spgrg AS blocking_reason_order_price_quantity_spgrg,
    rseg.spgrv AS blocking_reason_project_budget_spgrv,
    rseg.spgrq AS manual_blocking_reason_spgrq,
    rseg.spgrc AS blocking_reason_quality_spgrc,
    rseg.spgrext AS blocking_reason_enhancement_fields_spgrext,
    rseg.bustw AS posting_string_values_bustw,
    rseg.xblnr AS reference_xblnr,
    rseg.xrueb AS document_posted_previous_period_indicator_xrueb,
    rseg.kschl AS condition_type_kschl,
    rseg.salk3 AS total_valuated_stock_value_salk3,
    rseg.vmsal AS total_valuated_stock_previous_period_value_vmsal,
    rseg.xlifo AS lifo_fifo_indicator_xlifo,
    rseg.lfbnr AS reference_document_number_lfbnr,
    rseg.lfgja AS fiscal_year_current_period_lfgja,
    rseg.lfpos AS reference_document_item_lfpos,
    rseg.matbf AS stock_material_number_matbf,
    rseg.rbmng AS quantity_invoiced_po_order_units_rbmng,
    rseg.bprbm AS quantity_invoiced_po_price_units_bprbm,
    rseg.lfehl AS supplier_error_type_lfehl,
    rseg.gricd AS gross_income_tax_activity_code_gricd,
    rseg.grirg AS region_grirg,
    rseg.gityp AS distribution_type_gityp,
    rseg.packno AS package_number_service_packno,
    rseg.introw AS line_number_service_introw,
    rseg.kzmek AS correction_indicator_kzmek,
    rseg.mrmok AS invoice_item_processed_indicator_mrmok,
    rseg.stunr AS step_number_stunr,
    rseg.zaehk AS condition_counter_zaehk,
    rseg.stock_posting AS stock_posting_incoming_invoice_stock_posting,
    rseg.stock_posting_pp AS stock_posting_previous_period_stock_posting_pp,
    rseg.stock_posting_py AS stock_posting_previous_year_stock_posting_py,
    rseg.werec AS clearing_indicator_grir_posting_werec,
    rseg.lifnr AS supplier_lifnr,
    rseg.frbnr AS bill_of_lading_frbnr,
    rseg.xhistma AS update_multiple_account_assignment_xhistma,
    rseg.complaint_reason AS complaint_reason_complaint_reason,
    rseg.retpc AS retention_percentage_retpc,
    rseg.retduedt AS retention_due_date_retduedt,
    rseg.xrettaxnet AS retention_tax_reduction_indicator_xrettaxnet,
    rseg.re_account AS cash_ledger_account_re_account,
    rseg.erp_contract_id AS principal_purchase_agreement_number_erp_contract_id,
    rseg.erp_contract_itm AS principal_purchase_agreement_item_number_erp_contract_itm,
    rseg.srm_contract_id AS central_contract_number_srm_contract_id,
    rseg.srm_contract_itm AS central_contract_item_number_srm_contract_itm,
    rseg.cont_pstyp AS purchase_order_item_category2_cont_pstyp,
    rseg.srvmapkey AS esoa_key_srvmapkey,
    rseg.charg AS batch_number_charg,
    rseg.inv_itm_origin AS invoice_item_origin_inv_itm_origin,
    rseg.invrel AS grouping_characteristic_invrel,
    rseg.xdinv AS invoicing_differential_indicator_xdinv,
    rseg.xcprf AS commodity_repricing_indicator_xcprf,
    rseg.fsh_season_year AS season_year_fsh_season_year,
    rseg.fsh_season AS season_fsh_season,
    rseg.fsh_collection AS fashion_collection_fsh_collection,
    rseg.fsh_theme AS fashion_theme_fsh_theme,
    rseg.licno AS internal_license_number_licno,
    rseg.zeile AS item_number_zeile,
    rseg.sgt_scat AS stock_segment_sgt_scat,
    rseg.wrf_charstc1 AS characteristic_value1_wrf_charstc1,
    rseg.wrf_charstc2 AS characteristic_value2_wrf_charstc2,
    rseg.wrf_charstc3 AS characteristic_value3_wrf_charstc3,
    rseg.werks AS plant_werks,
    rseg.shkzg AS debit_credit_indicator_shkzg,
    rseg.mwskz AS tax_code_mwskz,
    rseg.txjcd AS tax_jurisdiction_txjcd,
    rseg.menge AS quantity_menge,
    rseg.bpmng AS quantity_po_price_unit_bpmng,
    rseg.meins AS base_unit_measure_meins,
    rseg.spgrs AS blocking_reason_item_amount_spgrs,
    rseg.sgtxt AS item_text_sgtxt,
    rseg.xskrl AS line_item_cash_discount_not_liable_indicator_xskrl,
    ${currency.amountWithDecimalShift("rseg.wrbtr", "currency_decimal")} AS amount_wrbtr,
    ${currency.amountWithDecimalShift("rseg.bnkan", "currency_decimal")} AS delivery_costs_item_split_bnkan,
    ${currency.amountWithDecimalShift("rseg.retamt_fc", "currency_decimal")} AS retention_amount_retamt_fc,
    ${currency.amountWithDecimalShift("rseg.diff_amount", "currency_decimal")} AS difference_amount_diff_amount,
    ${currency.amountWithDecimalShift("rseg.rbwwr", "currency_decimal")} AS invoice_amount_rbwwr,
    dimensional_date_retduedt.cal_year AS year_of_retention_due_date_retduedt,
    dimensional_date_retduedt.cal_month AS month_of_retention_due_date_retduedt,
    dimensional_date_retduedt.cal_quarter AS quarter_of_retention_due_date_retduedt,
    dimensional_date_retduedt.cal_week AS week_of_retention_due_date_retduedt,
    IFNULL(
      rseg.recordstamp,
      TIMESTAMP('1900-01-01 00:00:00+00')
    ) AS source_last_updated_at,
    CURRENT_TIMESTAMP() AS bq_loaded_at
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rseg")} AS rseg
  LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rbkp")} AS rbkp
    ON rseg.mandt = rbkp.mandt
    AND rseg.belnr = rbkp.belnr
    AND rseg.gjahr = rbkp.gjahr
  LEFT JOIN currency_decimal
    ON rbkp.waers = currency_decimal.currkey
  LEFT JOIN date_dimension AS dimensional_date_retduedt
    ON rseg.retduedt = dimensional_date_retduedt.date
  ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["rseg"])
  ])}
  `
);
