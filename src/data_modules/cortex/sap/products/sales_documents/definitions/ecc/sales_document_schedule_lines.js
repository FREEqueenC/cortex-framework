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
    "sales_document_vbeln",
    "sales_document_item_posnr",
    "schedule_line_number_etenr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
)
SELECT
  vbep.mandt AS client_mandt,
  vbep.vbeln AS sales_document_vbeln,
  vbep.posnr AS sales_document_item_posnr,
  vbep.etenr AS schedule_line_number_etenr,
  vbep.ettyp AS schedule_line_category_ettyp,
  vbep.lfrel AS item_relevantfor_delivery_lfrel,
  vbep.edatu AS schedule_line_date_edatu,
  vbep.ezeit AS arrival_time_ezeit,
  vbep.wmeng AS order_quantity_in_sales_units_wmeng,
  vbep.bmeng AS confirmed_quantity_bmeng,
  vbep.vrkme AS sales_unit_vrkme,
  vbep.lmeng AS required_quantity_for_mat_management_in_stockkeeping_units_lmeng,
  vbep.meins AS base_unit_of_measure_meins,
  vbep.bddat AS requirement_date_bddat,
  vbep.bdart AS requirement_type_bdart,
  vbep.plart AS planning_type_plart,
  vbep.vbele AS business_document_number_vbele,
  vbep.posne AS business_item_number_posne,
  vbep.etene AS schedule_line_etene,
  vbep.rsdat AS earliest_possible_reservation_date_rsdat,
  vbep.idnnr AS maintenance_request_idnnr,
  vbep.banfn AS purchase_requisition_number_banfn,
  vbep.bsart AS order_type_bsart,
  vbep.bstyp AS purchasing_document_category_bstyp,
  vbep.wepos AS confirmation_status_of_schedule_line_wepos,
  vbep.repos AS invoice_receipt_indicator_repos,
  vbep.lrgdt AS return_date_for_returnable_packaging_lrgdt,
  vbep.prgrs AS date_type_prgrs,
  vbep.tddat AS transportation_planning_date_tddat,
  vbep.mbdat AS material_availability_date_mbdat,
  vbep.lddat AS loading_date_lddat,
  vbep.wadat AS goods_issue_date_wadat,
  vbep.cmeng AS corrected_quantity_in_sales_unit_cmeng,
  vbep.lifsp AS schedule_line_blocked_for_delivery_lifsp,
  vbep.grstr AS group_definition_of_structure_data_grstr,
  vbep.abart AS release_type_abart,
  vbep.abruf AS forecast_delivery_schedule_number_abruf,
  vbep.roms1 AS committed_quantity_roms1,
  vbep.roms2 AS size2_roms2,
  vbep.roms3 AS size3_roms3,
  vbep.romei AS unit_of_measure_for_sizes1to3_romei,
  vbep.rform AS formula_key_rform,
  vbep.umvkz AS numerator_for_conversion_of_sales_quantity_into_sku_umvkz,
  vbep.umvkn AS denominator_for_conversion_of_sales_qty_into_sku_umvkn,
  vbep.verfp AS availability_confirmed_automatically_verfp,
  vbep.bwart AS movement_type_bwart,
  vbep.bnfpo AS item_number_of_purchase_requisition_bnfpo,
  vbep.etart AS schedule_line_type_edi_etart,
  vbep.aufnr AS order_number_aufnr,
  vbep.plnum AS planned_order_number_plnum,
  vbep.sernr AS bom_explosion_number_sernr,
  vbep.aeskd AS customer_engineering_change_status_aeskd,
  vbep.abges AS guaranteed_abges,
  vbep.mbuhr AS material_staging_time_mbuhr,
  vbep.tduhr AS transp_planning_time_tduhr,
  vbep.lduhr AS loading_time_lduhr,
  vbep.wauhr AS time_of_goods_issue_wauhr,
  vbep.aulwe AS route_schedule_aulwe,
  vbep.handoverdate AS handover_date_at_the_handover_location_handoverdate,
  vbep.handovertime AS handover_time_at_the_handover_location_handovertime,
  vbep.mbdat_drs AS material_availability_date_third_party_order_planning_mbdat_drs,
  dimensional_date_edatu.cal_year AS year_of_schedule_line_date_edatu,
  dimensional_date_edatu.cal_month AS month_of_schedule_line_date_edatu,
  dimensional_date_edatu.cal_quarter AS quarter_of_schedule_line_date_edatu,
  dimensional_date_edatu.cal_week AS week_of_schedule_line_date_edatu,
  dimensional_date_bddat.cal_year AS year_of_requirement_date_bddat,
  dimensional_date_bddat.cal_month AS month_of_requirement_date_bddat,
  dimensional_date_bddat.cal_quarter AS quarter_of_requirement_date_bddat,
  dimensional_date_bddat.cal_week AS week_of_requirement_date_bddat,
  IFNULL(
    vbep.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at  
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbep")} AS vbep
LEFT JOIN date_dimension AS dimensional_date_edatu
  ON vbep.edatu = dimensional_date_edatu.date
LEFT JOIN date_dimension AS dimensional_date_bddat
  ON vbep.bddat = dimensional_date_bddat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbep"])
])}
`,
);
