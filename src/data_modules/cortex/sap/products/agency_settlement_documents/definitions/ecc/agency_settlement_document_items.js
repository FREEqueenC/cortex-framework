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
    "settlement_document_wbeln",
    "document_item_posnr"
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
  wbrp.mandt AS client_mandt,
  wbrp.wbeln AS settlement_document_wbeln,
  wbrp.posnr AS document_item_posnr,
  wbrp.matnr AS material_matnr,
  wbrp.matkl AS material_group_matkl,
  wbrp.werks AS plant_werks,
  wbrp.mwskz AS input_tax_code_mwskz,
  wbrp.mwsk2 AS output_tax_code_mwsk2,
  wbrp.prsdt AS pricing_date_prsdt,
  wbrp.menge AS invoiced_quantity_menge,
  ${currency.amountWithDecimalShift("wbrp.netpr", "currency_decimal")} AS bill_net_price_netpr,
  wbrp.peinh AS price_unit_peinh,
  wbrp.wfkme AS billing_unit_wfkme,
  wbrp.umrez AS corresponds_to_umrez,
  wbrp.umren AS denominator_umren,
  wbrp.fprme AS billing_price_unit_fprme,
  wbrp.fpumz AS quantity_conversion_fpumz,
  wbrp.fpumn AS quantity_conversion_fpumn,
  wbrp.meins AS base_unit_of_measure_meins,
  wbrp.ntgew AS net_weight_ntgew,
  wbrp.brgew AS gross_weight_brgew,
  wbrp.gewei AS weight_unit_gewei,
  wbrp.volum AS volume_volum,
  wbrp.voleh AS volume_unit_voleh,
  wbrp.stafo AS update_group_stats_stafo,
  wbrp.mtart AS material_type_mtart,
  ${currency.amountWithDecimalShift("wbrp.netwr", "currency_decimal")} AS net_value_netwr,
  ${currency.amountWithDecimalShift("wbrp.brtwr", "currency_decimal")} AS gross_value_brtwr,
  ${currency.amountWithDecimalShift("wbrp.kzwi1", "currency_decimal")} AS subtotal_1_kzwi1,
  ${currency.amountWithDecimalShift("wbrp.kzwi2", "currency_decimal")} AS subtotal_2_kzwi2,
  ${currency.amountWithDecimalShift("wbrp.kzwi3", "currency_decimal")} AS subtotal_3_kzwi3,
  ${currency.amountWithDecimalShift("wbrp.kzwi4", "currency_decimal")} AS subtotal_4_kzwi4,
  ${currency.amountWithDecimalShift("wbrp.kzwi5", "currency_decimal")} AS subtotal_5_kzwi5,
  ${currency.amountWithDecimalShift("wbrp.kzwi6", "currency_decimal")} AS subtotal_6_kzwi6,
  ${currency.amountWithDecimalShift("wbrp.bonba", "currency_decimal")} AS rebate_basis_bonba,
  ${currency.amountWithDecimalShift("wbrp.effwr", "currency_decimal")} AS effective_value_effwr,
  wbrp.ernam AS created_by_ernam,
  wbrp.erdat AS created_on_erdat,
  wbrp.erzet AS time_erzet,
  wbrp.kowrr AS item_control_kowrr,
  wbrp.sktof AS cash_discount_sktof,
  ${currency.amountWithDecimalShift("wbrp.skfbp", "currency_decimal")} AS cash_discbasis_skfbp,
  ${currency.amountWithDecimalShift("wbrp.netwrd", "currency_decimal")} AS net_value_netwrd,
  ${currency.amountWithDecimalShift("wbrp.brtwrd", "currency_decimal")} AS gross_value_brtwrd,
  ${currency.amountWithDecimalShift("wbrp.kzwi1d", "currency_decimal")} AS subtotal_1_kzwi1d,
  ${currency.amountWithDecimalShift("wbrp.kzwi2d", "currency_decimal")} AS subtotal_2_kzwi2d,
  ${currency.amountWithDecimalShift("wbrp.kzwi3d", "currency_decimal")} AS subtotal_3_kzwi3d,
  ${currency.amountWithDecimalShift("wbrp.kzwi4d", "currency_decimal")} AS subtotal_4_kzwi4d,
  ${currency.amountWithDecimalShift("wbrp.kzwi5d", "currency_decimal")} AS subtotal_5_kzwi5d,
  ${currency.amountWithDecimalShift("wbrp.kzwi6d", "currency_decimal")} AS subtotal_6_kzwi6d,
  ${currency.amountWithDecimalShift("wbrp.bonbad", "currency_decimal")} AS rebate_basis_bonbad,
  ${currency.amountWithDecimalShift("wbrp.skfbpd", "currency_decimal")} AS discount_base_skfbpd,
  ${currency.amountWithDecimalShift("wbrp.effwrd", "currency_decimal")} AS effective_value_effwrd,
  ${currency.amountWithDecimalShift("wbrp.mwsbpd", "currency_decimal")} AS tax_amount_mwsbpd,
  wbrp.wbelnv AS reference_document_wbelnv,
  wbrp.posnrv AS reference_doc_item_posnrv,
  wbrp.lftypv AS preceding_doccateg_lftypv,
  wbrp.gjahrv AS fiscal_year_gjahrv,
  wbrp.aktnr AS promotion_aktnr,
  wbrp.lfgru AS activity_reason_lfgru,
  wbrp.arktx AS short_text_arktx,
  wbrp.infnr AS purchasing_info_rec_infnr,
  wbrp.idnlf AS vendor_material_no_idnlf,
  ${currency.amountWithDecimalShift("wbrp.mwsbp", "currency_decimal")} AS tax_amount_mwsbp,
  wbrp.txjcd AS tax_jurisdiction_txjcd,
  wbrp.ebonf AS subseq_settlement_ebonf,
  wbrp.bonus AS settlement_group_1_bonus,
  wbrp.ebon2 AS settlement_group_2_ebon2,
  wbrp.ebon3 AS settlement_group_3_ebon3,
  wbrp.ltsnr AS vendor_subrange_ltsnr,
  wbrp.ekkol AS condition_group_ekkol,
  wbrp.punei AS points_unit_punei,
  wbrp.anzpu AS points_anzpu,
  wbrp.kolif AS prior_vendor_kolif,
  ${currency.amountWithDecimalShift("wbrp.navnw", "currency_decimal")} AS non_deductible_navnw,
  wbrp.bwtar AS valuation_type_bwtar,
  wbrp.bwtty AS valuation_category_bwtty,
  wbrp.gsber AS business_area_gsber,
  wbrp.paobjnr AS profitab_segmt_no_paobjnr,
  wbrp.kostl AS cost_center_kostl,
  wbrp.prctr AS profit_center_prctr,
  wbrp.kokrs AS controlling_area_kokrs,
  wbrp.charg AS batch_charg,
  wbrp.wuvprs AS incompl_price_detrm_wuvprs,
  wbrp.wbeln_v AS document_wbeln_v,
  wbrp.posnr_v AS item_posnr_v,
  wbrp.ftypv_v AS reference_doc_cat_ftypv_v,
  wbrp.itemcat AS item_category_itemcat,
  wbrp.matbf AS stock_material_matbf,
  ${currency.amountWithDecimalShift("wbrp.mwert_im", "currency_decimal")} AS net_value_mwert_im,
  ${currency.amountWithDecimalShift("wbrp.mwert_pr", "currency_decimal")} AS net_value_mwert_pr,
  ${currency.amountWithDecimalShift("wbrp.mwert_um", "currency_decimal")} AS net_value_mwert_um,
  wbrp.contract AS contract,
  wbrp.contract_type AS contract_type,
  wbrp.contract_item AS item_contract_item,
  wbrp.idnlf_type AS type_vendor_matno_idnlf_type,
  wbrp.item_status AS status_item_status,
  wbrp.item_canceled AS item_item_canceled,
  wbrp.guid_ref AS guid_reference_doc_guid_ref,
  wbrp.bemot AS accounting_indicator_bemot,
  wbrp.aufnr AS order_aufnr,
  wbrp.settl_status_i_v AS settlement_status_item_vendor_settl_status_i_v,
  wbrp.settl_status_i_c AS settlement_status_item_customer_settl_status_i_c,
  wbrp.settl_block_i_v AS settlement_block_item_vendor_settl_block_i_v,
  wbrp.settl_block_i_c AS settlement_block_item_customer_settl_block_i_c,
  wbrp.settl_item_rel AS item_settlement_relevance_settl_item_rel,
  wbrp.cuobj AS configuration_cuobj,
  wbrp.fbuda AS servrendered_date_fbuda,
  wbrp.j_1bnbm AS ncm_code_j_1bnbm,
  wbrp.j_1bmatuse AS material_usage_j_1bmatuse,
  wbrp.j_1bmatorg AS material_origin_j_1bmatorg,
  wbrp.j_1bownpro AS produced_in_house_j_1bownpro,
  wbrp.j_1bindust AS mat_cfop_category_j_1bindust,
  wbrp.j_1bcfop AS cfop_j_1bcfop,
  wbrp.j_1btxsdc AS tax_code_j_1btxsdc,
  wbrp.j_1btaxlw1 AS icms_law_j_1btaxlw1,
  wbrp.j_1btaxlw2 AS ipi_law_j_1btaxlw2,
  wbrp.j_1btaxlw3 AS iss_law_j_1btaxlw3,
  wbrp.j_1btaxlw4 AS cofins_law_j_1btaxlw4,
  wbrp.j_1btaxlw5 AS pis_law_j_1btaxlw5,
  wbrp.sakto AS g_l_account_sakto,
  wbrp.servconf_item AS conf_item_servconf_item,
  wbrp.status AS status,
  wbrp.iv_check_type_i AS type_of_check_item_iv_check_type_i,
  wbrp.refsite AS purchasing_reference_site_refsite,
  wbrp.gjahr AS fiscal_year_of_settlement_gjahr,
  wbrp.posnr_main AS main_item_for_item_posnr_main,
  wbrp.posnr_sub_exist AS subitems_exist_posnr_sub_exist,
  wbrp.distrib_status AS status_distribution_distrib_status,
  wbrp.no_text_i AS no_texts_exist_no_text_i,
  wbrp.cwm_menge AS qty_in_puom_cwm_menge,
  wbrp.cwm_meins AS parallel_uom_cwm_meins,
  wbrp.cwm_uom_type AS type_of_parallel_uom_cwm_uom_type,
  wbrp.ref_number AS reference_document_ref_number,
  wbrp.ref_item_number AS item_ref_item_number,
  wbrp.ref_type AS reference_category_ref_type,
  wbrp.item_intra_rel AS intrastat_item_intra_rel,
  ${currency.amountWithDecimalShift("wbrp.grwrt", "currency_decimal")} AS statistical_value_grwrt,
  ${currency.amountWithDecimalShift("wbrp.grwrtd", "currency_decimal")} AS statistcl_value_customer_grwrtd,
  wbrp.posting_rule_k_i AS creditor_posting_rule_posting_rule_k_i,
  wbrp.posting_rule_d_i AS debtor_posting_rule_posting_rule_d_i,
  wbrp.weight_volume AS level_for_weight_volume,
  wbrp.ps_psp_pnr AS wbs_element_ps_psp_pnr,
  wbrp.inco1_p AS incoterms_inco1_p,
  wbrp.inco2_p AS incoterms_part_2_inco2_p,
  wbrp.kokrsd AS customer_controlling_area_kokrsd,
  wbrp.prctrd AS cust_profit_center_prctrd,
  wbrp.kostld AS customer_cost_center_kostld,
  wbrp.paobjnrd AS customer_prof_segment_no_paobjnrd,
  wbrp.aufnrd AS customer_order_aufnrd,
  wbrp.ps_psp_pnrd AS customer_wbs_element_ps_psp_pnrd,
  wbrp.gsberd AS customer_business_area_gsberd,
  wbrp.coll_status_i AS status_collection_item_coll_status_i,
  wbrp.coll_block_i AS block_item_collection_coll_block_i,
  wbrp.coll_rel AS relevance_for_coll_of_settlement_req_coll_rel,
  wbrp.customer AS customer,
  wbrp.invc_item_id AS ext_invoice_item_invc_item_id,
  wbrp.reference_id AS item_ref_doc_reference_id,
  wbrp.ref_item_id AS item_ref_item_id,
  wbrp.scheme_id AS scheme_scheme_id,
  wbrp.scheme_a_id AS scheme_id_scheme_a_id,
  wbrp.agency_id_code AS agency_id_agency_id_code,
  wbrp.ref_number_2 AS addreference_document_ref_number_2,
  wbrp.ref_item_num_2 AS item_ref_item_num_2,
  wbrp.ref_type_2 AS reference_category_ref_type_2,
  dimensional_date_erdat.cal_year AS year_of_created_on_erdat,
  dimensional_date_erdat.cal_month AS month_of_created_on_erdat,
  dimensional_date_erdat.cal_quarter AS quarter_of_created_on_erdat,
  dimensional_date_erdat.cal_week AS week_of_created_on_erdat,
  dimensional_date_prsdt.cal_year AS year_of_pricing_date_prsdt,
  dimensional_date_prsdt.cal_month AS month_of_pricing_date_prsdt,
  dimensional_date_prsdt.cal_quarter AS quarter_of_pricing_date_prsdt,
  dimensional_date_prsdt.cal_week AS week_of_pricing_date_prsdt,
  dimensional_date_fbuda.cal_year AS year_of_services_rendered_date_fbuda,
  dimensional_date_fbuda.cal_month AS month_of_services_rendered_date_fbuda,
  dimensional_date_fbuda.cal_quarter AS quarter_of_services_rendered_date_fbuda,
  dimensional_date_fbuda.cal_week AS week_of_services_rendered_date_fbuda,
  GREATEST(
    IFNULL(wbrp.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(wbrk.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wbrp")} AS wbrp
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wbrk")} AS wbrk
  ON wbrp.mandt = wbrk.mandt
  AND wbrp.wbeln = wbrk.wbeln
LEFT JOIN currency_decimal
  ON wbrk.waerl = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_erdat
  ON wbrp.erdat = dimensional_date_erdat.date
LEFT JOIN date_dimension AS dimensional_date_prsdt
  ON wbrp.prsdt = dimensional_date_prsdt.date
LEFT JOIN date_dimension AS dimensional_date_fbuda
  ON wbrp.fbuda = dimensional_date_fbuda.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wbrp", "wbrk"])
])}
`,
);
