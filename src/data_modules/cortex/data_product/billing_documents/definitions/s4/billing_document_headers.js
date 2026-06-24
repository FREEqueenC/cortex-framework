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
    "billing_document_vbeln"
  ]
);

publish("billing_document_headers", publishConfig).query(
  (ctx) => `
WITH 
  date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  vbrk.mandt AS client_mandt,
  vbrk.vbeln AS billing_document_vbeln,
  vbrk.fkart AS billing_type_fkart,
  vbrk.fktyp AS billing_category_fktyp,
  vbrk.vbtyp AS sd_document_categ_vbtyp,
  vbrk.waerk AS document_currency_waerk,
  vbrk.vkorg AS sales_organization_vkorg,
  vbrk.vtweg AS distribution_channel_vtweg,
  vbrk.kalsm AS pricing_procedure_kalsm,
  vbrk.knumv AS doc_condition_no_knumv,
  vbrk.vsbed AS shipping_conditions_vsbed,
  vbrk.fkdat AS billing_date_fkdat,
  vbrk.belnr AS document_number_belnr,
  vbrk.gjahr AS fiscal_year_gjahr,
  vbrk.poper AS posting_period_poper,
  vbrk.konda AS price_group_konda,
  vbrk.kdgrp AS customer_group_kdgrp,
  vbrk.bzirk AS sales_district_bzirk,
  vbrk.pltyp AS price_list_pltyp,
  vbrk.inco1 AS incoterms_inco1,
  vbrk.inco2 AS incoterms_part_2_inco2,
  vbrk.expkz AS export_expkz,
  vbrk.rfbsk AS posting_status_rfbsk,
  vbrk.mrnkz AS man_invoice_mainten_mrnkz,
  vbrk.kurrf AS exchange_rate_accntg_kurrf,
  vbrk.cpkur AS set_exchange_rate_cpkur,
  vbrk.valtg AS addit_value_days_valtg,
  vbrk.valdt AS fixed_value_date_valdt,
  vbrk.zterm AS terms_of_payment_zterm,
  vbrk.zlsch AS payment_method_zlsch,
  vbrk.ktgrd AS acct_assmt_grp_cust_ktgrd,
  vbrk.land1 AS destination_country_land1,
  vbrk.regio AS region_regio,
  vbrk.counc AS county_code_counc,
  vbrk.cityc AS city_code_cityc,
  vbrk.bukrs AS company_code_bukrs,
  vbrk.taxk1 AS taxclass1_cust_taxk1,
  vbrk.taxk2 AS taxclass2_cust_taxk2,
  vbrk.taxk3 AS taxclass3_cust_taxk3,
  vbrk.taxk4 AS taxclass4_cust_taxk4,
  vbrk.taxk5 AS taxclass5_cust_taxk5,
  vbrk.taxk6 AS taxclass6_cust_taxk6,
  vbrk.taxk7 AS taxclass7_cust_taxk7,
  vbrk.taxk8 AS taxclass8_cust_taxk8,
  vbrk.taxk9 AS taxclass9_cust_taxk9,
  ${currency.amountWithDecimalShift("vbrk.netwr", "currency_decimal")} AS net_value_netwr,
  vbrk.zukri AS combination_criteria_zukri,
  vbrk.ernam AS created_by_ernam,
  vbrk.erzet AS time_erzet,
  vbrk.erdat AS created_on_erdat,
  vbrk.stafo AS update_group_stats_stafo,
  vbrk.kunrg AS payer_kunrg,
  vbrk.kunag AS sold_to_party_kunag,
  vbrk.maber AS dunning_area_maber,
  vbrk.stwae AS statistics_currency_stwae,
  vbrk.exnum AS number_of_foreign_trade_data_exnum,
  vbrk.stceg AS vat_registration_no_stceg,
  vbrk.aedat AS changed_on_aedat,
  vbrk.sfakn AS cancelled_bill_doc_sfakn,
  vbrk.knuma AS agreement_knuma,
  vbrk.fkart_rl AS invoice_list_type_fkart_rl,
  vbrk.fkdat_rl AS billing_date_fkdat_rl,
  vbrk.kurst AS exchange_rate_type_kurst,
  vbrk.mschl AS dunning_key_mschl,
  vbrk.mansp AS dunning_block_mansp,
  vbrk.spart AS division_spart,
  vbrk.kkber AS credit_control_area_kkber,
  vbrk.knkli AS credit_account_knkli,
  vbrk.cmwae AS currency_cmwae,
  vbrk.cmkuf AS cred_data_exch_rate_cmkuf,
  vbrk.hityp_pr AS hierarchytypepricing_hityp_pr,
  vbrk.bstnk_vf AS po_number_bstnk_vf,
  vbrk.vbund AS trading_partner_vbund,
  vbrk.fkart_ab AS accrual_billing_type_fkart_ab,
  vbrk.kappl AS application_kappl,
  vbrk.landtx AS tax_depart_country_landtx,
  vbrk.stceg_h AS origin_sls_tax_no_stceg_h,
  vbrk.stceg_l AS country_sls_tax_no_stceg_l,
  vbrk.xblnr AS reference_xblnr,
  vbrk.zuonr AS assignment_zuonr,
  ${currency.amountWithDecimalShift("vbrk.mwsbk", "currency_decimal")} AS tax_amount_mwsbk,
  vbrk.logsys AS logical_system_logsys,
  vbrk.fksto AS cancelled_fksto,
  vbrk.xegdr AS eu_triangular_deal_xegdr,
  vbrk.rplnr AS paym_card_plan_no_rplnr,
  vbrk.lcnum AS financial_doc_no_lcnum,
  vbrk.j_1afitp AS tax_type_j_1afitp,
  vbrk.kurrf_dat AS translation_date_kurrf_dat,
  vbrk.akwae AS lett_of_credit_crcy_akwae,
  vbrk.akkur AS ex_rate_lettofcredit_akkur,
  vbrk.kidno AS payment_reference_kidno,
  vbrk.bvtyp AS part_bank_type_bvtyp,
  vbrk.numpg AS number_of_pages_numpg,
  vbrk.bupla AS business_place_bupla,
  vbrk.vkont AS contract_account_vkont,
  vbrk.fkk_docstat AS add_fin_acc_status_fkk_docstat,
  vbrk.nrzas AS nrzas_nrzas,
  vbrk.spe_billing_ind AS ewm_billing_indicator_spe_billing_ind,
  vbrk.vtref AS contract_vtref,
  vbrk.fk_source_sys AS source_system_fk_source_sys,
  vbrk.fktyp_crm AS crm_billing_categ_fktyp_crm,
  vbrk.stgrd AS reversal_reason_stgrd,
  vbrk.j_1tpbupl AS branch_code_j_1tpbupl,
  vbrk.incov AS incoterms_version_incov,
  vbrk.inco2_l AS incoterms_location_1_inco2_l,
  vbrk.inco3_l AS incoterms_location_2_inco3_l,
  vbrk.glo_log_ref1_hd AS country_specific_reference_1_glo_log_ref1_hd,
  vbrk.dpc_rel AS dpc_relevant_dpc_rel,
  vbrk.mndid AS mandate_reference_mndid,
  vbrk.pay_type AS payment_type_pay_type,
  vbrk.sepon AS sepa_relevant_sepon,
  vbrk.mndvg AS sepa_relevant_mndvg,
  vbrk.sppaym AS payment_method_sppaym,
  vbrk.sppord AS sales_order_sppord,
  dimensional_date_erdat.cal_year AS year_of_creation_date_erdat,
  dimensional_date_erdat.cal_month AS month_of_creation_date_erdat,
  dimensional_date_erdat.cal_quarter AS quarter_of_creation_date_erdat,
  dimensional_date_erdat.cal_week AS week_of_creation_date_erdat,
  dimensional_date_fkdat.cal_year AS year_of_billing_date_fkdat,
  dimensional_date_fkdat.cal_month AS month_of_billing_date_fkdat,
  dimensional_date_fkdat.cal_quarter AS quarter_of_billing_date_fkdat,
  dimensional_date_fkdat.cal_week AS week_of_billing_date_fkdat,
  dimensional_date_aedat.cal_year AS year_of_changed_on_aedat,
  dimensional_date_aedat.cal_month AS month_of_changed_on_aedat,
  dimensional_date_aedat.cal_quarter AS quarter_of_changed_on_aedat,
  dimensional_date_aedat.cal_week AS week_of_changed_on_aedat,
  IFNULL(
    vbrk.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbrk")} AS vbrk
LEFT JOIN currency_decimal
  ON vbrk.waerk = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_erdat
  ON vbrk.erdat = dimensional_date_erdat.date
LEFT JOIN date_dimension AS dimensional_date_fkdat
  ON vbrk.fkdat = dimensional_date_fkdat.date
LEFT JOIN date_dimension AS dimensional_date_aedat
  ON vbrk.aedat = dimensional_date_aedat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbrk"])
])}
`,
);
