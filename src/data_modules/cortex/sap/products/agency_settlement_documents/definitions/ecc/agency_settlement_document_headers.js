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
    "settlement_document_wbeln"
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
  wbrk.mandt AS client_mandt,
  wbrk.wbeln AS settlement_document_wbeln,
  wbrk.lfart AS billing_type_lfart,
  wbrk.lftyp AS billing_category_lftyp,
  wbrk.wrart AS payment_type_wrart,
  wbrk.wbtyp AS payment_type_wbtyp,
  wbrk.wrtyp AS entry_category_wrtyp,
  wbrk.abart AS settlement_type_abart,
  wbrk.kalsm AS procedure_kalsm,
  wbrk.kalsmd AS procedure_kalsmd,
  wbrk.wfdat AS posting_date_wfdat,
  wbrk.rfbsk AS posting_status_rfbsk,
  wbrk.lifre AS invoicing_party_lifre,
  wbrk.lnrzb AS payment_recipient_lnrzb,
  wbrk.kunre AS bill_to_party_kunre,
  wbrk.kunrg AS payer_kunrg,
  wbrk.ekorg AS purch_organization_ekorg,
  wbrk.vkorg AS sales_organization_vkorg,
  wbrk.vtweg AS distribution_channel_vtweg,
  wbrk.spart AS division_spart,
  wbrk.bukrs AS company_code_bukrs,
  wbrk.erzet AS time_erzet,
  wbrk.erdat AS created_on_erdat,
  wbrk.ernam AS created_by_ernam,
  wbrk.aedat AS changed_on_aedat,
  wbrk.bldat AS document_date_bldat,
  wbrk.xblnr AS reference_xblnr,
  wbrk.zuonr AS assignment_zuonr,
  wbrk.waerl AS document_currency_waerl,
  wbrk.wstwae AS statistics_currency_wstwae,
  wbrk.wkurs AS exchange_rate_wkurs,
  wbrk.stcur AS exchange_rate_stats_stcur,
  wbrk.kufix AS exchange_rate_fixed_kufix,
  wbrk.wkurs_dat AS translation_date_wkurs_dat,
  ${currency.amountWithDecimalShift("wbrk.brtwr", "currency_decimal")} AS gross_value_brtwr,
  wbrk.zterm AS terms_of_payment_zterm,
  wbrk.zbd1t AS payment_in_zbd1t,
  wbrk.zbd1p AS discpercent_1_zbd1p,
  wbrk.zbd2t AS days_2_zbd2t,
  wbrk.zbd2p AS discpercent_2_zbd2p,
  wbrk.zbd3t AS days_net_zbd3t,
  wbrk.zlsch AS payment_method_zlsch,
  ${currency.amountWithDecimalShift("wbrk.netwr", "currency_decimal")} AS net_value_netwr,
  ${currency.amountWithDecimalShift("wbrk.netwrd", "currency_decimal")} AS net_value_netwrd,
  ${currency.amountWithDecimalShift("wbrk.brtwrd", "currency_decimal")} AS gross_value_brtwrd,
  wbrk.ztermd AS terms_of_payment_ztermd,
  wbrk.zbd1td AS payment_in_zbd1td,
  wbrk.zbd1pd AS cash_discount_rate_1_zbd1pd,
  wbrk.zbd2td AS payment_in_zbd2td,
  wbrk.zbd2pd AS cash_discount_rate_2_zbd2pd,
  wbrk.zbd3td AS payment_in_zbd3td,
  wbrk.zlschd AS payment_method_zlschd,
  ${currency.amountWithDecimalShift("wbrk.gsktod", "currency_decimal")} AS cash_discbasis_gsktod,
  ${currency.amountWithDecimalShift("wbrk.gskto", "currency_decimal")} AS cash_discbasis_gskto,
  wbrk.fksto AS cancelled_fksto,
  wbrk.kappl AS application_kappl,
  wbrk.knumv AS doc_condition_no_knumv,
  wbrk.knumvd AS doc_condition_no_knumvd,
  wbrk.stafo AS update_group_stats_stafo,
  wbrk.lfaks AS cancelled_document_lfaks,
  wbrk.knuma AS agreement_knuma,
  wbrk.lfart_rl AS remunerlist_type_lfart_rl,
  wbrk.wfdat_rl AS remuneratn_list_date_wfdat_rl,
  wbrk.wbeln_rl AS remuneration_list_wbeln_rl,
  wbrk.ekgrp AS purchasing_group_ekgrp,
  wbrk.valtg AS additvalue_days_valtg,
  wbrk.valdt AS fixed_value_date_valdt,
  ${currency.amountWithDecimalShift("wbrk.mwsbk", "currency_decimal")} AS tax_amount_mwsbk,
  ${currency.amountWithDecimalShift("wbrk.mwsbkd", "currency_decimal")} AS tax_amount_mwsbkd,
  ${currency.amountWithDecimalShift("wbrk.navnk", "currency_decimal")} AS non_deductible_navnk,
  wbrk.logsys AS logical_system_logsys,
  wbrk.diekz AS service_indicator_diekz,
  wbrk.landl AS supplying_cntry_landl,
  wbrk.lzbkz AS scb_indicator_lzbkz,
  wbrk.kkber AS credit_control_area_kkber,
  wbrk.lfgru AS activity_reason_lfgru,
  wbrk.valtgd AS additvalue_days_valtgd,
  wbrk.valdtd AS fixed_value_date_valdtd,
  wbrk.kidno AS payment_reference_kidno,
  wbrk.wdtyp AS document_category_wdtyp,
  wbrk.wkurs_p1 AS exchange_rate_wkurs_p1,
  wbrk.wkurs_p2 AS exchange_rate_wkurs_p2,
  wbrk.wpycur_p1 AS pymnt_curr_vendor_wpycur_p1,
  wbrk.wpycur_p2 AS pymnt_curr_customer_wpycur_p2,
  wbrk.estatus AS application_status_estatus,
  wbrk.kurst AS exchange_rate_type_kurst,
  wbrk.vkbur AS sales_office_vkbur,
  wbrk.vkgrp AS sales_group_vkgrp,
  wbrk.settle_doc AS settlement_document_settle_doc,
  wbrk.fksto_part AS partial_reversal_fksto_part,
  wbrk.post_party AS posting_partner_post_party,
  wbrk.cpdk_addr AS otc_address_cpdk_addr,
  wbrk.fksto_party AS cancelled_partner_fksto_party,
  wbrk.contract AS contract,
  wbrk.contract_type AS contract_type,
  wbrk.collection_type AS summarization_collection_type,
  wbrk.cmwae AS currency_cmwae,
  wbrk.ctlpc AS risk_category_ctlpc,
  ${currency.amountWithDecimalShift("wbrk.cm_amount", "currency_decimal")} AS rel_credit_value_cm_amount,
  wbrk.settle_category AS settlement_attribute_settle_category,
  wbrk.idobj_type_v AS identification_object_type_vendor_idobj_type_v,
  wbrk.idobj_vendor AS identification_object_vendor_idobj_vendor,
  wbrk.idobj_type_c AS identificatn_object_type_customer_idobj_type_c,
  wbrk.idobj_customer AS identification_object_customer_idobj_customer,
  wbrk.posting_rule_k AS creditor_posting_rule_posting_rule_k,
  wbrk.posting_rule_d AS debtor_posting_rule_posting_rule_d,
  wbrk.posting_rule_a AS special_posting_rule_posting_rule_a,
  wbrk.vkont AS contract_account_vkont,
  wbrk.wt_active AS extndd_withholding_tax_active_wt_active,
  wbrk.bukrs_deb AS company_code_cust_bukrs_deb,
  wbrk.settl_party AS settlement_partner_settl_party,
  wbrk.settl_status_v AS settlement_status_vendor_settl_status_v,
  wbrk.settl_status_c AS settlement_status_customer_settl_status_c,
  wbrk.settl_doctype_v AS settlement_doc_type_vendor_settl_doctype_v,
  wbrk.settl_doctype_c AS settlement_doc_type_cust_settl_doctype_c,
  wbrk.settl_method AS settlement_procedure_settl_method,
  wbrk.settl_block_v AS settlement_block_vendor_settl_block_v,
  wbrk.settl_block_c AS settlement_block_customer_settl_block_c,
  wbrk.cpdl_addr AS addr_one_time_vendor_cpdl_addr,
  wbrk.monat AS posting_period_monat,
  wbrk.servconf_id AS crm_conf_id_servconf_id,
  wbrk.counter AS counter_reading_counter,
  wbrk.counter_unit AS unit_of_measurement_counter_unit,
  wbrk.exp_class AS expense_class_exp_class,
  wbrk.exp_calc_type AS calculation_type_exp_calc_type,
  wbrk.doc_settled AS document_settled_doc_settled,
  wbrk.ref_value_ref AS unit_ref_value_ref,
  ${currency.amountWithDecimalShift("wbrk.ref_value", "currency_decimal")} AS reference_value_ref_value,
  wbrk.post_type AS posting_type_post_type,
  wbrk.tew_type AS tew_type,
  wbrk.step AS process_step,
  wbrk.partner_exp AS business_partner_partner_exp,
  wbrk.step_from AS process_step_step_from,
  wbrk.step_tew AS process_step_step_tew,
  wbrk.mode AS mode,
  wbrk.partner_exp_type AS partner_partner_exp_type,
  wbrk.iv_check_type_h AS check_type_header_iv_check_type_h,
  wbrk.iv_accr AS accrual_iv_accr,
  wbrk.rrlcg AS condition_type_group_rrlcg,
  wbrk.rrlpa AS list_partner_rrlpa,
  wbrk.contr_type AS condition_contract_type_contr_type,
  wbrk.settl_date_type AS settlement_date_type_settl_date_type,
  wbrk.act_settl_date AS actual_settlement_date_act_settl_date,
  wbrk.settl_date_seq_id AS settlement_date_sequential_id_settl_date_seq_id,
  wbrk.total_menge AS total_quantity_total_menge,
  wbrk.total_wfkme AS unit_of_measure_for_total_quantity_total_wfkme,
  wbrk.total_ntgew AS total_net_weight_total_ntgew,
  wbrk.total_brgew AS total_gross_weight_total_brgew,
  wbrk.total_gewei AS unit_of_weight_for_total_weight_total_gewei,
  wbrk.total_volum AS total_volume_total_volum,
  wbrk.total_voleh AS volume_unit_for_total_volume_total_voleh,
  wbrk.total_anzpu AS total_points_total_anzpu,
  wbrk.total_punei AS points_unit_for_total_points_total_punei,
  wbrk.settl_start_date AS start_date_of_settlement_period_settl_start_date,
  wbrk.corr_document AS adjustment_document_corr_document,
  wbrk.incomp_reason AS incompleteness_reason_incomp_reason,
  wbrk.lifnr_fi AS alternative_creditor_lifnr_fi,
  wbrk.distrib_incomp AS distribution_incomplete_distrib_incomp,
  wbrk.rfbsk_comb_sett AS combined_settlement_posting_status_rfbsk_comb_sett,
  wbrk.no_text_h AS no_texts_exist_no_text_h,
  wbrk.intrastat_rel AS intrastat_intrastat_rel,
  wbrk.landtx AS tax_dep_country_landtx,
  wbrk.land1tx AS tax_dest_country_land1tx,
  wbrk.xegdr AS eu_triangular_deal_xegdr,
  wbrk.stceg AS supplier_vat_regno_stceg,
  wbrk.stcegd AS customer_vat_regno_stcegd,
  wbrk.intrastat_flow_d AS goods_flow_intrastat_flow_d,
  wbrk.service_indicator AS service_indicator,
  wbrk.inco1 AS incoterms_inco1,
  wbrk.inco2 AS incoterms_part_2_inco2,
  wbrk.wkurs_deb AS exchange_rate_customer_co_code_wkurs_deb,
  wbrk.settlement_date AS settlement_date,
  wbrk.process_type AS proc_cat_process_type,
  wbrk.bank_data AS bank_data,
  wbrk.coll_status AS status_for_collection_of_settlement_req_coll_status,
  wbrk.is_collection AS docis_collective_doc_is_collection,
  wbrk.coll_block AS block_header_coll_coll_block,
  wbrk.ref_settl_date AS reference_settlement_date_ref_settl_date,
  wbrk.landtx_bukrs AS tax_country_company_code_landtx_bukrs,
  wbrk.landtx_bukrs_deb AS tax_country_company_code_customer_landtx_bukrs_deb,
  wbrk.use_case AS use_case_type_use_case,
  wbrk.use_case_guid AS guid_for_use_case_use_case_guid,
  wbrk.invoice_id AS external_invoice_id,
  wbrk.scheme_id AS scheme_scheme_id,
  wbrk.scheme_a_id AS scheme_id_scheme_a_id,
  wbrk.agency_id_code AS agency_id_agency_id_code,
  wbrk.itcup AS cup_number_for_italy_itcup,
  wbrk.itcig AS cig_number_for_italy_itcig,
  wbrk.mndid AS mandate_reference_mndid,
  dimensional_date_wfdat.cal_year AS year_of_posting_date_wfdat,
  dimensional_date_wfdat.cal_month AS month_of_posting_date_wfdat,
  dimensional_date_wfdat.cal_quarter AS quarter_of_posting_date_wfdat,
  dimensional_date_wfdat.cal_week AS week_of_posting_date_wfdat,
  dimensional_date_erdat.cal_year AS year_of_created_on_erdat,
  dimensional_date_erdat.cal_month AS month_of_created_on_erdat,
  dimensional_date_erdat.cal_quarter AS quarter_of_created_on_erdat,
  dimensional_date_erdat.cal_week AS week_of_created_on_erdat,
  dimensional_date_aedat.cal_year AS year_of_changed_on_aedat,
  dimensional_date_aedat.cal_month AS month_of_changed_on_aedat,
  dimensional_date_aedat.cal_quarter AS quarter_of_changed_on_aedat,
  dimensional_date_aedat.cal_week AS week_of_changed_on_aedat,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  IFNULL(
    wbrk.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wbrk")} AS wbrk
LEFT JOIN currency_decimal
  ON wbrk.waerl = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_wfdat
  ON wbrk.wfdat = dimensional_date_wfdat.date
LEFT JOIN date_dimension AS dimensional_date_erdat
  ON wbrk.erdat = dimensional_date_erdat.date
LEFT JOIN date_dimension AS dimensional_date_aedat
  ON wbrk.aedat = dimensional_date_aedat.date
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON wbrk.bldat = dimensional_date_bldat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wbrk"])
])}
`,
);
