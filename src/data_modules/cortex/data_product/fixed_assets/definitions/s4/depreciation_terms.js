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
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  ["client_mandt", "company_code_bukrs", "asset_number_anln1", "asset_subnumber_anln2", "depreciation_area_afabe", "valid_to_bdatu", "language_key_spras"]
);

publish('depreciation_terms', publishConfig).query(
  (ctx) => `
SELECT
  anlb.mandt AS client_mandt,
  anlb.bukrs AS company_code_bukrs,
  anlb.anln1 AS asset_number_anln1,
  anlb.anln2 AS asset_subnumber_anln2,
  anlb.afabe AS depreciation_area_afabe,
  anlb.bdatu AS valid_to_bdatu,
  t093t.spras AS language_key_spras,
  anlb.adatu AS valid_from_adatu,
  anlb.ernam AS created_by_ernam,
  anlb.erdat AS created_on_erdat,
  anlb.aenam AS changed_by_aenam,
  anlb.aedat AS changed_on_aedat,
  anlb.xloev AS mark_for_deletion_xloev,
  anlb.xspeb AS blocked_for_posting_xspeb,
  anlb.felei AS screen_layout_rule_felei,
  anlb.xnega AS negative_values_allowed_xnega,
  anlb.xgwgk AS low_val_asset_check_xgwgk,
  anlb.xunta AS dep_on_main_asset_number_xunta,
  anlb.afabg AS depreciation_calculation_start_date_afabg,
  anlb.zinbg AS interest_calculation_zinbg,
  anlb.safbg AS spec_depreciation_safbg,
  anlb.invsl AS investment_support_invsl,
  anlb.afasl AS depreciation_key_afasl,
  anlb.ndjar AS useful_life_ndjar,
  anlb.ndper AS usef_life_in_periods_ndper,
  anlb.naprz AS ord_dep_percent_rate_naprz,
  anlb.saprz AS spec_dep_perc_rate_saprz,
  anlb.wbind AS index_series_wbind,
  anlb.alind AS age_dependent_index_alind,
  anlb.aprop AS variable_dep_portion_aprop,
  anlb.umjar AS changeover_year_umjar,
  anlb.ndurj AS original_useful_life_ndurj,
  anlb.ndurp AS orig_life_in_periods_ndurp,
  anlb.schrw AS scrap_value_schrw,
  anlb.lgjan AS last_fiscal_year_lgjan,
  anlb.perfy AS period_scaling_perfy,
  anlb.anupd AS change_type_anupd,
  anlb.aufwtg AS revaluation_aufwtg,
  anlb.xafbe AS dep_area_deactivated_xafbe,
  anlb.anlgr AS group_asset_anlgr,
  anlb.anlgr2 AS subnumber_anlgr2,
  anlb.vyear AS acquis_year_vyear,
  anlb.vmnth AS acquis_month_vmnth,
  anlb.inbda AS operating_readiness_inbda,
  anlb.abgdat_b AS last_retmt_on_abgdat_b,
  anlb.deakt_b AS deactivation_on_deakt_b,
  anlb.j_1aarvkey AS revaluation_key_j_1aarvkey,
  anlb.j_1aaltdat AS last_revaluation_date_j_1aaltdat,
  anlb.j_1aaltidx AS last_index_used_j_1aaltidx,
  anlb.schrw_proz AS scrap_value_percent_schrw_proz,
  anlb.umper AS changeover_period_umper,
  t093b.waers AS currency_waers,
  t093b.runden AS rounding_nbv_runden,
  t093b.erwert AS memo_value_erwert,
  t093b.gwgwrt AS max_lva_amount_posting_gwgwrt,
  t093b.umrwrt AS net_book_value_dep_change_umrwrt,
  t093b.gwgbst AS max_lva_amount_purch_ord_gwgbst,
  t093b.filler AS calc_dep_half_periods_filler,
  t093b.rndahk AS rounding_rv_rndahk,
  t093b.abgja AS closed_fiscal_year_abgja,
  t093b.afrhy AS dep_posting_cycle_afrhy,
  t093b.xanzum AS capitalize_auc_flag_xanzum,
  t093b.versn_011 AS fs_version_versn_011,
  t093b.x445r AS dist_depreciation_weeks_x445r,
  t093b.xakpl AS manage_group_assets_xakpl,
  t093b.basrnd AS rounding_basis_basrnd,
  t093b.metrnd AS rounding_method_metrnd,
  t093b.periv AS fiscal_year_variant_periv,
  t093b.toleranz AS tolerance_amount_toleranz,
  t093b.kzrbwb_afabe AS post_nbv_retirement_flag_kzrbwb_afabe,
  t093t.afbktx AS short_name_dep_area_afbktx,
  t093t.afbtxt AS dep_area_name_afbtxt,
  t090nat.afatxt AS depreciation_key_description_afatxt,
  t093c.afapl AS chart_of_dep_afapl,
  GREATEST(
    IFNULL(anlb.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t093b.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t093t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t090nat.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t093c.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anlb")} AS anlb
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t093b")} AS t093b
  ON anlb.mandt = t093b.mandt
  AND anlb.bukrs = t093b.bukrs
  AND anlb.afabe = t093b.afabe
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t093c")} AS t093c
  ON anlb.mandt = t093c.mandt
  AND anlb.bukrs = t093c.bukrs
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t093t")} AS t093t
  ON t093c.mandt = t093t.mandt
  AND t093c.afapl = t093t.afapl
  AND anlb.afabe = t093t.afaber
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t090nat")} AS t090nat
  ON anlb.mandt = t090nat.mandt
  AND t093c.afapl = t090nat.afapl
  AND anlb.afasl = t090nat.afasl
  AND t093t.spras = t090nat.spras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anlb", "t093b", "t093t", "t090nat", "t093c"])
])}
`
);
