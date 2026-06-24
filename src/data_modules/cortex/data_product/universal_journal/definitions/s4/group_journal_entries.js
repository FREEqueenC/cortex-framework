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
    "client_rclnt",
    "ledger_rldnr",
    "dimension_rdimen",
    "fiscal_year_ryear",
    "document_number_docnr",
    "line_item_docln",
    "language_key_langu"
  ]
);

publish("group_journal_entries", publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  acdocu.rclnt AS client_rclnt,
  acdocu.rldnr AS ledger_rldnr,
  acdocu.rdimen AS dimension_rdimen,
  acdocu.ryear AS fiscal_year_ryear,
  acdocu.docnr AS document_number_docnr,
  acdocu.docln AS line_item_docln,
  tf201.langu AS language_key_langu,
  acdocu.rrcty AS record_type_rrcty,
  acdocu.rvers AS version_rvers,
  tf201.txt AS version_description_txt,
  acdocu.rtcur AS balance_transaction_currency_rtcur,
  acdocu.rhcur AS local_currency_rhcur,
  acdocu.rkcur AS group_currency_rkcur,
  acdocu.runit AS base_unit_of_measure_runit,
  acdocu.poper AS posting_period_poper,
  acdocu.fiscyearper AS period_year_fiscyearper,
  acdocu.docct AS document_category_docct,
  acdocu.rcomp AS company_rcomp,
  acdocu.rbunit AS consolidation_unit_rbunit,
  acdocu.ritclg AS chart_of_accounts_ritclg,
  acdocu.ritem AS fs_item_ritem,
  acdocu.rbuptr AS partner_unit_rbuptr,
  acdocu.rcongr AS consolidation_group_rcongr,
  acdocu.robukrs AS original_company_code_robukrs,
  acdocu.sityp AS subitem_type_sityp,
  acdocu.subit AS subitem_subit,
  acdocu.plevl AS posting_level_plevl,
  acdocu.rpflg AS apportionment_flag_rpflg,
  acdocu.rtflg AS translation_flag_rtflg,
  acdocu.docty AS document_type_docty,
  acdocu.yracq AS acquisition_year_yracq,
  acdocu.pracq AS acquisition_period_pracq,
  acdocu.coicu AS investee_unit_coicu,
  acdocu.uppcu AS investor_unit_uppcu,
  ${currency.amountWithDecimalShift("acdocu.tsl", "currency_decimal_rtcur")} AS amount_in_balance_transaction_currency_tsl,
  ${currency.amountWithDecimalShift("acdocu.hsl", "currency_decimal_rhcur")} AS amount_in_local_currency_hsl,
  ${currency.amountWithDecimalShift("acdocu.ksl", "currency_decimal_rkcur")} AS amount_in_group_currency_ksl,
  acdocu.msl AS quantity_msl,
  acdocu.sgtxt AS text_sgtxt,
  acdocu.autom AS automatic_posting_autom,
  acdocu.activ AS transaction_activ,
  acdocu.bvorg AS cross_company_document_number_bvorg,
  acdocu.budat AS posting_date_budat,
  acdocu.wsdat AS value_date_wsdat,
  acdocu.refdocnr AS reference_document_number_refdocnr,
  acdocu.refryear AS reference_fiscal_year_refryear,
  acdocu.refdocln AS reference_line_item_refdocln,
  acdocu.refdocct AS reference_document_category_refdocct,
  acdocu.refactiv AS reference_transaction_refactiv,
  acdocu.timestamp AS timestamp_timestamp,
  acdocu.cpudt AS entry_date_cpudt,
  acdocu.cputm AS entry_time_cputm,
  acdocu.usnam AS user_name_usnam,
  acdocu.rvsdocnr AS reversal_document_number_rvsdocnr,
  acdocu.orndocnr AS original_document_number_orndocnr,
  acdocu.bunnr AS document_bundle_number_bunnr,
  acdocu.coiac AS co_activity_coiac,
  acdocu.coinr AS co_activity_number_coinr,
  acdocu.revyear AS reversal_year_revyear,
  acdocu.awtyp AS reference_procedure_awtyp,
  acdocu.aworg AS reference_org_unit_aworg,
  acdocu.logsys AS logical_system_logsys,
  acdocu.ktopl AS chart_of_accounts_ktopl,
  acdocu.racct AS account_racct,
  acdocu.xblnr AS reference_xblnr,
  acdocu.zuonr AS assignment_zuonr,
  acdocu.rcntr AS cost_center_rcntr,
  acdocu.prctr AS profit_center_prctr,
  acdocu.rfarea AS functional_area_rfarea,
  acdocu.rbusa AS business_area_rbusa,
  acdocu.kokrs AS controlling_area_kokrs,
  acdocu.segment AS segment_segment,
  acdocu.scntr AS sender_cost_center_scntr,
  acdocu.pprctr AS partner_profit_center_pprctr,
  acdocu.sfarea AS partner_functional_area_sfarea,
  acdocu.sbusa AS partner_business_area_sbusa,
  acdocu.rassc AS trading_partner_rassc,
  acdocu.psegment AS partner_segment_psegment,
  acdocu.aufnr AS order_aufnr,
  acdocu.kunnr AS customer_kunnr,
  acdocu.lifnr AS vendor_lifnr,
  acdocu.matnr AS material_matnr,
  acdocu.matkl_mm AS material_group_matkl_mm,
  acdocu.werks AS plant_werks,
  acdocu.rmvct AS transaction_type_rmvct,
  acdocu.ps_psp_pnr AS wbs_element_ps_psp_pnr,
  acdocu.ps_posid AS wbs_element_ps_posid,
  acdocu.ps_pspid AS project_definition_ps_pspid,
  acdocu.fkart AS billing_type_fkart,
  acdocu.vkorg AS sales_organization_vkorg,
  acdocu.vtweg AS distribution_channel_vtweg,
  acdocu.spart AS division_spart,
  acdocu.matnr_copa AS product_sold_matnr_copa,
  acdocu.matkl AS product_sold_group_matkl,
  acdocu.kdgrp AS customer_group_kdgrp,
  acdocu.land1 AS country_land1,
  acdocu.brsch AS industry_brsch,
  acdocu.bzirk AS sales_district_bzirk,
  acdocu.kunre AS bill_to_party_kunre,
  acdocu.kunwe AS ship_to_party_kunwe,
  acdocu.konzs AS group_key_konzs,
  acdocu.adhocitem AS ad_hoc_item_adhocitem,
  acdocu.adhocset AS ad_hoc_set_adhocset,
  acdocu.adhocsetitem AS ad_hoc_set_item_adhocsetitem,
  acdocu.rcode AS reason_code_rcode,
  acdocu.orig_type AS original_type_orig_type,
  acdocu.orig_ref AS original_reference_orig_ref,
  acdocu.dummy_cje_incl_eew_ps AS dummy_dummy_cje_incl_eew_ps,
  tf200.strvs AS structure_version_strvs,
  tf200.inpvs AS data_entry_version_inpvs,
  tf200.ctrvs AS translation_method_version_ctrvs,
  tf200.curvs AS exchange_rate_version_curvs,
  tf200.ldrvs AS ledger_version_ldrvs,
  tf200.fixvs AS fix_version_fixvs,
  tf200.taxvs AS tax_rate_version_taxvs,
  tf200.coivs AS consolidation_of_investments_version_coivs,
  tf200.invvs AS invest_version_invvs,
  tf200.equvs AS equity_change_version_equvs,
  tf200.gwavs AS goodwill_version_gwavs,
  tf200.hirvs AS hidden_reserves_version_hirvs,
  tf200.rhrvs AS hidden_reserves_reversal_version_rhrvs,
  tf200.assvs AS equity_holding_version_assvs,
  tf200.rclvs AS reclassification_version_rclvs,
  tf200.ipivs AS ipi_version_ipivs,
  tf200.atrvs AS attribute_version_atrvs,
  tf200.rrlvs AS report_rule_version_rrlvs,
  tf200.impvs AS fs_item_mapping_version_impvs,
  tf200.iatvs AS fs_item_attribute_version_iatvs,
  tf200.dbsvs AS base_version_dbsvs,
  tf200.bcfind AS carry_forward_version_bcfind,
  tf200.cpyrd AS copy_version_cpyrd,
  tf200.cpyce AS copy_consolidation_entries_version_cpyce,
  tf200.ovrrd AS overwrite_version_ovrrd,
  tf200.ovrce AS overwrite_consolidation_entries_version_ovrce,
  tf200.planvers AS plan_version_planvers,
  tf200.category_src AS source_category_category_src,
  tf200.rldnr_src AS source_ledger_rldnr_src,
  tf200.periv AS fiscal_year_variant_periv,
  tf200.ref_version AS reference_version_ref_version,
  tf200.ext_version_type AS external_version_type_ext_version_type,
  tf200.exec_mode AS execution_mode_exec_mode,
  tf200.group_curr AS version_group_currency_group_curr,
  tf200.rldnr_source AS source_ledger_rldnr_source,
  tf200.rldnr_cons AS consolidation_ledger_rldnr_cons,
  tf200.cuavs AS consolidation_unit_attributes_cuavs,
  fincs_ref_vers_r.group_curr AS reference_version_group_currency_group_curr,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  GREATEST(
    IFNULL(acdocu.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tf200.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tf201.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(fincs_ref_vers_r.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "acdocu")} AS acdocu
LEFT JOIN currency_decimal AS currency_decimal_rtcur
  ON acdocu.rtcur = currency_decimal_rtcur.currkey
LEFT JOIN currency_decimal AS currency_decimal_rhcur
  ON acdocu.rhcur = currency_decimal_rhcur.currkey
LEFT JOIN currency_decimal AS currency_decimal_rkcur
  ON acdocu.rkcur = currency_decimal_rkcur.currkey
LEFT JOIN date_dimension AS dimensional_date_budat
  ON acdocu.budat = dimensional_date_budat.date
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tf200")} AS tf200
  ON acdocu.rclnt = tf200.mandt
  AND acdocu.rvers = tf200.rvers
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tf201")} AS tf201
  ON acdocu.rclnt = tf201.mandt
  AND acdocu.rvers = tf201.rvers
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "fincs_ref_vers_r")} AS fincs_ref_vers_r
  ON tf200.mandt = fincs_ref_vers_r.mandt
  AND tf200.ref_version = fincs_ref_vers_r.version
  AND tf200.rvers = fincs_ref_vers_r.versionelement
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["acdocu", "tf200", "tf201", "fincs_ref_vers_r"])
])}
`
);
