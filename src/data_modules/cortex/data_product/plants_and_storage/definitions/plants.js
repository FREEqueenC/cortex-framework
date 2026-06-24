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
  [
    "client_mandt",
    "plant_werks"
  ]
);

publish("plants", publishConfig).query(
  (ctx) => `
SELECT
  t001w.mandt AS client_mandt,
  t001w.werks AS plant_werks,
  t001w.name1 AS name_name1,
  t001w.bwkey AS valuation_area_bwkey,
  t001w.kunnr AS customer_number_of_plant_kunnr,
  t001w.lifnr AS vendor_number_of_plant_lifnr,
  t001w.fabkl AS factory_calendar_key_fabkl,
  t001w.name2 AS name2_name2,
  t001w.stras AS street_and_house_number_stras,
  t001w.pfach AS po_box_pfach,
  t001w.pstlz AS postal_code_pstlz,
  t001w.ort01 AS city_ort01,
  t001w.ekorg AS purchasing_organization_ekorg,
  t001w.vkorg AS sales_organization_for_intercompany_billing_vkorg,
  t001w.chazv AS indicator_batch_status_management_active_chazv,
  t001w.kkowk AS indicator_conditions_at_plant_level_kkowk,
  t001w.kordb AS indicator_source_list_requirement_kordb,
  t001w.bedpl AS activating_requirements_planning_bedpl,
  t001w.land1 AS country_key_land1,
  t001w.regio AS region_county_regio,
  t001w.counc AS county_code_counc,
  t001w.cityc AS city_code_cityc,
  t001w.adrnr AS address_adrnr,
  t001w.iwerk AS maintenance_planning_plant_iwerk,
  t001w.txjcd AS tax_jurisdiction_txjcd,
  t001w.vtweg AS distribution_channel_for_intercompany_billing_vtweg,
  t001w.spart AS division_for_intercompany_billing_spart,
  t001w.spras AS language_spras,
  t001w.wksop AS sop_plant_wksop,
  t001w.awsls AS variance_key_awsls,
  t001w.chazv_old AS indicator_batch_status_management_active_chazv_old,
  t001w.vlfkz AS plant_category_vlfkz,
  t001w.bzirk AS sales_district_bzirk,
  t001w.zone1 AS supply_region_zone1,
  t001w.taxiw AS tax_indicator_plant_taxiw,
  t001w.bzqhl AS take_regular_vendor_into_account_bzqhl,
  t001w.let01 AS number_of_days_for_first_reminder_expediter_let01,
  t001w.let02 AS number_of_days_for_second_reminder_expediter_let02,
  t001w.let03 AS number_of_days_for_third_reminder_expediter_let03,
  t001w.txnam_ma1 AS text_name_of_1st_dunning_of_vendor_declarations_txnam_ma1,
  t001w.txnam_ma2 AS text_name_of_2nd_dunning_of_vendor_declarations_txnam_ma2,
  t001w.txnam_ma3 AS text_name_of_3rd_dunning_of_vendor_declarations_txnam_ma3,
  t001w.betol AS number_of_days_for_po_tolerance_compress_info_records_su_betol,
  t001w.j_1bbranch AS business_place_j_1bbranch,
  t001w.vtbfi AS rule_for_determining_the_sales_area_for_stock_transfers_vtbfi,
  t001w.fprfw AS distribution_profile_at_plant_level_fprfw,
  t001w.achvm AS central_archiving_marker_for_master_record_achvm,
  t001w.dvsart AS batch_record_type_of_dms_used_dvsart,
  t001w.nodetype AS node_type_supply_chain_network_nodetype,
  t001w.nschema AS structure_for_name_formation_nschema,
  t001w.pkosa AS cost_object_controlling_linking_active_pkosa,
  t001w.misch AS updating_is_active_for_mixed_costing_misch,
  t001w.mgvupd AS updating_is_active_in_actual_costing_mgvupd,
  t001w.vstel AS shipping_point_receiving_point_vstel,
  t001w.mgvlaupd AS update_of_activity_consumption_in_the_quantity_structure_mgvlaupd,
  t001w.mgvlareval AS control_of_credit_of_cost_centers_mgvlareval,
  t001w.sourcing AS invoke_added_function_source_determination_via_atp_sourcing,
  t001w.storetype AS store_category_to_differentiate_store_shop_storetype,
  t001w.dep_store AS superior_department_store_dep_store,
  IFNULL(t001w.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001w")} AS t001w
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t001w"])
])}
  `
);
