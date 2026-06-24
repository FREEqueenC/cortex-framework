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
const currency = require("includes/cortex/currency.js");
const date = require("includes/cortex/date.js");
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs",
    "document_number_belnr",
    "fiscal_year_gjahr"
  ]
);

publish("accounting_documents_header", publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  bkpf.mandt AS client_mandt,
  bkpf.bukrs AS company_code_bukrs,
  bkpf.belnr AS document_number_belnr,
  bkpf.gjahr AS fiscal_year_gjahr,
  bkpf.blart AS document_type_blart,
  bkpf.bldat AS document_date_bldat,
  bkpf.budat AS posting_date_budat,
  bkpf.monat AS posting_period_monat,
  bkpf.cpudt AS entry_date_cpudt,
  bkpf.cputm AS time_of_entry_cputm,
  bkpf.aedat AS changed_on_aedat,
  bkpf.upddt AS last_update_upddt,
  bkpf.wwert AS translation_date_wwert,
  bkpf.usnam AS user_name_usnam,
  bkpf.tcode AS transaction_code_tcode,
  bkpf.bvorg AS cross_comp_code_no_bvorg,
  bkpf.xblnr AS reference_document_number_xblnr,
  bkpf.dbblg AS recurring_entry_doc_dbblg,
  bkpf.stblg AS reversed_with_stblg,
  bkpf.stjah AS year_stjah,
  bkpf.bktxt AS document_header_text_bktxt,
  bkpf.waers AS currency_key_waers,
  bkpf.kursf AS exchange_rate_kursf,
  bkpf.kzwrs AS group_currency_kzwrs,
  bkpf.kzkrs AS group_fx_rate_kzkrs,
  bkpf.bstat AS document_status_bstat,
  bkpf.xnetb AS net_document_type_xnetb,
  ${currency.amountWithDecimalShift("bkpf.frath", "currency_decimal_hwaer")} AS unpl_del_costs_frath,
  bkpf.xrueb AS document_is_back_posted_xrueb,
  bkpf.glvor AS business_transaction_glvor,
  bkpf.grpid AS session_name_grpid,
  bkpf.dokid AS document_name_dokid,
  bkpf.arcid AS extract_id_arcid,
  bkpf.iblar AS internal_document_type_iblar,
  bkpf.awtyp AS reference_procedure_awtyp,
  bkpf.awkey AS object_key_awkey,
  bkpf.fikrs AS fm_area_fikrs,
  bkpf.hwaer AS local_currency_hwaer,
  bkpf.hwae2 AS local_currency_2_hwae2,
  bkpf.hwae3 AS local_currency_3_hwae3,
  bkpf.kurs2 AS exchange_rate_2_kurs2,
  bkpf.kurs3 AS exchange_rate_3_kurs3,
  bkpf.basw2 AS source_currency_basw2,
  bkpf.basw3 AS source_currency_basw3,
  bkpf.umrd2 AS translation_date_umrd2,
  bkpf.umrd3 AS translation_date_umrd3,
  bkpf.xstov AS reversal_flag_xstov,
  bkpf.stodt AS reverse_posting_date_stodt,
  bkpf.xmwst AS calculate_tax_xmwst,
  bkpf.curt2 AS lc2_currency_type_curt2,
  bkpf.curt3 AS lc3_currency_type_curt3,
  bkpf.kuty2 AS exchange_rate_type_kuty2,
  bkpf.kuty3 AS exchange_rate_type_kuty3,
  bkpf.xsnet AS calculate_taxes_on_net_amount_xsnet,
  bkpf.ausbk AS source_company_code_ausbk,
  bkpf.xusvr AS tax_details_changed_xusvr,
  bkpf.duefl AS status_of_data_transfer_to_next_release_duefl,
  bkpf.awsys AS logical_system_awsys,
  bkpf.txkrs AS rate_for_taxes_txkrs,
  bkpf.ctxkrs AS tax_rate_local_crcy_ctxkrs,
  bkpf.lotkz AS request_number_lotkz,
  bkpf.xwvof AS boe_before_due_date_xwvof,
  bkpf.stgrd AS reversal_reason_stgrd,
  bkpf.ppnam AS parked_by_ppnam,
  bkpf.ppdat AS date_of_parking_ppdat,
  bkpf.pptme AS time_of_parking_pptme,
  bkpf.pptcod AS parking_tcode_pptcod,
  bkpf.brnch AS branch_number_brnch,
  bkpf.numpg AS number_of_pages_numpg,
  bkpf.adisc AS discount_document_adisc,
  bkpf.xref1_hd AS ref_key_header_1_xref1_hd,
  bkpf.xref2_hd AS ref_key_header_2_xref2_hd,
  bkpf.xreversal AS reversal_indicator_xreversal,
  bkpf.reindat AS invoice_receipt_date_reindat,
  bkpf.rldnr AS ledger_rldnr,
  bkpf.ldgrp AS ledger_group_ldgrp,
  bkpf.propmano AS mandate_thrd_prty_mgmt_propmano,
  bkpf.xblnr_alt AS alt_reference_number_xblnr_alt,
  bkpf.vatdate AS tax_reporting_date_vatdate,
  bkpf.doccat AS doc_type_doccat,
  bkpf.xsplit AS split_posting_xsplit,
  bkpf.cash_alloc AS cash_flow_relevant_doc_cash_alloc,
  bkpf.follow_on AS follow_on,
  bkpf.xreorg AS open_itm_reorganized_xreorg,
  bkpf.subset AS subset,
  bkpf.kurst AS exchange_rate_type_kurst,
  bkpf.kursx AS market_data_exchange_rate_kursx,
  bkpf.kur2x AS market_data_exchange_rate_2_kur2x,
  bkpf.kur3x AS market_data_exchange_rate_3_kur3x,
  bkpf.xmca AS document_from_multi_curr_accounting_xmca,
  bkpf.resubmission AS resubmission_date_resubmission,
  bkpf.penrc AS reason_for_late_pmnt_penrc,
  bkpf.psoty AS request_category_psoty,
  bkpf.psoak AS reason_psoak,
  bkpf.psoks AS region_psoks,
  bkpf.psosg AS reason_for_reversal_psosg,
  bkpf.psofn AS file_number_psofn,
  bkpf.intform AS interest_formula_intform,
  bkpf.intdate AS interest_calc_date_intdate,
  bkpf.psobt AS posting_day_psobt,
  bkpf.psozl AS actual_posting_psozl,
  bkpf.psodt AS changed_on_psodt,
  bkpf.psotm AS changed_at_psotm,
  bkpf.fm_umart AS transfer_type_fm_umart,
  bkpf.ccins AS card_type_ccins,
  bkpf.ccnum AS card_number_ccnum,
  bkpf.ssblk AS payment_sampling_block_ssblk,
  bkpf.batch AS lot_number_batch,
  bkpf.sname AS user_name_sname,
  bkpf.sampled AS sampled_invoice_by_payment_stat_samplin_sampled,
  bkpf.exclude_flag AS ppa_exclude_ind_exclude_flag,
  bkpf.blind AS budgetary_ledger_indicator_blind,
  bkpf.offset_status AS treasury_offset_status,
  bkpf.offset_refer_dat AS date_record_referred_to_treasury_offset_refer_dat,
  bkpf.knumv AS doc_condition_no_knumv,
  bkpf.pybastyp AS payt_against_pybastyp,
  bkpf.pybasno AS payt_ground_no_pybasno,
  bkpf.pybasdat AS payt_ground_date_pybasdat,
  bkpf.pyiban AS iban_pyiban,
  bkpf.inwardno_hd AS incoming_doc_nmbr_inwardno_hd,
  bkpf.inwarddt_hd AS incoming_doc_date_inwarddt_hd,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  dimensional_date_cpudt.cal_year AS year_of_entry_date_cpudt,
  dimensional_date_cpudt.cal_month AS month_of_entry_date_cpudt,
  dimensional_date_cpudt.cal_quarter AS quarter_of_entry_date_cpudt,
  dimensional_date_cpudt.cal_week AS week_of_entry_date_cpudt,
  IFNULL(
    bkpf.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "bkpf")} AS bkpf
LEFT JOIN currency_decimal AS currency_decimal_hwaer
  ON bkpf.hwaer = currency_decimal_hwaer.currkey
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON bkpf.bldat = dimensional_date_bldat.date
LEFT JOIN date_dimension AS dimensional_date_budat
  ON bkpf.budat = dimensional_date_budat.date
LEFT JOIN date_dimension AS dimensional_date_cpudt
  ON bkpf.cpudt = dimensional_date_cpudt.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["bkpf"])
])}
`
);
