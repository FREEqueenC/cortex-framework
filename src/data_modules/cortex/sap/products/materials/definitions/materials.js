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
  ["client_mandt", "material_number_matnr", "language_key_spras"]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mara.mandt AS client_mandt,
  mara.matnr AS material_number_matnr,
  makt.spras AS language_key_spras,
  makt.maktx AS material_text_maktx,
  mara.ersda AS created_on_ersda,
  mara.ernam AS created_by_ernam,
  mara.laeda AS last_changed_on_laeda,
  mara.aenam AS changed_by_aenam,
  mara.vpsta AS maintenance_status_of_complete_material_vpsta,
  mara.pstat AS maintenance_status_pstat,
  mara.lvorm AS flag_material_for_deletion_at_client_level_lvorm,
  mara.mtart AS material_type_mtart,
  mara.mbrsh AS industry_sector_mbrsh,
  mara.matkl AS material_group_matkl,
  mara.bismt AS old_material_number_bismt,
  mara.meins AS base_unit_of_measure_meins,
  mara.bstme AS order_unit_bstme,
  mara.zeinr AS document_number_without_document_management_system_zeinr,
  mara.zeiar AS document_type_without_document_management_system_zeiar,
  mara.zeivr AS document_version_without_document_management_system_zeivr,
  mara.zeifo AS page_format_of_document_without_document_management_system_zeifo,
  mara.aeszn AS document_change_number_without_document_management_system_aeszn,
  mara.blatt AS page_number_of_document_without_document_management_system_blatt,
  mara.blanz AS number_of_sheets_without_document_management_system_blanz,
  mara.ferth AS production_inspection_memo_ferth,
  mara.formt AS page_format_of_production_memo_formt,
  mara.groes AS size_dimensions_groes,
  mara.wrkst AS basic_material_wrkst,
  mara.normt AS industry_standard_description_such_as_ansi_or_iso_normt,
  mara.labor AS laboratory_design_office_labor,
  mara.ekwsl AS purchasing_value_key_ekwsl,
  mara.brgew AS gross_weight_brgew,
  mara.ntgew AS net_weight_ntgew,
  mara.gewei AS weight_unit_gewei,
  mara.volum AS volume_volum,
  mara.voleh AS volume_unit_voleh,
  mara.behvo AS container_requirements_behvo,
  mara.raube AS storage_conditions_raube,
  mara.tempb AS temperature_conditions_indicator_tempb,
  mara.disst AS low_level_code_disst,
  mara.tragr AS transportation_group_tragr,
  mara.stoff AS hazardous_material_number_stoff,
  mara.spart AS division_spart,
  mara.kunnr AS competitor_kunnr,
  mara.eannr AS european_article_number_eannr,
  mara.wesch AS quantity_number_of_gr_gis_lips_to_be_printed_wesch,
  mara.bwvor AS procurement_rule_bwvor,
  mara.bwscl AS source_of_supply_bwscl,
  mara.saiso AS season_category_saiso,
  mara.etiar AS label_type_etiar,
  mara.etifo AS label_form_etifo,
  mara.entar AS deactivated_entar,
  mara.ean11 AS international_article_number_ean_upc_ean11,
  mara.numtp AS category_of_international_article_number_ean_numtp,
  mara.laeng AS length_laeng,
  mara.breit AS width_breit,
  mara.hoehe AS height_hoehe,
  mara.meabm AS unit_of_dimension_for_length_width_height_meabm,
  mara.prdha AS product_hierarchy_prdha,
  mara.aeklk AS stock_transfer_net_change_costing_aeklk,
  mara.cadkz AS cad_indicator_cadkz,
  mara.qmpur AS qm_in_procurement_is_active_qmpur,
  mara.ergew AS allowed_packaging_weight_ergew,
  mara.ergei AS unit_of_weight_allowed_packaging_weight_ergei,
  mara.ervol AS allowed_packaging_volume_ervol,
  mara.ervoe AS volume_unit_allowed_packaging_volume_ervoe,
  mara.gewto AS excess_weight_tolerance_for_handling_unit_gewto,
  mara.volto AS excess_volume_tolerance_of_the_handling_unit_volto,
  mara.vabme AS variable_purchase_order_unit_active_vabme,
  mara.kzrev AS revision_level_has_been_assigned_to_the_material_kzrev,
  mara.kzkfg AS configurable_material_kzkfg,
  mara.xchpf AS batch_management_requirement_indicator_xchpf,
  mara.vhart AS packaging_material_type_vhart,
  mara.fuelg AS maximum_level_by_volume_fuelg,
  mara.stfak AS stacking_factor_stfak,
  mara.magrv AS material_group_packaging_materials_magrv,
  mara.begru AS authorization_group_begru,
  mara.datab AS valid_from_date_datab,
  mara.liqdt AS deletion_date_liqdt,
  mara.saisj AS season_year_saisj,
  mara.plgtp AS price_band_category_plgtp,
  mara.mlgut AS empties_bill_of_material_mlgut,
  mara.extwg AS external_material_group_extwg,
  mara.satnr AS cross_plant_configurable_material_satnr,
  mara.attyp AS material_category_attyp,
  mara.kzkup AS indicator_material_can_be_coproduct_kzkup,
  mara.kznfm AS indicator_the_material_has_a_follow_up_material_kznfm,
  mara.pmata AS pricing_reference_material_pmata,
  mara.mstae AS cross_plant_material_status_mstae,
  mara.mstav AS cross_distribution_chain_material_status_mstav,
  mara.mstde AS date_from_which_the_cross_plant_material_status_is_valid_mstde,
  mara.mstdv AS date_from_which_the_x_distr_chain_material_status_is_valid_mstdv,
  mara.taklv AS tax_classification_of_the_material_taklv,
  mara.rbnrm AS catalog_profile_rbnrm,
  mara.mhdrz AS minimum_remaining_shelf_life_mhdrz,
  mara.mhdhb AS total_shelf_life_mhdhb,
  mara.mhdlp AS storage_percentage_mhdlp,
  mara.inhme AS content_unit_inhme,
  mara.inhal AS net_contents_inhal,
  mara.vpreh AS comparison_price_unit_vpreh,
  mara.inhbr AS gross_contents_inhbr,
  mara.cmeth AS quantity_conversion_method_cmeth,
  mara.cuobf AS internal_object_number_cuobf,
  mara.kzumw AS environmentally_relevant_kzumw,
  mara.kosch AS product_allocation_determination_procedure_kosch,
  mara.sprof AS pricing_profile_for_variants_sprof,
  mara.nrfhg AS material_qualifies_for_discount_in_kind_nrfhg,
  mara.mfrpn AS manufacturer_part_number_mfrpn,
  mara.mfrnr AS manufacturer_number_mfrnr,
  mara.bmatn AS number_inventory_managed_material_bmatn,
  mara.mprof AS mfr_part_profile_mprof,
  mara.kzwsm AS units_of_measure_usage_kzwsm,
  mara.saity AS rollout_in_a_season_saity,
  mara.profl AS dangerous_goods_indicator_profile_profl,
  mara.ihivi AS indicator_highly_viscous_ihivi,
  mara.iloos AS indicator_in_bulk_liquid_iloos,
  mara.serlv AS level_of_explicitness_for_serial_number_serlv,
  mara.kzgvh AS packaging_material_is_closed_packaging_kzgvh,
  mara.xgchp AS indicator_approved_batch_record_required_xgchp,
  mara.kzeff AS assign_effectivity_parameter_values_override_change_numbers_kzeff,
  mara.compl AS material_completion_level_compl,
  mara.iprkz AS period_indicator_for_shelf_life_expiration_date_iprkz,
  mara.rdmhd AS rounding_rule_for_calculation_of_sled_rdmhd,
  mara.przus AS indicator_product_composition_printed_on_packaging_przus,
  mara.mtpos_mara AS general_item_category_group_mtpos_mara,
  mara.bflme AS generic_material_with_logistical_variants_bflme,
  mara.matfi AS material_is_locked_matfi,
  mara.cmrel AS relevant_for_configuration_management_cmrel,
  mara.bbtyp AS assortment_list_type_bbtyp,
  mara.sled_bbd AS expiration_date_sled_bbd,
  mara.gtin_variant AS global_trade_item_number_variant_gtin_variant,
  mara.gennr AS material_number_of_the_generic_material_in_prepack_materials_gennr,
  mara.rmatp AS reference_material_for_materials_packed_in_same_way_rmatp,
  mara.gds_relevant AS indicator_global_data_synchronization_relevant_gds_relevant,
  mara.weora AS acceptance_at_origin_weora,
  mara.hutyp_dflt AS standard_hu_type_hutyp_dflt,
  mara.pilferable AS pilferable_pilferable,
  mara.whstc AS warehouse_storage_condition_whstc,
  mara.whmatgr AS warehouse_material_group_whmatgr,
  mara.hndlcode AS handling_indicator_hndlcode,
  mara.hazmat AS relevant_for_hazardous_substances_hazmat,
  mara.hutyp AS handling_unit_type_hutyp,
  mara.tare_var AS variable_tare_weight_tare_var,
  mara.maxc AS maximum_allowed_capacity_of_packaging_material_maxc,
  mara.maxc_tol AS over_capacity_tolerance_of_the_handling_unit_maxc_tol,
  mara.maxl AS maximum_packing_length_of_packaging_material_maxl,
  mara.maxb AS maximum_packing_width_of_packaging_material_maxb,
  mara.maxh AS maximum_packing_height_of_packaging_material_maxh,
  mara.maxdim_uom AS unit_of_measure_for_maximum_packing_length_width_height_maxdim_uom,
  mara.herkl AS country_of_origin_of_material_herkl,
  mara.mfrgr AS material_freight_group_mfrgr,
  mara.qqtime AS quarantine_period_qqtime,
  mara.qqtimeuom AS time_unit_for_quarantine_period_qqtimeuom,
  mara.qgrp AS quality_inspection_group_qgrp,
  mara.serial AS serial_number_profile_serial,
  mara.ps_smartform AS form_name_ps_smartform,
  mara.logunit AS ewm_cw_logistics_unit_of_measure_logunit,
  mara.cwqrel AS ewm_cw_material_is_a_catch_weight_material_cwqrel,
  mara.cwqproc AS ewm_cw_catch_weight_profile_for_entering_cw_quantity_cwqproc,
  mara.cwqtolgr AS ewm_catch_weight_tolerance_group_for_ewm_cwqtolgr,
  mara.adprof AS adjustment_profile_adprof,
  mara.ipmipproduct AS id_for_an_intellectual_property_crm_product_ipmipproduct,
  mara.allow_pmat_igno AS variant_price_allowed_for_material_master_allow_pmat_igno,
  mara.medium AS medium_medium,
  mara.commodity AS physical_commodity_commodity,
  mara.brand_id AS brand_brand_id,
  GREATEST(
    IFNULL(mara.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(makt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mara")} AS mara
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "makt")} AS makt
  ON mara.mandt = makt.mandt AND mara.matnr = makt.matnr
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mara", "makt"])
])}
`
);
