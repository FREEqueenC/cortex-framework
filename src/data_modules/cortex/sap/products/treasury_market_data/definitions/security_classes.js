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
const materializationType = tableConfig.materializationType || "view";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "security_class_id_number_ranl"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  vwpanla.mandt AS client_mandt,
  vwpanla.ranl AS security_class_id_number_ranl,
  vwpanla.sanlf AS product_category_sanlf,
  vwpanla.sstati AS status_sstati,
  vwpanla.ranlalt1 AS alternative_number_1_ranlalt1,
  vwpanla.ranlalt2 AS alternative_number_2_ranlalt2,
  vwpanla.gsart AS product_type_gsart,
  vwpanla.sbrsch AS industry_sbrsch,
  vwpanla.swerttyp AS security_type_swerttyp,
  vwpanla.sboernot AS listed_sboernot,
  vwpanla.wlomb AS eligible_as_collat_wlomb,
  vwpanla.jdeck AS hedge_fund_jdeck,
  vwpanla.wpfan AS pledgeable_wpfan,
  vwpanla.sstbe AS tax_treatment_sstbe,
  vwpanla.loevm AS deletion_indicator_loevm,
  vwpanla.jabmi AS joint_partner_vote_jabmi,
  vwpanla.xalkz AS short_name_xalkz,
  vwpanla.xallb AS long_name_xallb,
  vwpanla.repke AS issuer_repke,
  vwpanla.bempreis AS issue_price_bempreis,
  vwpanla.rewhr AS issue_currency_rewhr,
  vwpanla.pemkurs AS issue_rate_pemkurs,
  vwpanla.snoti AS quotation_snoti,
  vwpanla.pkuab AS price_deviation_in_pkuab,
  vwpanla.bkuab AS abs_price_deviation_bkuab,
  vwpanla.dandpfl AS oblig_to_offer_until_dandpfl,
  vwpanla.dandre AS right_to_offer_until_dandre,
  vwpanla.sobjekt AS object_key_sobjekt,
  vwpanla.rerf AS entered_by_rerf,
  vwpanla.derf AS first_entered_on_derf,
  vwpanla.terf AS time_of_creation_terf,
  vwpanla.reher AS initial_entry_source_reher,
  vwpanla.rbear AS last_changed_by_rbear,
  vwpanla.dbear AS last_edited_on_dbear,
  vwpanla.tbear AS last_edited_at_tbear,
  vwpanla.rbher AS editing_source_rbher,
  vwpanla.srolext AS security_classification_srolext,
  vwpanla.vvsloekz AS deletion_indicator_vvsloekz,
  vwpanla.jmuendel AS eligible_jmuendel,
  vwpanla.smoverw AS poss_custody_type_smoverw,
  vwpanla.siherk AS component_of_the_version_number_siherk,
  vwpanla.kbempreis AS issue_price_kbempreis,
  vwpanla.sdepostat AS securities_account_statistics_key_sdepostat,
  vwpanla.sfundi AS funded_sfundi,
  vwpanla.swphgmpf AS reporting_oblig_stl_swphgmpf,
  vwpanla.risin AS internat_id_no_risin,
  vwpanla.institute AS credit_standing_institute_institute,
  vwpanla.rating AS rating_rating,
  vwpanla.price_index AS name_of_price_index_price_index,
  vwpanla.price_idx_bdate AS price_index_base_date_price_idx_bdate,
  vwpanla.coicode AS ci_code_coicode,
  vwpanla.coiland AS ci_country_coiland,
  vwpanla.sfimamethod AS cash_flow_calculation_sfimamethod,
  IFNULL(vwpanla.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vwpanla")} AS vwpanla
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vwpanla"])
])}
`
);
