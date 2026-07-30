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
    "purchasing_document_ebeln",
    "item_ebelp",
    "seq_number_of_account_assignment_zekkn",
    "transaction_event_type_vgabe",
    "material_document_year_gjahr",
    "material_document_belnr",
    "material_document_item_buzei"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  ekbe.mandt AS client_mandt,
  ekbe.ebeln AS purchasing_document_ebeln,
  ekbe.ebelp AS item_ebelp,
  ekbe.zekkn AS seq_number_of_account_assignment_zekkn,
  ekbe.vgabe AS transaction_event_type_vgabe,
  ekbe.gjahr AS material_document_year_gjahr,
  ekbe.belnr AS material_document_belnr,
  ekbe.buzei AS material_document_item_buzei,
  ekbe.bewtp AS po_history_category_bewtp,
  ekbe.bwart AS movement_type_bwart,
  ekbe.budat AS posting_date_budat,
  ekbe.menge AS quantity_menge,
  ekbe.bpmng AS quantity_in_opun_bpmng,
  ${currency.amountWithDecimalShift("ekbe.dmbtr", "currency_decimal_hswae")} AS amount_in_loc_cur_dmbtr,
  ${currency.amountWithDecimalShift("ekbe.wrbtr", "currency_decimal_waers")} AS amount_wrbtr,
  ekbe.waers AS currency_waers,
  ${currency.amountWithDecimalShift("ekbe.arewr", "currency_decimal_hswae")} AS gr_ir_clearing_value_in_local_currency_arewr,
  ekbe.wesbs AS gr_blck_stock_in_oun_wesbs,
  ekbe.bpwes AS gr_blocked_stck_opun_bpwes,
  ekbe.shkzg AS debit_credit_ind_shkzg,
  ekbe.bwtar AS valuation_type_bwtar,
  ekbe.elikz AS delivery_completed_elikz,
  ekbe.xblnr AS reference_xblnr,
  ekbe.lfgja AS fisc_year_reference_document_lfgja,
  ekbe.lfbnr AS reference_document_lfbnr,
  ekbe.lfpos AS reference_document_item_lfpos,
  ekbe.grund AS reason_for_movement_grund,
  ekbe.cpudt AS entry_date_cpudt,
  ekbe.cputm AS time_of_entry_cputm,
  ${currency.amountWithDecimalShift("ekbe.reewr", "currency_decimal_hswae")} AS invoice_value_reewr,
  ekbe.evere AS compliance_with_shipping_instr_evere,
  ${currency.amountWithDecimalShift("ekbe.refwr", "currency_decimal_waers")} AS invoice_value_in_fc_refwr,
  ekbe.matnr AS material_matnr,
  ekbe.werks AS plant_werks,
  ekbe.xwsbr AS revgr_despite_ir_xwsbr,
  ekbe.etens AS sequential_number_etens,
  ekbe.knumv AS document_condition_number_knumv,
  ekbe.mwskz AS tax_code_mwskz,
  ekbe.lsmng AS del_note_quantity_lsmng,
  ekbe.lsmeh AS delivery_note_unit_lsmeh,
  ekbe.ematn AS material_ematn,
  ${currency.amountWithDecimalShift("ekbe.areww", "currency_decimal_waers")} AS gr_ir_clearing_value_in_fc_areww,
  ekbe.hswae AS local_currency_hswae,
  ekbe.bamng AS quantity_bamng,
  ekbe.charg AS batch_charg,
  ekbe.bldat AS document_date_bldat,
  ekbe.xwoff AS calcn_of_value_open_xwoff,
  ekbe.xunpl AS unplanned_account_assgmt_inv_verification_xunpl,
  ekbe.ernam AS created_by_ernam,
  ekbe.srvpos AS service_srvpos,
  ekbe.packno AS package_number_packno,
  ekbe.introw AS service_line_introw,
  ekbe.bekkn AS seq_number_of_po_acc_assignment_bekkn,
  ekbe.lemin AS srv_returns_indicator_lemin,
  ${currency.amountWithDecimalShift("ekbe.arewb", "currency_decimal_waers")} AS gr_ir_clearing_value_in_fc_arewb,
  ${currency.amountWithDecimalShift("ekbe.rewrb", "currency_decimal_waers")} AS fc_invoice_amount_rewrb,
  ekbe.saprl AS sap_release_saprl,
  ekbe.menge_pop AS quantity_menge_pop,
  ekbe.bpmng_pop AS quantity_in_opun_bpmng_pop,
  ${currency.amountWithDecimalShift("ekbe.dmbtr_pop", "currency_decimal_hswae")} AS amount_in_loc_cur_dmbtr_pop,
  ${currency.amountWithDecimalShift("ekbe.wrbtr_pop", "currency_decimal_waers")} AS amount_wrbtr_pop,
  ekbe.wesbb AS value_gr_blocked_stock_in_oun_wesbb,
  ekbe.bpweb AS valuated_gr_blocked_stock_in_opun_bpweb,
  ekbe.weora AS origin_acceptance_weora,
  ${currency.amountWithDecimalShift("ekbe.arewr_pop", "currency_decimal_hswae")} AS gr_ir_clearing_value_in_local_currency_arewr_pop,
  ${currency.amountWithDecimalShift("ekbe.kudif", "currency_decimal_waers")} AS exch_rate_diff_amount_kudif,
  ${currency.amountWithDecimalShift("ekbe.retamt_fc", "currency_decimal_waers")} AS retention_in_document_currency_retamt_fc,
  ${currency.amountWithDecimalShift("ekbe.retamt_lc", "currency_decimal_hswae")} AS retention_in_company_code_currency_retamt_lc,
  ${currency.amountWithDecimalShift("ekbe.retamtp_fc", "currency_decimal_waers")} AS posted_retention_in_document_currency_retamtp_fc,
  ${currency.amountWithDecimalShift("ekbe.retamtp_lc", "currency_decimal_hswae")} AS posted_security_retention_in_cc_currency_retamtp_lc,
  ekbe.xmacc AS multiple_account_assignment_xmacc,
  ekbe.wkurs AS exchange_rate_wkurs,
  ekbe.inv_item_origin AS origin_of_an_invoice_item_inv_item_origin,
  ekbe.vbeln_st AS delivery_vbeln_st,
  ekbe.vbelp_st AS item_vbelp_st,
  ekbe.sgt_scat AS stock_segment_sgt_scat,
  ekbe.logsy AS logical_system_logsy,
  ekbe.et_upd AS slqupd_et_upd,
  ekbe.j_sc_die_comp_f AS die_complete_flag_j_sc_die_comp_f,
  ekbe.fsh_season_year AS season_year_fsh_season_year,
  ekbe.fsh_season AS season_fsh_season,
  ekbe.fsh_collection AS collection_fsh_collection,
  ekbe.fsh_theme AS theme_fsh_theme,
  ekbe.wrf_charstc1 AS characteristic_value_1_wrf_charstc1,
  ekbe.wrf_charstc2 AS characteristic_value_2_wrf_charstc2,
  ekbe.wrf_charstc3 AS characteristic_value_3_wrf_charstc3,
  IFNULL(
    ekbe.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ekbe")} AS ekbe
LEFT JOIN currency_decimal AS currency_decimal_waers
  ON ekbe.waers = currency_decimal_waers.currkey
LEFT JOIN currency_decimal AS currency_decimal_hswae
  ON ekbe.hswae = currency_decimal_hswae.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ekbe"])
])}
`
);
