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
    "order_number_aufnr",
    "order_item_number_posnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  afpo.mandt AS client_mandt,
  afpo.aufnr AS order_number_aufnr,
  afpo.posnr AS order_item_number_posnr,
  afpo.psobs AS special_procurement_psobs,
  afpo.qunum AS quota_arrangement_qunum,
  afpo.qupos AS quota_arrangemt_item_qupos,
  afpo.projn AS wbs_element_projn,
  afpo.plnum AS planned_order_plnum,
  afpo.strmp AS planned_start_date_strmp,
  dimensional_date_strmp.cal_year AS year_of_planned_start_date_strmp,
  dimensional_date_strmp.cal_month AS month_of_planned_start_date_strmp,
  dimensional_date_strmp.cal_quarter AS quarter_of_planned_start_date_strmp,
  dimensional_date_strmp.cal_week AS week_of_planned_start_date_strmp,
  afpo.etrmp AS planned_opening_date_etrmp,
  afpo.kdauf AS sales_order_number_kdauf,
  afpo.kdpos AS sales_order_item_kdpos,
  afpo.kdein AS sales_order_schedule_kdein,
  afpo.beskz AS procurement_type_beskz,
  afpo.psamg AS scrap_quantity_psamg,
  afpo.psmng AS order_item_quantity_psmng,
  afpo.wemng AS qty_of_goods_recvd_wemng,
  afpo.iamng AS expect_variance_recept_iamng,
  afpo.amein AS order_unit_of_meas_amein,
  afpo.meins AS base_unit_of_measure_meins,
  afpo.matnr AS material_number_matnr,
  afpo.pamng AS scrap_quantity_pamng,
  afpo.pgmng AS planned_order_qty_pgmng,
  afpo.knttp AS acct_assignment_cat_knttp,
  afpo.tpauf AS partial_conversion_tpauf,
  afpo.ltrmi AS actual_deliv_date_ltrmi,
  afpo.ltrmp AS delivery_date_from_planned_order_ltrmp,
  afpo.kalnr AS cost_estimate_number_kalnr,
  afpo.uebto AS overdeliv_tolerance_uebto,
  afpo.uebtk AS unltd_overdelivery_uebtk,
  afpo.untto AS underdel_tolerance_untto,
  afpo.insmk AS stock_type_insmk,
  afpo.wepos AS goods_receipt_wepos,
  afpo.bwtar AS valuation_type_bwtar,
  afpo.bwtty AS valuation_category_bwtty,
  afpo.pwerk AS planning_plant_pwerk,
  afpo.lgort AS storage_location_lgort,
  afpo.umrez AS numerator_umrez,
  afpo.umren AS denominator_umren,
  afpo.webaz AS gr_processing_time_webaz,
  afpo.elikz AS delivery_completed_elikz,
  afpo.safnr AS run_schedule_header_safnr,
  afpo.verid AS production_version_verid,
  afpo.sernr AS bom_explosion_number_sernr,
  afpo.techs AS standard_variant_techs,
  afpo.dwerk AS plant_dwerk,
  afpo.dauty AS order_category_dauty,
  afpo.dauat AS order_type_dauat,
  afpo.dgltp AS basic_finish_date_dgltp,
  afpo.dglts AS scheduled_finish_dglts,
  afpo.dfrei AS released_indicator_dfrei,
  afpo.dnrel AS not_relevant_dnrel,
  afpo.verto AS distribution_key_verto,
  afpo.sobkz AS special_stock_sobkz,
  afpo.kzvbr AS consumption_kzvbr,
  ${currency.amountWithDecimalShift("afpo.wewrt", "currency_decimal_waers")} AS value_of_goods_received_wewrt,
  afpo.weunb AS gr_non_valuated_weunb,
  afpo.ablad AS unloading_point_ablad,
  afpo.wempf AS goods_recipient_wempf,
  afpo.charg AS batch_charg,
  afpo.gsber AS business_area_gsber,
  afpo.weaed AS gr_can_be_changed_weaed,
  afpo.cuobj AS internal_object_no_cuobj,
  afpo.kbnkz AS kanban_indicator_kbnkz,
  afpo.arsnr AS settlement_res_no_arsnr,
  afpo.arsps AS item_settlem_reser_arsps,
  afpo.krsnr AS reservation_krsnr,
  afpo.krsps AS item_number_of_reservation_krsps,
  afpo.kckey AS cost_collector_key_kckey,
  afpo.rtp01 AS repetitive_mfg_rtp01,
  afpo.rtp02 AS kanban_rtp02,
  afpo.rtp03 AS sales_order_stock_rtp03,
  afpo.rtp04 AS external_ppc_rtp04,
  afpo.ksvon AS valid_from_ksvon,
  afpo.ksbis AS valid_to_ksbis,
  afpo.objnp AS object_number_objnp,
  afpo.ndisr AS not_relevant_ndisr,
  afpo.vfmng AS committed_qty_vfmng,
  afpo.gsbtr AS overall_commitment_gsbtr,
  afpo.kzavc AS type_avail_check_kzavc,
  afpo.kzbws AS spec_stk_valuation_kzbws,
  afpo.xloek AS deletion_flag_xloek,
  afpo.sernp AS serial_no_profile_sernp,
  afpo.anzsn AS no_serial_numbers_anzsn,
  afpo.objtype AS change_indicator_objtype,
  afpo.ch_proc AS change_process_type_ch_proc,
  afpo.fxpru AS fixed_price_co_product_fxpru,
  afpo.cuobj_root AS internal_object_no_cuobj_root,
  afpo.berid AS mrp_area_berid,
  afpo.techs_copy AS standard_variant_techs_copy,
  afpo.sgt_scat AS stock_segment_sgt_scat,
  afpo.kunnr2 AS customer_kunnr2,
  afpo.fsh_season_year AS season_year_fsh_season_year,
  afpo.fsh_season AS season_fsh_season,
  afpo.fsh_collection AS collection_fsh_collection,
  afpo.fsh_theme AS theme_fsh_theme,
  afpo.fsh_salloc_qty AS allocated_stock_quantity_fsh_salloc_qty,
  afpo.mill_oc_aufnr_u AS number_of_original_order_mill_oc_aufnr_u,
  afpo.mill_oc_rumng AS confirmed_quantity_mill_oc_rumng,
  afpo.mill_oc_sort AS sequence_mill_oc_sort,
  IFNULL(
    afpo.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "afpo")} AS afpo
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "aufk")} AS aufk
  ON afpo.mandt = aufk.mandt
  AND afpo.aufnr = aufk.aufnr
LEFT JOIN currency_decimal AS currency_decimal_waers
  ON aufk.waers = currency_decimal_waers.currkey
LEFT JOIN date_dimension AS dimensional_date_strmp
  ON afpo.strmp = dimensional_date_strmp.date
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["afpo"])
  ])}
`
);
