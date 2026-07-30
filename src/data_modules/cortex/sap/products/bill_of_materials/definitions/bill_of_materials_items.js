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
    "bill_of_material_category_stlty",
    "bill_of_material_stlnr",
    "item_node_stlkn",
    "counter_stpoz"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  stpo.mandt AS client_mandt,
  stpo.stlty AS bill_of_material_category_stlty,
  stpo.stlnr AS bill_of_material_stlnr,
  stpo.stlkn AS item_node_stlkn,
  stpo.stpoz AS counter_stpoz,
  stpo.datuv AS valid_from_datuv,
  stpo.techv AS technical_status_from_techv,
  stpo.aennr AS change_number_aennr,
  stpo.lkenz AS deletion_indicator_lkenz,
  stpo.vgknt AS predecessor_node_vgknt,
  stpo.vgpzl AS previous_item_counter_vgpzl,
  stpo.andat AS created_on_andat,
  stpo.annam AS created_by_annam,
  stpo.aedat AS changed_on_aedat,
  stpo.aenam AS changed_by_aenam,
  stpo.idnrk AS component_idnrk,
  stpo.pswrk AS issuing_plant_pswrk,
  stpo.postp AS item_category_postp,
  stpo.posnr AS item_number_posnr,
  stpo.sortf AS sort_string_sortf,
  stpo.meins AS component_unit_meins,
  stpo.menge AS component_quantity_menge,
  stpo.fmeng AS fixed_quantity_fmeng,
  stpo.ausch AS component_scrap_percent_ausch,
  stpo.avoau AS operation_scrap_percent_avoau,
  stpo.netau AS net_indicator_netau,
  stpo.schgt AS bulk_material_schgt,
  stpo.beikz AS material_provision_indicator_beikz,
  stpo.erskz AS spare_part_indicator_erskz,
  stpo.rvrel AS relevant_to_sales_rvrel,
  stpo.sanfe AS production_relevant_sanfe,
  stpo.sanin AS plant_maintenance_sanin,
  stpo.sanka AS relevancy_to_costing_sanka,
  stpo.sanko AS engineering_design_sanko,
  stpo.sanvs AS hl_configuration_sanvs,
  stpo.stkkz AS pm_assembly_stkkz,
  stpo.rekri AS recursive_rekri,
  stpo.rekrs AS recurs_allowed_rekrs,
  stpo.cadpo AS cad_indicator_cadpo,
  stpo.nfmat AS follow_up_material_nfmat,
  stpo.nlfzt AS lead_time_offset_nlfzt,
  stpo.verti AS distribution_key_verti,
  stpo.alpos AS alternative_item_alpos,
  stpo.ewahr AS usage_probability_ewahr,
  stpo.ekgrp AS purchasing_group_ekgrp,
  stpo.lifzt AS delivery_time_days_lifzt,
  stpo.lifnr AS vendor_lifnr,
  stpo.preis AS price_preis,
  stpo.peinh AS price_unit_peinh,
  stpo.waers AS currency_waers,
  stpo.sakto AS cost_element_sakto,
  stpo.roanz AS number_of_variable_size_items_roanz,
  stpo.roms1 AS size_1_roms1,
  stpo.roms2 AS size_2_roms2,
  stpo.roms3 AS size_3_roms3,
  stpo.romei AS size_unit_romei,
  stpo.romen AS quantity_of_variable_size_item_romen,
  stpo.rform AS formula_key_rform,
  stpo.upskz AS sub_item_indicator_upskz,
  stpo.valkz AS alternative_id_valkz,
  stpo.ltxsp AS long_text_language_ltxsp,
  stpo.potx1 AS item_text_potx1,
  stpo.potx2 AS item_text_2_potx2,
  stpo.objty AS object_type_objty,
  stpo.matkl AS material_group_matkl,
  stpo.webaz AS goods_receipt_processing_time_webaz,
  stpo.dokar AS document_type_dokar,
  stpo.doknr AS document_doknr,
  stpo.dokvr AS document_version_dokvr,
  stpo.doktl AS document_part_doktl,
  stpo.csstr AS material_purity_percent_csstr,
  stpo.class AS class_class,
  stpo.klart AS class_type_klart,
  stpo.potpr AS reservation_item_category_potpr,
  stpo.awakz AS selection_indicator_awakz,
  stpo.inskz AS instance_inskz,
  stpo.vcekz AS do_not_distribute_in_configuration_vcekz,
  stpo.vstkz AS do_not_distribute_in_document_structure_vstkz,
  stpo.vackz AS do_not_distribute_in_order_vackz,
  stpo.ekorg AS purchasing_organization_ekorg,
  stpo.clobk AS required_component_clobk,
  stpo.clmul AS multiple_selection_clmul,
  stpo.clalt AS alternative_display_clalt,
  stpo.cview AS organizational_area_cview,
  stpo.knobj AS assignment_number_knobj,
  stpo.lgort AS production_storage_location_lgort,
  stpo.kzkup AS co_product_kzkup,
  stpo.intrm AS intra_material_intrm,
  stpo.tpekz AS restrictions_exist_tpekz,
  stpo.stvkn AS item_node_stvkn,
  stpo.dvdat AS scheduled_on_dvdat,
  stpo.dvnam AS date_shifted_by_dvnam,
  stpo.dspst AS explosion_type_dspst,
  stpo.alpst AS strategy_alpst,
  stpo.alprf AS priority_alprf,
  stpo.alpgr AS alternative_item_group_alpgr,
  stpo.kznfp AS follow_up_item_kznfp,
  stpo.nfgrp AS follow_up_group_nfgrp,
  stpo.nfeag AS discontinuation_group_nfeag,
  stpo.kndvb AS manual_change_indicator_kndvb,
  stpo.kndbz AS object_dependency_change_kndbz,
  stpo.kstty AS bill_of_material_category_kstty,
  stpo.kstnr AS bill_of_material_kstnr,
  stpo.kstkn AS item_node_kstkn,
  stpo.kstpz AS counter_kstpz,
  stpo.clszu AS classification_clszu,
  stpo.kzclb AS classification_as_selection_condition_kzclb,
  stpo.aehlp AS work_field_aehlp,
  stpo.prvbe AS production_supply_area_prvbe,
  stpo.nlfzv AS operation_lead_time_offset_nlfzv,
  stpo.nlfmv AS operation_lead_time_offset_unit_nlfmv,
  stpo.idpos AS item_group_idpos,
  stpo.idhis AS history_counter_idhis,
  stpo.idvar AS component_variant_idvar,
  stpo.alekz AS ale_indicator_alekz,
  stpo.itmid AS item_identification_itmid,
  stpo.itsob AS special_procurement_itsob,
  stpo.rfpnt AS reference_point_rfpnt,
  stpo.guidx AS id_item_change_status_guidx,
  stpo.sgt_cmkz AS segment_maintained_sgt_cmkz,
  stpo.sgt_catv AS segmentation_value_sgt_catv,
  stpo.valid_to AS valid_to_valid_to,
  stpo.ecn_to AS change_number_to_ecn_to,
  stpo.ablad AS unloading_point_ablad,
  stpo.wempf AS goods_recipient_wempf,
  stpo.cufactor AS number_of_cu_instances_cufactor,
  stpo.fsh_vmkz AS deviation_values_fsh_vmkz,
  stpo.fsh_pgqr AS quantity_distribution_profile_fsh_pgqr,
  stpo.fsh_pgqrrf AS quantity_distribution_profile_reference_fsh_pgqrrf,
  stpo.fsh_critical_comp AS critical_component_fsh_critical_comp,
  stpo.fsh_critical_level AS critical_level_fsh_critical_level,
  stpo.funcid AS function_identifier_funcid,
  IFNULL(stpo.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "stpo")} AS stpo
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["stpo"])
])}
`
);
