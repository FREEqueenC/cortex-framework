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
    "document_number_vbeln"
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
  vbak.mandt AS client_mandt,
  vbak.vbeln AS document_number_vbeln,
  vbak.erdat AS creation_date_erdat,
  vbak.erzet AS creation_time_erzet,
  vbak.ernam AS created_by_ernam,
  vbak.angdt AS quotation_date_from_angdt,
  vbak.bnddt AS quotation_date_to_bnddt,
  vbak.audat AS document_date_audat,
  vbak.vbtyp AS document_category_vbtyp,
  vbak.trvog AS transaction_group_trvog,
  vbak.auart AS document_type_auart,
  vbak.augru AS reason_augru,
  vbak.gwldt AS warranty_date_gwldt,
  vbak.submi AS collective_number_submi,
  vbak.lifsk AS delivery_block_lifsk,
  vbak.faksk AS billing_block_faksk,
  ${currency.amountWithDecimalShift("vbak.netwr", "currency_decimal")} AS net_value_of_the_sales_document_in_document_currency_netwr,
  vbak.waerk AS document_currency_waerk,
  vbak.vkorg AS sales_organization_vkorg,
  vbak.vtweg AS distribution_channel_vtweg,
  vbak.spart AS division_spart,
  vbak.vkgrp AS sales_group_vkgrp,
  vbak.vkbur AS sales_office_vkbur,
  vbak.gsber AS business_area_gsber,
  vbak.gskst AS cost_ctr_business_area_gskst,
  vbak.guebg AS agreement_valid_from_guebg,
  vbak.gueen AS agreement_valid_to_gueen,
  vbak.knumv AS condition_number_knumv,
  vbak.vdatu AS requested_delivery_date_vdatu,
  vbak.vprgr AS proposed_date_type_vprgr,
  vbak.autlf AS complete_delivery_flag_autlf,
  vbak.vbkla AS original_system_vbkla,
  vbak.vbklt AS document_indicator_vbklt,
  vbak.kalsm AS pricing_procedure_kalsm,
  vbak.vsbed AS shipping_conditions_vsbed,
  vbak.fkara AS proposed_billing_type_fkara,
  vbak.awahr AS sales_probability_awahr,
  vbak.ktext AS search_term_for_product_proposal_ktext,
  vbak.bstnk AS customer_purchase_order_number_bstnk,
  vbak.bsark AS customer_purchase_order_type_bsark,
  vbak.bstdk AS customer_purchase_order_date_bstdk,
  vbak.bstzd AS purchase_order_number_supplement_bstzd,
  vbak.ihrez AS your_reference_ihrez,
  vbak.bname AS name_of_orderer_bname,
  vbak.telf1 AS telephone_number_telf1,
  vbak.mahza AS number_of_contacts_from_the_customer_mahza,
  vbak.mahdt AS last_customer_contact_date_mahdt,
  vbak.kunnr AS sold_to_party_kunnr,
  vbak.kostl AS cost_center_kostl,
  vbak.stafo AS update_group_for_statistics_stafo,
  vbak.stwae AS statistic_scurrency_stwae,
  vbak.aedat AS changed_on_aedat,
  vbak.kvgr1 AS customer_group1_kvgr1,
  vbak.kvgr2 AS customer_group2_kvgr2,
  vbak.kvgr3 AS customer_group3_kvgr3,
  vbak.kvgr4 AS customer_group4_kvgr4,
  vbak.kvgr5 AS customer_group5_kvgr5,
  vbak.knuma AS agreement_knuma,
  vbak.kokrs AS controlling_area_kokrs,
  vbak.ps_psp_pnr AS wbs_element_ps_psp_pnr,
  vbak.kurst AS exchange_rate_type_kurst,
  vbak.kkber AS credit_control_area_kkber,
  vbak.knkli AS customer_credit_limit_ref_knkli,
  vbak.grupp AS customer_credit_group_grupp,
  vbak.sbgrp AS credit_representative_group_for_credit_management_sbgrp,
  vbak.ctlpc AS risk_category_ctlpc,
  vbak.cmwae AS currency_key_of_credit_control_area_cmwae,
  vbak.cmfre AS rele_a_se_date_of_the_document_determined_by_credit_management_cmfre,
  vbak.cmnup AS date_of_next_credit_check_of_document_cmnup,
  vbak.cmngv AS next_date_cmngv,
  vbak.amtbl AS released_credit_value_of_the_document_amtbl,
  vbak.hityp_pr AS hierarchy_type_for_pricing_hityp_pr,
  vbak.abrvw AS usage_indicator_abrvw,
  vbak.abdis AS mrp_for_delivery_schedule_types_abdis,
  vbak.vgbel AS document_number_of_the_reference_document_vgbel,
  vbak.objnr AS object_number_at_header_level_objnr,
  vbak.bukrs_vf AS company_code_to_be_billed_bukrs_vf,
  vbak.taxk1 AS alternative_tax_classification_taxk1,
  vbak.taxk2 AS tax_classification2_taxk2,
  vbak.taxk3 AS tax_classification3_taxk3,
  vbak.taxk4 AS tax_classification4_taxk4,
  vbak.taxk5 AS tax_classification5_taxk5,
  vbak.taxk6 AS tax_classification6_taxk6,
  vbak.taxk7 AS tax_classification7_taxk7,
  vbak.taxk8 AS tax_classification8_taxk8,
  vbak.taxk9 AS tax_classification9_taxk9,
  vbak.xblnr AS reference_document_number_xblnr,
  vbak.zuonr AS assignment_number_zuonr,
  vbak.vgtyp AS pre_doc_category_vgtyp,
  vbak.aufnr AS order_number_aufnr,
  vbak.qmnum AS notification_no_qmnum,
  vbak.vbeln_grp AS master_contract_number_vbeln_grp,
  vbak.stceg_l AS tax_destination_country_stceg_l,
  vbak.landtx AS tax_departure_country_landtx,
  vbak.handle AS international_unique_key_handle,
  vbak.proli AS dangerous_goods_management_profile_proli,
  vbak.cont_dg AS dangerous_goods_flag_cont_dg,
  vbak.upd_tmstmp AS utc_time_stamp_l_upd_tmstmp,
  dimensional_date_erdat.cal_year AS year_of_creation_date_erdat,
  dimensional_date_erdat.cal_month AS month_of_creation_date_erdat,
  dimensional_date_erdat.cal_quarter AS quarter_of_creation_date_erdat,
  dimensional_date_erdat.cal_week AS week_of_creation_date_erdat,
  dimensional_date_audat.cal_year AS year_of_document_date_audat,
  dimensional_date_audat.cal_month AS month_of_document_date_audat,
  dimensional_date_audat.cal_quarter AS quarter_of_document_date_audat,
  dimensional_date_audat.cal_week AS week_of_document_date_audat,
  dimensional_date_vdatu.cal_year AS year_of_requested_delivery_date_vdatu,
  dimensional_date_vdatu.cal_month AS month_of_requested_delivery_date_vdatu,
  dimensional_date_vdatu.cal_quarter AS quarter_of_requested_delivery_date_vdatu,
  dimensional_date_vdatu.cal_week AS week_of_requested_delivery_date_vdatu,    
  IFNULL(
    vbak.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbak")} AS vbak
LEFT JOIN currency_decimal
  ON vbak.waerk = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_erdat
  ON vbak.erdat = dimensional_date_erdat.date
LEFT JOIN date_dimension AS dimensional_date_audat
  ON vbak.audat = dimensional_date_audat.date
LEFT JOIN date_dimension AS dimensional_date_vdatu
  ON vbak.vdatu = dimensional_date_vdatu.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbak"])
])}
`,
);
