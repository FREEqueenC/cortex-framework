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
  ["client_mandt", "controlling_area_kokrs", "cost_center_kostl", "valid_to_datbi", "language_spras"]
);

publish("cost_centers", publishConfig).query(
  (ctx) => `
SELECT
  csks.mandt AS client_mandt,
  csks.kokrs AS controlling_area_kokrs,
  csks.kostl AS cost_center_kostl,
  csks.datbi AS valid_to_datbi,
  cskt.spras AS language_spras,
  csks.datab AS valid_from_datab,
  csks.bkzkp AS lock_indicator_for_actual_primary_postings_bkzkp,
  csks.pkzkp AS lock_indicator_for_plan_primary_costs_pkzkp,
  csks.bukrs AS company_code_bukrs,
  csks.gsber AS business_area_gsber,
  csks.kosar AS cost_center_category_kosar,
  csks.verak AS person_responsible_verak,
  csks.verak_user AS user_responsible_verak_user,
  csks.waers AS currency_key_waers,
  csks.kalsm AS costing_sheet_kalsm,
  csks.txjcd AS tax_jurisdiction_txjcd,
  csks.prctr AS profit_center_prctr,
  csks.werks AS plant_werks,
  csks.logsystem AS logical_system_logsystem,
  csks.ersda AS created_on_ersda,
  csks.usnam AS entered_by_usnam,
  csks.bkzks AS lock_indicator_for_actual_secondary_costs_bkzks,
  csks.bkzer AS lock_indicator_for_actual_revenue_postings_bkzer,
  csks.bkzob AS lock_indicator_for_commitment_update_bkzob,
  csks.pkzks AS lock_indicator_for_plan_secondary_costs_pkzks,
  csks.pkzer AS lock_indicator_for_planning_revenues_pkzer,
  csks.vmeth AS indicator_for_allowed_allocation_methods_vmeth,
  csks.mgefl AS indicator_for_recording_consumption_quantities_mgefl,
  csks.abtei AS department_abtei,
  csks.nkost AS subsequent_cost_center_nkost,
  csks.kvewe AS usage_of_the_condition_table_kvewe,
  csks.kappl AS application_kappl,
  csks.koszschl AS co_cca_overhead_key_koszschl,
  csks.land1 AS country_key_land1,
  csks.anred AS title_anred,
  csks.name1 AS name1_name1,
  csks.name2 AS name2_name2,
  csks.name3 AS name3_name3,
  csks.name4 AS name4_name4,
  csks.ort01 AS city_ort01,
  csks.ort02 AS district_ort02,
  csks.stras AS street_and_house_number_stras,
  csks.pfach AS po_box_pfach,
  csks.pstlz AS postal_code_pstlz,
  csks.pstl2 AS po_box_postal_code_pstl2,
  csks.regio AS region_regio,
  csks.spras AS language_key_spras,
  csks.telbx AS telebox_number_telbx,
  csks.telf1 AS first_telephone_number_telf1,
  csks.telf2 AS second_telephone_number_telf2,
  csks.telfx AS fax_number_telfx,
  csks.teltx AS teletex_number_teltx,
  csks.telx1 AS telex_number_telx1,
  csks.datlt AS data_communication_line_no_datlt,
  csks.drnam AS printer_destination_for_cctr_report_drnam,
  csks.khinr AS standard_hierarchy_area_khinr,
  csks.cckey AS cost_collector_key_cckey,
  csks.kompl AS completion_flag_for_the_cost_center_master_record_kompl,
  csks.stakz AS indicator_object_is_statistical_stakz,
  csks.objnr AS object_number_objnr,
  csks.funkt AS function_of_cost_center_funkt,
  csks.afunk AS alternative_function_of_cost_center_afunk,
  csks.cpi_templ AS template_for_activity_independent_formula_planning_cpi_templ,
  csks.cpd_templ AS template_for_activity_dependent_formula_planning_cpd_templ,
  csks.func_area AS functional_area_func_area,
  csks.sci_templ AS template_activity_independent_allocation_to_cost_center_sci_templ,
  csks.scd_templ AS template_activity_dependent_allocation_to_cost_center_scd_templ,
  csks.ski_templ AS template_actual_statistical_key_figure_on_cost_center_ski_templ,
  csks.skd_templ AS template_act_stat_key_figure_cost_centeractivity_type_skd_templ,
  csks.vname AS joint_venture_vname,
  csks.recid AS recovery_indicator_recid,
  csks.etype AS equity_type_etype,
  csks.jv_otype AS joint_venture_object_type_jv_otype,
  csks.jv_jibcl AS jibjibe_class_jv_jibcl,
  csks.jv_jibsa AS jibjibe_subclass_a_jv_jibsa,
  csks.ferc_ind AS regulatory_indicator_ferc_ind,
  cskt.ktext AS general_name_ktext,
  cskt.ltext AS description_ltext,
  cskt.mctxt AS search_term_for_matchcode_use_mctxt,
  GREATEST(
    IFNULL(csks.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(cskt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "csks")} AS csks
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cskt")} AS cskt
  ON csks.mandt = cskt.mandt
    AND csks.kokrs = cskt.kokrs
    AND csks.kostl = cskt.kostl
    AND csks.datbi = cskt.datbi
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["csks", "cskt"])
])}
`
);
