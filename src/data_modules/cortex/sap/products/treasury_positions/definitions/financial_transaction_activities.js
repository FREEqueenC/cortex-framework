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
    "company_code_bukrs",
    "transaction_rfha",
    "activity_rfhazu",
    "entered_on_dcrdat",
    "entry_time_tcrtim"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  vtbfhazu.mandt AS client_mandt,
  vtbfhazu.bukrs AS company_code_bukrs,
  vtbfhazu.rfha AS transaction_rfha,
  vtbfhazu.rfhazu AS activity_rfhazu,
  vtbfhazu.cruser AS entered_by_cruser,
  vtbfhazu.dcrdat AS entered_on_dcrdat,
  vtbfhazu.tcrtim AS entry_time_tcrtim,
  vtbfhazu.upuser AS last_changed_by_upuser,
  vtbfhazu.dupdat AS changed_on_dupdat,
  vtbfhazu.tuptim AS time_changed_tuptim,
  vtbfhazu.sgsart AS product_type_sgsart,
  vtbfhazu.sfhaart AS transaction_type_sfhaart,
  vtbfhazu.sfgzustt AS activity_category_sfgzustt,
  vtbfhazu.sfunktv AS transition_function_sfunktv,
  vtbfhazu.sfunktl AS last_function_sfunktl,
  vtbfhazu.rofhazu AS previous_activity_rofhazu,
  vtbfhazu.rfhazux AS supplemented_activ_rfhazux,
  vtbfhazu.saktiv AS active_status_saktiv,
  vtbfhazu.sstogrd AS reason_for_reversal_sstogrd,
  vtbfhazu.rdealer AS trader_rdealer,
  vtbfhazu.dvtrab AS contract_date_dvtrab,
  vtbfhazu.tvtrab AS contract_concl_time_tvtrab,
  vtbfhazu.gsppart AS contact_person_gsppart,
  vtbfhazu.xakt AS file_number_xakt,
  vtbfhazu.nordext AS external_reference_nordext,
  vtbfhazu.dblfz AS term_start_dblfz,
  vtbfhazu.delfz AS term_end_delfz,
  vtbfhazu.dfix AS fixing_date_dfix,
  vtbfhazu.fixing_ref_id AS fixing_reference_id_fixing_ref_id,
  vtbfhazu.sincle AS term_end_inclusive_sincle,
  vtbfhazu.dzstnd AS activity_transition_dzstnd,
  vtbfhazu.sznspro AS interest_rollover_sznspro,
  vtbfhazu.dznsstd AS defer_int_payment_date_dznsstd,
  vtbfhazu.kkurs AS transaction_rate_kkurs,
  vtbfhazu.kkassa AS spot_rate_kkassa,
  vtbfhazu.kswap AS swap_rate_kswap,
  vtbfhazu.wlwaers AS leading_currency_wlwaers,
  vtbfhazu.wfwaers AS following_currency_wfwaers,
  vtbfhazu.limitart AS limit_type_limitart,
  vtbfhazu.limitdat AS limit_date_limitdat,
  vtbfhazu.rkondgr AS direction_rkondgr,
  vtbfhazu.liwaers AS reference_currency_liwaers,
  vtbfhazu.kwliqui AS liquidity_effect_kwliqui,
  vtbfhazu.sconfirm AS confirmation_status_sconfirm,
  vtbfhazu.dexdat AS confirmation_date_dexdat,
  vtbfhazu.uexnam AS user_uexnam,
  vtbfhazu.sreconfirm AS counterconfirmation_sreconfirm,
  vtbfhazu.dredat AS counterconfirm_date_dredat,
  vtbfhazu.urenam AS user_urenam,
  vtbfhazu.dorder AS order_date_dorder,
  vtbfhazu.danst AS reservation_date_danst,
  vtbfhazu.tanst AS order_time_tanst,
  vtbfhazu.sanst AS reservation_reason_sanst,
  vtbfhazu.sspesen AS expenses_key_sspesen,
  vtbfhazu.buprclim AS limit_price_buprclim,
  vtbfhazu.srunitlim AS currency_unit_srunitlim,
  vtbfhazu.bpprclim AS limit_price_bpprclim,
  vtbfhazu.jverk6b AS sale_6b_jverk6b,
  vtbfhazu.peffzins AS effect_interest_rate_peffzins,
  vtbfhazu.peffzins_given AS given_effective_ir_peffzins_given,
  vtbfhazu.peffzcall AS eff_ir_termination_peffzcall,
  vtbfhazu.seffmeth AS effect_int_method_seffmeth,
  vtbfhazu.notice_date AS notice_date,
  vtbfhazu.rounding_rule AS rounding_rule,
  vtbfhazu.bpprc_spot2 AS spot_rate_maturity_bpprc_spot2,
  vtbfhazu.bpprc_spot1 AS spot_1_bpprc_spot1,
  vtbfhazu.bpprc_marg AS margin_rate_bpprc_marg,
  vtbfhazu.coc_rate AS int_rate_cost_cryfwd_coc_rate,
  vtbfhazu.forward_date AS forward_date,
  vtbfhazu.snotdelivered AS not_delivered_snotdelivered,
  vtbfhazu.peffz_worst AS yield_to_worst_peffz_worst,
  vtbfhazu.peffz_worst_dt AS yield_to_worst_end_date_peffz_worst_dt,
  vtbfhazu.zvtrab AS time_zone_of_contract_date_and_time_zvtrab,
  ${currency.amountWithDecimalShift("vtbfhazu.nom_up_limit", "currency_decimal_wgschft")} AS upper_limit_amount_in_payment_currency_nom_up_limit,
  ${currency.amountWithDecimalShift("vtbfhazu.nom_low_limit", "currency_decimal_wgschft")} AS lower_limit_amount_in_payment_currency_nom_low_limit,
  GREATEST(
    IFNULL(vtbfhazu.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(vtbfha.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vtbfhazu")} AS vtbfhazu
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vtbfha")} AS vtbfha
  ON vtbfhazu.mandt = vtbfha.mandt
  AND vtbfhazu.bukrs = vtbfha.bukrs
  AND vtbfhazu.rfha = vtbfha.rfha
LEFT JOIN currency_decimal AS currency_decimal_wgschft
  ON vtbfha.wgschft = currency_decimal_wgschft.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vtbfhazu", "vtbfha"])
])}
`
);
