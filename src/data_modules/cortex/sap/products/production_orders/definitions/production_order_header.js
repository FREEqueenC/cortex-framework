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
    "order_number_aufnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
)
SELECT
  afko.mandt AS client_mandt,
  afko.aufnr AS order_number_aufnr,
  afko.gltrp AS basic_finish_date_gltrp,
  afko.gstrp AS basic_start_date_gstrp,
  dimensional_date_gstrp.cal_year AS year_of_basic_start_date_gstrp,
  dimensional_date_gstrp.cal_month AS month_of_basic_start_date_gstrp,
  dimensional_date_gstrp.cal_quarter AS quarter_of_basic_start_date_gstrp,
  dimensional_date_gstrp.cal_week AS week_of_basic_start_date_gstrp,
  afko.ftrms AS scheduled_release_date_ftrms,
  afko.gltrs AS scheduled_finish_gltrs,
  afko.gstrs AS scheduled_start_gstrs,
  afko.gstri AS actual_start_date_gstri,
  afko.getri AS actual_finish_date_getri,
  afko.gltri AS actual_finish_date_gltri,
  afko.ftrmi AS actual_release_date_ftrmi,
  afko.ftrmp AS planned_release_date_ftrmp,
  afko.rsnum AS reservation_number_rsnum,
  afko.gasmg AS total_scrap_quantity_gasmg,
  afko.gamng AS total_order_quantity_gamng,
  afko.gmein AS base_unit_of_measure_gmein,
  afko.plnbez AS material_number_plnbez,
  afko.plnty AS task_list_type_plnty,
  afko.plnnr AS group_plnnr,
  afko.plnaw AS application_plnaw,
  afko.plnal AS group_counter_plnal,
  afko.pverw AS usage_pverw,
  afko.plauf AS explosion_date_plauf,
  afko.plsvb AS lot_size_to_plsvb,
  afko.plnme AS task_list_unit_plnme,
  afko.plsvn AS lot_size_from_plsvn,
  afko.pdatv AS valid_from_pdatv,
  afko.paenr AS change_number_paenr,
  afko.plgrp AS planner_group_plgrp,
  afko.lodiv AS lot_size_divisor_lodiv,
  afko.stlty AS bom_category_stlty,
  afko.stlbez AS material_number_stlbez,
  afko.stlst AS bom_status_stlst,
  afko.stlnr AS bill_of_material_stlnr,
  afko.sdatv AS valid_from_sdatv,
  afko.sbmng AS base_quantity_sbmng,
  afko.sbmeh AS base_unit_of_measure_sbmeh,
  afko.saenr AS change_number_saenr,
  afko.stlal AS alternative_bom_stlal,
  afko.stlan AS bom_usage_stlan,
  afko.slsvn AS lot_size_from_slsvn,
  afko.slsbs AS lot_size_to_slsbs,
  afko.aufld AS bom_explosion_date_aufld,
  afko.dispo AS mrp_controller_dispo,
  afko.aufpl AS opertn_task_list_no_aufpl,
  afko.fevor AS production_supervisor_fevor,
  afko.fhori AS sched_margin_key_fhori,
  afko.terkz AS scheduling_type_terkz,
  afko.redkz AS reduction_indicator_redkz,
  afko.aprio AS priority_aprio,
  afko.ntzue AS network_ntzue,
  afko.vorue AS superior_activity_vorue,
  afko.profid AS network_profile_profid,
  afko.vorgz AS float_before_prod_vorgz,
  afko.sichz AS float_after_product_sichz,
  afko.freiz AS release_period_freiz,
  afko.upter AS dates_chngd_manually_upter,
  afko.bedid AS capacity_requirement_id_bedid,
  afko.pronr AS project_definition_pronr,
  afko.zaehl AS counter_zaehl,
  afko.mzaehl AS counter_mzaehl,
  afko.zkriz AS add_crit_counter_zkriz,
  afko.prueflos AS inspection_lot_prueflos,
  afko.klvarp AS planned_costs_costing_variant_klvarp,
  afko.klvari AS actual_costs_costing_variant_klvari,
  afko.rgekz AS backflushing_rgekz,
  afko.plart AS scheduling_basis_plart,
  afko.flg_aob AS ind_relationships_flg_aob,
  afko.flg_arbei AS ind_work_flg_arbei,
  afko.gltpp AS finish_date_gltpp,
  afko.gstpp AS start_date_gstpp,
  afko.gltps AS scheduled_finish_gltps,
  afko.gstps AS scheduled_start_gstps,
  afko.ftrps AS sched_release_date_ftrps,
  afko.rdkzp AS reduction_indicator_rdkzp,
  afko.trkzp AS sched_type_forecast_trkzp,
  afko.rueck AS confirmation_rueck,
  afko.rmzhl AS counter_rmzhl,
  afko.igmng AS confirmed_yield_quantity_igmng,
  afko.ratid AS rate_id_ratid,
  afko.groid AS rough_sched_id_groid,
  afko.cuobj AS internal_object_no_cuobj,
  afko.gluzs AS scheduled_fin_time_gluzs,
  afko.gsuzs AS scheduled_start_time_gsuzs,
  afko.revlv AS revision_level_revlv,
  afko.rshty AS object_type_rshty,
  afko.rshid AS object_id_rshid,
  afko.rsnty AS object_type_rsnty,
  afko.rsnid AS object_id_rsnid,
  afko.nauterm AS no_auto_scheduling_nauterm,
  afko.naucost AS no_automatic_costing_naucost,
  afko.stufe AS level_stufe,
  afko.wegxx AS path_wegxx,
  afko.vwegx AS path_vwegx,
  afko.arsnr AS reservation_arsnr,
  afko.arsps AS order_item_number_arsps,
  afko.maufnr AS superior_order_maufnr,
  afko.lknot AS left_node_lknot,
  afko.rknot AS right_node_rknot,
  afko.prodnet AS collective_order_prodnet,
  afko.iasmg AS confirmed_scrap_quantity_iasmg,
  afko.abarb AS degree_of_processing_abarb,
  afko.aufnt AS subnetwork_of_aufnt,
  afko.aufpt AS opertn_task_list_no_aufpt,
  afko.aplzt AS counter_aplzt,
  afko.no_disp AS effec_mat_planning_no_disp,
  afko.csplit AS apportionment_struct_csplit,
  afko.aennr AS change_number_aennr,
  afko.cy_seqnr AS sequence_number_cy_seqnr,
  afko.breaks AS exact_break_times_breaks,
  afko.vorgz_trm AS schd_flt_before_prod_vorgz_trm,
  afko.sichz_trm AS sched_flt_after_prod_sichz_trm,
  afko.trmdt AS scheduled_on_trmdt,
  afko.gluzp AS basic_finish_time_gluzp,
  afko.gsuzp AS basic_start_time_gsuzp,
  afko.gsuzi AS actualstarttime_gsuzi,
  afko.geuzi AS actual_finish_time_geuzi,
  afko.glupp AS finish_time_glupp,
  afko.gsupp AS start_time_gsupp,
  afko.glups AS sched_finish_time_glups,
  afko.gsups AS sched_start_time_gsups,
  afko.chsch AS search_procedure_chsch,
  afko.kapt_vorgz AS remainpreprodfloat_kapt_vorgz,
  afko.kapt_sichz AS remaining_float_kapt_sichz,
  afko.lead_aufnr AS leading_order_lead_aufnr,
  afko.pnetstartd AS start_pnetstartd,
  afko.pnetstartt AS start_pnetstartt,
  afko.pnetendd AS finish_pnetendd,
  afko.pnetendt AS finish_pnetendt,
  afko.kbed AS no_cap_requirements_kbed,
  afko.kkalkr AS costingcomp_ind_kkalkr,
  afko.sfcpf AS production_scheduling_profile_sfcpf,
  afko.rmnga AS confirmed_rework_quantity_rmnga,
  afko.gsbtr AS commitment_date_gsbtr,
  afko.vfmng AS committed_qty_vfmng,
  afko.nopcost AS no_planned_costs_nopcost,
  afko.netzkont AS account_assignment_netzkont,
  afko.atrkz AS request_id_atrkz,
  afko.objtype AS change_indicator_objtype,
  afko.ch_proc AS change_process_type_ch_proc,
  afko.kapversa AS version_kapversa,
  afko.colordproc AS co_processing_colordproc,
  afko.kzerb AS proj_summ_mastdata_kzerb,
  afko.conf_key AS identical_object_conf_key,
  afko.st_arbid AS object_id_st_arbid,
  afko.vsnmr_v AS version_vsnmr_v,
  afko.terhw AS scheduling_note_terhw,
  afko.splstat AS split_status_splstat,
  afko.costupd AS update_costs_costupd,
  afko.max_gamng AS maximum_quantity_max_gamng,
  afko.mes_routingid AS mes_routing_mes_routingid,
  afko.adpsp AS pm_ps_reference_element_adpsp,
  afko.rmanr AS sales_document_rmanr,
  afko.posnr_rma AS item_sd_posnr_rma,
  afko.posnv_rma AS item_sd_posnv_rma,
  afko.cfb_maxlz AS max_storage_period_cfb_maxlz,
  afko.cfb_lzeih AS time_unit_cfb_lzeih,
  afko.cfb_adtdays AS additional_days_cfb_adtdays,
  afko.cfb_datofm AS date_of_manufacture_cfb_datofm,
  afko.cfb_bbdpi AS bbd_sled_cfb_bbdpi,
  afko.oihantyp AS handling_type_oihantyp,
  afko.fsh_mprod_ord AS master_production_order_fsh_mprod_ord,
  afko.flg_bundle AS bundle_flag_flg_bundle,
  afko.mill_ratio AS adjustment_factor_for_settlement_rules_mill_ratio,
  afko.bmeins AS base_unit_of_measure_bmeins,
  afko.bmenge AS base_quantity_bmenge,
  afko.mill_oc_zuskz AS combination_indicator_mill_oc_zuskz,
  IFNULL(
    afko.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "afko")} AS afko
LEFT JOIN date_dimension AS dimensional_date_gstrp
  ON afko.gstrp = dimensional_date_gstrp.date
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["afko"])
  ])}
`
);
