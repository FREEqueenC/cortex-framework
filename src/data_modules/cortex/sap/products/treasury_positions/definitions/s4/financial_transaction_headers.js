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
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs",
    "transaction_rfha"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  vtbfha.mandt AS client_mandt,
  vtbfha.bukrs AS company_code_bukrs,
  vtbfha.rfha AS transaction_rfha,
  vtbfha.cruser AS entered_by_cruser,
  vtbfha.dcrdat AS entered_on_dcrdat,
  vtbfha.tcrtim AS entry_time_tcrtim,
  vtbfha.upuser AS last_changed_by_upuser,
  vtbfha.dupdat AS changed_on_dupdat,
  vtbfha.tuptim AS time_changed_tuptim,
  vtbfha.rantyp AS contract_type_rantyp,
  vtbfha.sanlf AS product_category_sanlf,
  vtbfha.sfgtyp AS transaction_category_sfgtyp,
  vtbfha.sgsart AS product_type_sgsart,
  vtbfha.sfhaart AS transaction_type_sfhaart,
  vtbfha.rgatt AS class_rgatt,
  vtbfha.rmaid AS master_agreement_rmaid,
  vtbfha.rfhazunr AS activity_number_status_rfhazunr,
  vtbfha.rfhazul AS active_activity_rfhazul,
  vtbfha.saktiv AS active_status_saktiv,
  vtbfha.kontrh AS business_partner_kontrh,
  vtbfha.srolext AS three_byte_field_srolext,
  vtbfha.rgarant AS guarantor_rgarant,
  vtbfha.rrefkont AS account_assignment_reference_rrefkont,
  vtbfha.rrefkont2 AS account_assignment_reference_rrefkont2,
  vtbfha.rportb AS portfolio_rportb,
  vtbfha.wgschft AS transaction_currency_wgschft,
  vtbfha.wgschft1 AS outgoing_currency_wgschft1,
  vtbfha.wgschft2 AS incoming_currency_wgschft2,
  vtbfha.amtinput AS traded_amount_indicator_amtinput,
  vtbfha.dblfz AS term_start_dblfz,
  vtbfha.skalid AS calendar_skalid,
  vtbfha.skalid2 AS calendar_skalid2,
  vtbfha.jlimit AS limit_indicator_jlimit,
  vtbfha.akuend AS period_of_notice_akuend,
  vtbfha.skuend AS unit_skuend,
  vtbfha.objnr AS object_number_objnr,
  vtbfha.rldepo AS securities_account_rldepo,
  vtbfha.zuonr AS finance_project_zuonr,
  vtbfha.delfz AS term_end_delfz,
  vtbfha.abwtyp AS processing_category_abwtyp,
  vtbfha.tbegru AS authorization_group_tbegru,
  vtbfha.vrfha AS reference_transaction_vrfha,
  vtbfha.sinclbe AS end_inclusive_sinclbe,
  vtbfha.snpvcal AS npv_calculation_snpvcal,
  vtbfha.srndng AS round_srndng,
  vtbfha.zuond AS assignment_zuond,
  vtbfha.refer AS internal_reference_refer,
  vtbfha.merkm AS characteristics_merkm,
  vtbfha.sfrgzust AS release_status_sfrgzust,
  vtbfha.ranl AS sec_class_id_number_ranl,
  vtbfha.rcomvalcl AS general_valuation_class_rcomvalcl,
  vtbfha.facilitynr AS facility_facilitynr,
  vtbfha.facilitybukrs AS company_code_of_facility_facilitybukrs,
  vtbfha.posacc AS futures_account_posacc,
  vtbfha.rcomvalcl2 AS general_valuation_class_rcomvalcl2,
  vtbfha.fund AS fund,
  vtbfha.grant_nbr AS grant_grant_nbr,
  vtbfha.timestamp_deal AS time_stamp_timestamp_deal,
  vtbfha.rportb2 AS portfolio_rportb2,
  vtbfha.clearing_option AS clearing_option,
  vtbfha.clearing_status AS clearing_status,
  vtbfha.clearing_date AS planned_clearing_date,
  vtbfha.ext_account AS external_account_ext_account,
  vtbfha.clear_date_act AS actual_clearing_date_clear_date_act,
  vtbfha.scondition AS financial_transaction_is_based_on_a_condition_scondition,
  vtbfha.risk_mitigating AS risk_mitigation_risk_mitigating,
  vtbfha.fima_calculation AS cash_flow_calculation_fima_calculation,
  vtbfha.trustee AS trustee_number_trustee,
  vtbfha.prctr AS profit_center_prctr,
  vtbfha.rcntr AS cost_center_rcntr,
  vtbfha.ps_posid AS wbs_element_ps_posid,
  vtbfha.rbusa AS business_area_rbusa,
  vtbfha.hedge_class AS hedging_classification_hedge_class,
  vtbfha.init_classifier AS initial_stage_init_classifier,
  vtbfha.country AS country_region_key_country,
  vtbfha.fb_segment AS segment_fb_segment,
  vtbfha.behalf_of_company AS on_behalf_of_company_code_behalf_of_company,
  vtbfha.traded_currency AS traded_currency,
  vtbfha.hedge_request_id AS hedge_request_id,
  vtbfha.cfi_code AS cfi_code,
  vtbfha.isin AS security_id_isin,
  vtbfha.mic AS market_identifier_code_mic,
  vtbfha.contract_timestamp_utc AS contract_timestamp_utc,
  vtbfha.bupla AS business_place_bupla,
  IFNULL(
    vtbfha.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vtbfha")} AS vtbfha
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vtbfha"])
])}
`
);
