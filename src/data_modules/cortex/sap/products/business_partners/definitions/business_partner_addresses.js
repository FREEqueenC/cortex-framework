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
    "client_client",
    "business_partner_partner",
    "address_number_addrnumber",
    "valid_from"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  but020.client AS client_client,
  but020.partner AS business_partner_partner,
  but020.addrnumber AS address_number_addrnumber,
  ${sql_helper.parseValidityFromTimestamp("but020.addr_valid_from")} AS valid_from,
  ${sql_helper.parseValidityToTimestamp("but020.addr_valid_to")} AS valid_to,
  but020.xdfadr AS standard_address_xdfadr,
  but020.addr_move_date AS date_of_move_addr_move_date,
  but020.move_addr AS move_target_address_move_addr,
  but020.adext AS external_address_no_adext,
  adrc.title AS form_of_address_key_title,
  adrc.name1 AS addr_name1,
  adrc.name2 AS addr_name2,
  adrc.name3 AS addr_name3,
  adrc.name4 AS addr_name4,
  adrc.city1 AS addr_city1,
  adrc.city2 AS addr_district_city2,
  adrc.city_code AS city_code_city_code,
  adrc.cityp_code AS district_code_cityp_code,
  adrc.home_city AS city_home_city,
  adrc.cityh_code AS different_city_for_citystreet_file_cityh_code,
  adrc.regiogroup AS regional_structure_grouping_regiogroup,
  adrc.post_code1 AS city_postal_code_post_code1,
  adrc.post_code2 AS po_box_postal_code_post_code2,
  adrc.post_code3 AS company_postal_code_post_code3,
  adrc.po_box AS po_box_po_box,
  adrc.dont_use_p AS po_box_address_undeliverable_flag_dont_use_p,
  adrc.po_box_num AS flag_po_box_without_number_po_box_num,
  adrc.po_box_loc AS po_box_city_po_box_loc,
  adrc.city_code2 AS city_po_box_code_city_file_city_code2,
  adrc.po_box_reg AS region_for_po_box_po_box_reg,
  adrc.po_box_cty AS po_box_country_po_box_cty,
  adrc.transpzone AS transportation_zone_to_or_from_which_the_goods_are_delivered_transpzone,
  adrc.street AS street_street,
  adrc.dont_use_s AS street_address_undeliverable_flag_dont_use_s,
  adrc.streetcode AS street_number_for_citystreet_file_streetcode,
  adrc.house_num1 AS house_number_house_num1,
  adrc.house_num2 AS house_number_supplement_house_num2,
  adrc.str_suppl1 AS street2_str_suppl1,
  adrc.str_suppl2 AS street3_str_suppl2,
  adrc.str_suppl3 AS street4_str_suppl3,
  adrc.location AS street5_location,
  adrc.building AS building_number_or_code_building,
  adrc.floor AS floor_in_building_floor,
  adrc.roomnumber AS room_or_appartment_number_roomnumber,
  adrc.country AS country_country,
  adrc.langu AS language_langu,
  adrc.region AS region_addr_region,
  adrc.addr_group AS address_group_key_business_address_services_addr_group,
  adrc.flaggroups AS flag_there_are_more_address_group_assignments_flaggroups,
  adrc.pers_addr AS flag_this_is_a_personal_address_pers_addr,
  adrc.sort1 AS search_term1_sort1,
  adrc.sort2 AS search_term2_sort2,
  adrc.deflt_comm AS communication_method_key_business_address_services_deflt_comm,
  adrc.tel_number AS first_telephone_no_dialling_codenumber_tel_number,
  adrc.tel_extens AS first_telephone_no_extension_tel_extens,
  adrc.fax_number AS first_fax_no_dialling_codenumber_fax_number,
  adrc.fax_extens AS first_fax_no_extension_fax_extens,
  adrc.county_code AS county_code_for_county_county_code,
  adrc.county AS county_addr_county,
  adrc.township_code AS township_code_for_township_township_code,
  adrc.township AS township_township,
  adrc.mc_county AS county_name_in_upper_case_for_search_help_mc_county,
  adrc.mc_township AS township_name_in_upper_case_for_search_help_mc_township,
  adrc.xpcpt AS business_purpose_completed_flag_xpcpt,
  adrct.remark AS address_notes_remark,
  adr6.smtp_addr AS e_mail_address_smtp_addr,
  GREATEST(
    IFNULL(but020.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(adrc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(adr6.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(adrct.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "but020")} AS but020
LEFT JOIN 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'adrc')} AS adrc
  ON but020.client = adrc.client
  AND but020.addrnumber = adrc.addrnumber
  AND adrc.date_to = CAST('9999-12-31' AS DATE)
  AND COALESCE(adrc.nation, '') = ''
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "adr6")} AS adr6
  ON but020.client = adr6.client
  AND but020.addrnumber = adr6.addrnumber
  AND adrc.date_from = adr6.date_from
  AND COALESCE(adr6.persnumber, '') = ''
  AND adr6.flgdefault = 'X'
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "adrct")} AS adrct
  ON but020.client = adrct.client
  AND but020.addrnumber = adrct.addrnumber
  AND adrc.langu = adrct.langu
  AND adrc.date_from = adrct.date_from
  AND COALESCE(adrct.nation, '') = ''
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["but020", "adrc", "adr6", "adrct"])
])}
`
);
