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
    "entry_time_tcrtim",
    "flow_rfhazb"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  vtbfhapo.mandt AS client_mandt,
  vtbfhapo.bukrs AS company_code_bukrs,
  vtbfhapo.rfha AS transaction_rfha,
  vtbfhapo.rfhazu AS activity_rfhazu,
  vtbfhapo.dcrdat AS entered_on_dcrdat,
  vtbfhapo.tcrtim AS entry_time_tcrtim,
  vtbfhapo.rfhazb AS flow_rfhazb,
  vtbfhapo.cruser AS entered_by_cruser,
  vtbfhapo.upuser AS last_changed_by_upuser,
  vtbfhapo.dupdat AS changed_on_dupdat,
  vtbfhapo.tuptim AS time_changed_tuptim,
  vtbfhapo.rantyp AS contract_type_rantyp,
  vtbfhapo.sfhazba AS flow_type_sfhazba,
  vtbfhapo.sbkklas AS classification_sbkklas,
  vtbfhapo.sbktyp AS category_sbktyp,
  vtbfhapo.sberfima AS fima_calc_category_sberfima,
  vtbfhapo.ssign AS direction_ssign,
  vtbfhapo.sherkunft AS source_sherkunft,
  vtbfhapo.sabverf AS derivation_procedure_sabverf,
  vtbfhapo.rkondgr AS direction_rkondgr,
  vtbfhapo.rkond AS condition_rkond,
  vtbfhapo.dguel_kp AS item_effective_from_dguel_kp,
  vtbfhapo.nstufe AS level_number_nstufe,
  vtbfhapo.skoart AS condition_type_skoart,
  vtbfhapo.rrefkont AS account_assignment_reference_rrefkont,
  vtbfhapo.sbzvabw AS alt_payment_details_sbzvabw,
  vtbfhapo.rahabki AS house_bank_rahabki,
  vtbfhapo.rahktid AS house_bank_account_rahktid,
  vtbfhapo.rpzahl AS payer_payee_rpzahl,
  vtbfhapo.rpbank AS partner_bank_rpbank,
  vtbfhapo.szart AS payment_transaction_szart,
  vtbfhapo.zlsch AS payment_method_zlsch,
  vtbfhapo.uzawe AS pmt_meth_supplement_uzawe,
  vtbfhapo.spayrq AS payment_request_spayrq,
  vtbfhapo.sprsng AS individual_payment_sprsng,
  vtbfhapo.sprgrd AS group_determ_sprgrd,
  vtbfhapo.scspay AS same_direction_scspay,
  vtbfhapo.zwels AS payment_methods_zwels,
  vtbfhapo.paygr AS grouping_paygr,
  vtbfhapo.sbewebe AS posting_status_sbewebe,
  vtbfhapo.ssprgrd AS posting_block_reason_ssprgrd,
  vtbfhapo.sbfrei AS posting_release_sbfrei,
  vtbfhapo.sstornobwg AS flow_reversal_sstornobwg,
  vtbfhapo.prkey AS key_number_prkey,
  vtbfhapo.belnr AS document_number_belnr,
  vtbfhapo.belnr2 AS doc_number_2_belnr2,
  vtbfhapo.gjahr AS fiscal_year_gjahr,
  vtbfhapo.dbuchung AS posting_date_dbuchung,
  vtbfhapo.dfaell AS due_date_dfaell,
  vtbfhapo.dzterm AS payment_date_dzterm,
  ${currency.amountWithDecimalShift("vtbfhapo.bzbetr", "currency_decimal_wzbetr")} AS payment_amount_in_payment_currency_bzbetr,
  vtbfhapo.wzbetr AS payment_currency_wzbetr,
  ${currency.amountWithDecimalShift("vtbfhapo.bhwbetr", "currency_decimal_waers")} AS payment_amount_in_local_currency_bhwbetr,
  vtbfhapo.khwkurs AS local_currency_rate_khwkurs,
  vtbfhapo.astueck AS number_of_units_astueck,
  ${currency.amountWithDecimalShift("vtbfhapo.bprice", "currency_decimal_wprice")} AS price_per_unit_bprice,
  vtbfhapo.wprice AS price_currency_wprice,
  ${currency.amountWithDecimalShift("vtbfhapo.bhwpreis", "currency_decimal_waers")} AS local_currency_price_bhwpreis,
  ${currency.amountWithDecimalShift("vtbfhapo.bindex", "currency_decimal_wprice")} AS point_value_bindex,
  vtbfhapo.vvbasis AS price_in_points_vvbasis,
  vtbfhapo.pwkurs AS price_in_percent_pwkurs,
  vtbfhapo.prkkurs AS premium_in_price_pts_prkkurs,
  ${currency.amountWithDecimalShift("vtbfhapo.bnwhr", "currency_decimal_wprice")} AS nominal_amount_bnwhr,
  vtbfhapo.rhandpl AS exchange_rhandpl,
  vtbfhapo.skursart AS rate_price_type_skursart,
  vtbfhapo.dbervon AS calculation_from_dbervon,
  vtbfhapo.dberbis AS calculation_to_dberbis,
  vtbfhapo.atage AS number_of_days_atage,
  vtbfhapo.abastage AS number_of_base_days_abastage,
  vtbfhapo.pkond AS percentage_rate_pkond,
  vtbfhapo.dpkond AS percent_fixing_date_dpkond,
  vtbfhapo.dzfest AS int_rate_fixing_date_dzfest,
  vtbfhapo.szbmeth AS int_calc_method_szbmeth,
  vtbfhapo.skalidwt AS interest_calendar_skalidwt,
  ${currency.amountWithDecimalShift("vtbfhapo.bbasis", "currency_decimal_wbasis")} AS base_amount_bbasis,
  vtbfhapo.wbasis AS currency_basis_wbasis,
  vtbfhapo.jexpozins AS exponential_interest_calc_jexpozins,
  vtbfhapo.sincl AS inclusive_indicator_sincl,
  vtbfhapo.sinclbis AS inclusive_end_date_sinclbis,
  vtbfhapo.sultbis AS month_end_end_date_sultbis,
  vtbfhapo.sexclvon AS exclusive_start_date_sexclvon,
  vtbfhapo.sultvon AS month_start_date_sultvon,
  vtbfhapo.saend AS change_indicator_saend,
  vtbfhapo.dvalut AS calculation_date_dvalut,
  vtbfhapo.svincl AS inclusive_val_dte_svincl,
  vtbfhapo.svult AS month_end_val_date_svult,
  vtbfhapo.jsofverr AS immediate_settlement_jsofverr,
  vtbfhapo.dverrech AS settlement_date_dverrech,
  vtbfhapo.sinclverr AS incl_clearing_date_sinclverr,
  vtbfhapo.sultverr AS month_end_clearing_sultverr,
  vtbfhapo.sstornoman AS manual_reversal_sstornoman,
  vtbfhapo.sstornoart AS reversal_type_sstornoart,
  vtbfhapo.sbwgartref AS reference_flow_type_sbwgartref,
  vtbfhapo.skhwfix AS transl_local_currency_skhwfix,
  vtbfhapo.zuonr AS assignment_zuonr,
  vtbfhapo.rldepo AS securities_account_rldepo,
  vtbfhapo.ranl AS id_number_ranl,
  vtbfhapo.rtrbelnr AS int_document_number_rtrbelnr,
  vtbfhapo.buprc AS price_unit_quot_buprc,
  vtbfhapo.bpprc AS price_bpprc,
  vtbfhapo.wbbetr AS position_currency_wbbetr,
  ${currency.amountWithDecimalShift("vtbfhapo.bbbetr", "currency_decimal_wbbetr")} AS amount_in_position_currency_bbbetr,
  vtbfhapo.webetr AS price_currency_webetr,
  ${currency.amountWithDecimalShift("vtbfhapo.bebetr", "currency_decimal_webetr")} AS mrkt_val_in_quotation_currency_bebetr,
  vtbfhapo.srunit AS currency_unit_srunit,
  vtbfhapo.kzwkurs AS payment_currency_rate_kzwkurs,
  vtbfhapo.kbwkurs AS position_currency_rate_kbwkurs,
  vtbfhapo.wsbetr AS source_currency_wsbetr,
  vtbfhapo.dbestand AS position_value_date_dbestand,
  vtbfhapo.sstckkz AS accrue_int_method_sstckkz,
  vtbfhapo.sstcktg AS daily_method_sstcktg,
  vtbfhapo.sflat AS traded_flat_sflat,
  vtbfhapo.scoupon AS coupon_scoupon,
  vtbfhapo.dcoupon AS coupon_date_dcoupon,
  vtbfhapo.awkey AS object_key_awkey,
  vtbfhapo.index_value AS index_val_w_o_basis_index_value,
  vtbfhapo.sbasis AS calculation_base_sbasis,
  vtbfhapo.regi_state AS int_rate_adj_status_regi_state,
  vtbfhapo.rpcode AS repetitive_code_rpcode,
  vtbfhapo.rp_text AS reference_type_text_rp_text,
  vtbfhapo.hedge_id AS hedge_id,
  vtbfhapo.dbperiod AS period_start_dbperiod,
  vtbfhapo.spaexcl AS exclusive_start_date_spaexcl,
  vtbfhapo.spault AS monendindstartperiod_spault,
  vtbfhapo.deperiod AS period_end_deperiod,
  vtbfhapo.speincl AS inclusive_indendper_speincl,
  vtbfhapo.speult AS monthendperiodend_speult,
  vtbfhapo.ammrhy AS frequency_in_months_ammrhy,
  vtbfhapo.ppayment AS payment_rate_ppayment,
  vtbfhapo.ammrhyzv AS int_sttlmnt_freq_ammrhyzv,
  vtbfhapo.lzbkz AS scb_indicator_lzbkz,
  vtbfhapo.landl AS supplying_cntry_landl,
  ${currency.amountWithDecimalShift("vtbfhapo.bdirty", "currency_decimal_wzbetr")} AS dirty_price_bdirty,
  ${currency.amountWithDecimalShift("vtbfhapo.bamountcomp", "currency_decimal_wzbetr")} AS capitalization_amnt_bamountcomp,
  ${currency.amountWithDecimalShift("vtbfhapo.nominal_org_amt", "currency_decimal_wprice")} AS orignal_nominal_amount_nominal_org_amt,
  vtbfhapo.nom_factor AS factor_nom_factor,
  vtbfhapo.rldepo2 AS securities_account_rldepo2,
  vtbfhapo.index_price AS indicator_price_including_index_value_index_price,
  vtbfhapo.flowuuid AS flow_uuid_flowuuid,
  vtbfhapo.flagbyte1 AS flag_byte_1_flagbyte1,
  vtbfhapo.quantity AS qty_quantity,
  vtbfhapo.unit_of_measure AS unit_of_measure,
  vtbfhapo.contract_price AS price_contract_price,
  vtbfhapo.spot_price AS spotprice_spot_price,
  vtbfhapo.contango_backwrd AS commodity_contango_contango_backwrd,
  vtbfhapo.bprc_spot1 AS spot_1_bprc_spot1,
  vtbfhapo.bprc_spot2 AS spot_rate_maturity_bprc_spot2,
  vtbfhapo.cost_fwd AS cost_cost_fwd,
  vtbfhapo.interest_fwd AS interest_interest_fwd,
  vtbfhapo.ref_flowuuid AS flow_reference_uuid_ref_flowuuid,
  vtbfhapo.rgatt AS class_rgatt,
  vtbfhapo.commodity_id AS commodity_commodity_id,
  vtbfhapo.quotation_name AS quotation_name,
  vtbfhapo.quotation_source AS source_of_quotation_quotation_source,
  vtbfhapo.quotation_type AS quotation_type,
  vtbfhapo.spread AS spread,
  vtbfhapo.price_curr_unit AS currency_unit_price_curr_unit,
  vtbfhapo.price_uom AS unit_of_measure_price_uom,
  vtbfhapo.div_pctc_otc AS dividend_percentage_relevant_for_payment_div_pctc_otc,
  vtbfhapo.tainted AS manipulated_cashflow_tainted,
  vtbfhapo.cleared AS cleared,
  vtbfhapo.dcsid AS derivative_contract_specification_id_dcsid,
  vtbfhapo.mic AS market_identifier_code_mic,
  vtbfhapo.price_type AS price_type,
  vtbfhapo.time_to_maturity AS time_to_maturity,
  vtbfhapo.timing AS timing,
  vtbfhapo.exch_rate_type AS exchange_rate_type_exch_rate_type,
  vtbfhapo.price_paym_curr AS price_in_payment_currency_price_paym_curr,
  vtbfhapo.spread_paym_curr AS spread_in_pymt_currency_spread_paym_curr,
  vtbfhapo.fx_translation AS fx_translation,
  vtbfhapo.mndid AS mandate_reference_mndid,
  ${currency.amountWithDecimalShift("vtbfhapo.bugrenz", "currency_decimal_wzbetr")} AS lower_limit_for_amnt_bugrenz,
  ${currency.amountWithDecimalShift("vtbfhapo.bogrenz", "currency_decimal_wzbetr")} AS upper_limit_for_amount_bogrenz,
  vtbfhapo.sstaff AS scaled_calculation_sstaff,
  vtbfhapo.logic_rkond AS logical_condition_group_logic_rkond,
  vtbfhapo.rkondref AS condition_rkondref,
  vtbfhapo.dguel_kpref AS item_effective_from_dguel_kpref,
  vtbfhapo.present_date AS presentation_date_present_date,
  vtbfhapo.interest_paid_by AS interest_paid_by,
  vtbfhapo.shipment_date AS shipment_date,
  vtbfhapo.status AS status,
  vtbfhapo.present_id AS presentation_item_present_id,
  vtbfhapo.sstogrd AS reason_for_reversal_sstogrd,
  ${currency.amountWithDecimalShift("vtbfhapo.present_amount", "currency_decimal_wzbetr")} AS presentation_amount_present_amount,
  vtbfhapo.present_bank AS presentation_bank_present_bank,
  vtbfhapo.present_discrepancy AS discrepancy_amount_present_discrepancy,
  ${currency.amountWithDecimalShift("vtbfhapo.present_decrease_amount", "currency_decimal_wzbetr")} AS presentation_decreased_amount_present_decrease_amount,
  ${currency.amountWithDecimalShift("vtbfhapo.present_rea_cre_line", "currency_decimal_wzbetr")} AS released_amount_present_rea_cre_line,
  ${currency.amountWithDecimalShift("vtbfhapo.present_pay_amt", "currency_decimal_wzbetr")} AS payment_amount_in_payment_currency_present_pay_amt,
  vtbfhapo.sroundfactor AS rounding_cat_of_a_factor_sroundfactor,
  vtbfhapo.rounddecfactor AS number_of_dec_places_for_factor_rounding_rounddecfactor,
  vtbfhapo.jexpointfactor AS exp_interest_calculation_with_factor_jexpointfactor,
  vtbfhapo.flowfactor AS flow_factor_flowfactor,
  vtbfhapo.basefactor AS base_factor_basefactor,
  vtbfhapo.sroundbasefactor AS rounding_cat_of_a_base_factor_sroundbasefactor,
  vtbfhapo.rounddecbasefactor AS number_of_dec_places_for_base_fac_rounding_rounddecbasefactor,
  vtbfhapo.skbwfix AS transl_pos_currency_skbwfix,
  vtbfhapo.ssequence AS sequence_number_ssequence,
  vtbfhapo.sroundratefactor AS rounding_category_of_interest_factor_sroundratefactor,
  vtbfhapo.rounddecratefactor AS number_of_rounding_dec_for_int_factor_rounddecratefactor,
  vtbfhapo.aavgdays AS days_for_int_calc_with_air_aavgdays,
  vtbfhapo.pavginterest AS average_interest_rate_pavginterest,
  vtbfhapo.stgbasis AS base_days_method_stgbasis,
  vtbfhapo.javgcap AS upper_limit_of_air_javgcap,
  vtbfhapo.pavgcap AS upper_limit_of_air_pavgcap,
  vtbfhapo.javgfloor AS lower_limit_of_air_javgfloor,
  vtbfhapo.pavgfloor AS lower_limit_of_air_pavgfloor,
  vtbfhapo.pavgspread AS average_interest_rate_spread_pavgspread,
  vtbfhapo.sroundavginterest AS rounding_cat_of_average_interest_rate_sroundavginterest,
  vtbfhapo.rounddecavginterest AS number_of_rounding_dec_places_for_air_rounddecavginterest,
  vtbfhapo.aavgweight AS weighting_of_ir_aavgweight,
  vtbfhapo.aavgweightsum AS cumulative_weighting_of_ir_aavgweightsum,
  vtbfhapo.idcfm_usha_type AS haircut_rate_type_idcfm_usha_type,
  vtbfhapo.idcfm_usha_perc AS percentage_value_idcfm_usha_perc,
  ${currency.amountWithDecimalShift("vtbfhapo.idcfm_usha_tota", "currency_decimal_idcfm_usha_curr")} AS haircut_amount_in_position_currency_idcfm_usha_tota,
  vtbfhapo.idcfm_usha_curr AS haircut_currency_idcfm_usha_curr,
  vtbfhapo.idcfm_usha_form AS european_formula_calculation_idcfm_usha_form,
  GREATEST(
    IFNULL(vtbfhapo.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vtbfhapo")} AS vtbfhapo
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON vtbfhapo.mandt = t001.mandt
  AND vtbfhapo.bukrs = t001.bukrs
LEFT JOIN currency_decimal AS currency_decimal_idcfm_usha_curr
  ON vtbfhapo.idcfm_usha_curr = currency_decimal_idcfm_usha_curr.currkey
LEFT JOIN currency_decimal AS currency_decimal_waers
  ON t001.waers = currency_decimal_waers.currkey
LEFT JOIN currency_decimal AS currency_decimal_wbasis
  ON vtbfhapo.wbasis = currency_decimal_wbasis.currkey
LEFT JOIN currency_decimal AS currency_decimal_wbbetr
  ON vtbfhapo.wbbetr = currency_decimal_wbbetr.currkey
LEFT JOIN currency_decimal AS currency_decimal_webetr
  ON vtbfhapo.webetr = currency_decimal_webetr.currkey
LEFT JOIN currency_decimal AS currency_decimal_wprice
  ON vtbfhapo.wprice = currency_decimal_wprice.currkey
LEFT JOIN currency_decimal AS currency_decimal_wzbetr
  ON vtbfhapo.wzbetr = currency_decimal_wzbetr.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vtbfhapo", "t001"])
])}
`
);
