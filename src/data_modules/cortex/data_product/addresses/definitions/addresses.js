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
    "client_client",
    "address_number_addrnumber",
    "valid_from_date_date_from",
    "version_id_for_international_addresses_nation",
    "person_number_persnumber",
    "sequence_number_consnumber",
  ]
);

publish("addresses", publishConfig).query(
  (ctx) => `
SELECT
  adrc.client AS client_client,
  adrc.addrnumber AS address_number_addrnumber,
  adrc.date_from AS valid_from_date_date_from,
  adrc.nation AS version_id_for_international_addresses_nation,
  adrc.date_to AS valid_to_date_date_to,
  adrc.title AS form_of_address_key_title,
  adrc.name1 AS name1_name1,
  adrc.name2 AS name2_name2,
  adrc.name3 AS name3_name3,
  adrc.name4 AS name4_name4,
  adrc.name_text AS converted_name_name_text,
  adrc.name_co AS co_name_name_co,
  adrc.city1 AS city_city1,
  adrc.city2 AS district_city2,
  adrc.city_code AS city_code_for_citystreet_file_city_code,
  adrc.cityp_code AS district_code_for_city_and_street_file_cityp_code,
  adrc.home_city AS city_home_city,
  adrc.cityh_code AS different_city_for_citystreet_file_cityh_code,
  adrc.chckstatus AS city_file_test_status_chckstatus,
  adrc.regiogroup AS regional_structure_grouping_regiogroup,
  adrc.post_code1 AS city_postal_code_post_code1,
  adrc.post_code2 AS po_box_postal_code_post_code2,
  adrc.post_code3 AS company_postal_code_post_code3,
  adrc.pcode1_ext AS postl_code_extension_pcode1_ext,
  adrc.pcode2_ext AS postl_code_extension_pcode2_ext,
  adrc.pcode3_ext AS postl_code_extension_pcode3_ext,
  adrc.po_box AS po_box_po_box,
  adrc.dont_use_p AS po_box_address_undeliverable_flag_dont_use_p,
  adrc.po_box_num AS flag_po_box_without_number_po_box_num,
  adrc.po_box_loc AS po_box_city_po_box_loc,
  adrc.city_code2 AS city_po_box_code_city_file_city_code2,
  adrc.po_box_reg AS region_for_po_box_po_box_reg,
  adrc.po_box_cty AS po_box_country_po_box_cty,
  adrc.postalarea AS delivery_district_postalarea,
  adrc.transpzone AS transportation_zone_to_or_from_which_the_goods_are_delivered_transpzone,
  adrc.street AS street_street,
  adrc.dont_use_s AS street_address_undeliverable_flag_dont_use_s,
  adrc.streetcode AS street_number_for_citystreet_file_streetcode,
  adrc.streetabbr AS street_abbreviation_streetabbr,
  adrc.house_num1 AS house_number_house_num1,
  adrc.house_num2 AS house_number_supplement_house_num2,
  adrc.house_num3 AS house_number_range_house_num3,
  adrc.str_suppl1 AS street2_str_suppl1,
  adrc.str_suppl2 AS street3_str_suppl2,
  adrc.str_suppl3 AS street4_str_suppl3,
  adrc.location AS street5_location,
  adrc.building AS building_number_or_code_building,
  adrc.floor AS floor_in_building_floor,
  adrc.roomnumber AS room_or_appartment_number_roomnumber,
  adrc.country AS country_key_country,
  adrc.langu AS language_langu,
  adrc.region AS region_region,
  adrc.addr_group AS address_group_key_business_address_services_addr_group,
  adrc.flaggroups AS flag_there_are_more_address_group_assignments_flaggroups,
  adrc.pers_addr AS flag_this_is_a_personal_address_pers_addr,
  adrc.sort1 AS search_term1_sort1,
  adrc.sort2 AS search_term2_sort2,
  adrc.sort_phn AS sort_phonetically_sort_phn,
  adrc.deflt_comm AS communication_method_key_business_address_services_deflt_comm,
  adrc.tel_number AS first_telephone_no_dialling_codenumber_tel_number,
  adrc.tel_extens AS extension_tel_extens,
  adrc.fax_number AS fax_fax_number,
  adrc.fax_extens AS extension_fax_extens,
  adrc.flagcomm2 AS flag_telephonenumber_s_defined_flagcomm2,
  adrc.flagcomm3 AS flag_faxnumber_s_defined_flagcomm3,
  adrc.flagcomm4 AS flag_teletexnumber_s_defined_flagcomm4,
  adrc.flagcomm5 AS flag_telexnumber_s_defined_flagcomm5,
  adrc.flagcomm6 AS e_mail_address_x_flagcomm6,
  adrc.flagcomm7 AS flag_rml_remote_mail_addresse_s_defined_flagcomm7,
  adrc.flagcomm8 AS flag_x400flagcomm8,
  adrc.flagcomm9 AS flag_rfc_destination_s_defined_flagcomm9,
  adrc.flagcomm10 AS flag_printer_defined_flagcomm10,
  adrc.flagcomm11 AS flag_ssf_defined_flagcomm11,
  adrc.flagcomm12 AS flag_uriftp_address_defined_flagcomm12,
  adrc.flagcomm13 AS flag_pager_address_defined_flagcomm13,
  adrc.addrorigin AS address_source_addrorigin,
  adrc.mc_name1 AS company_name_mc_name1,
  adrc.mc_city1 AS city_mc_city1,
  adrc.mc_street AS street_mc_street,
  adrc.extension1 AS data_line_extension1,
  adrc.extension2 AS telebox_extension2,
  adrc.time_zone AS time_zone_time_zone,
  adrc.taxjurcode AS tax_jurisdiction_taxjurcode,
  adrc.address_id AS address_id_address_id,
  adrc.langu_crea AS creation_language_langu_crea,
  adrc.adrc_uuid AS address_uuid_adrc_uuid,
  adrc.uuid_belated AS uuid_generated_later_uuid_belated,
  adrc.id_category AS address_id_category_id_category,
  adrc.adrc_err_status AS error_status_adrc_err_status,
  adrc.po_box_lobby AS po_box_lobby_po_box_lobby,
  adrc.deli_serv_type AS type_of_delivery_service_deli_serv_type,
  adrc.deli_serv_number AS number_of_delivery_service_deli_serv_number,
  adrc.county_code AS county_code_county_code,
  adrc.county AS county_county,
  adrc.township_code AS township_code_township_code,
  adrc.township AS township_township,
  adrc.mc_county AS county_name_in_upper_case_for_search_help_mc_county,
  adrc.mc_township AS township_name_in_upper_case_for_search_help_mc_township,
  adrc.xpcpt AS business_purpose_completed_flag_xpcpt,
  adrct.remark AS address_notes_remark,
  adr6.persnumber AS person_number_persnumber,
  adr6.consnumber AS sequence_number_consnumber,
  adr6.flgdefault AS default_address_flgdefault,
  adr6.flg_nouse AS do_not_use_communication_number_flg_nouse,
  adr6.home_flag AS home_address_home_flag,
  adr6.smtp_addr AS e_mail_address_smtp_addr,
  adr6.smtp_srch AS e_mail_address_search_smtp_srch,
  adr6.dft_receiv AS standard_recipient_dft_receiv,
  adr6.r3_user AS sap_connection_flag_r3_user,
  adr6.encode AS email_encoding_encode,
  adr6.tnef AS tnef_flag_tnef,
  adr6.valid_from AS valid_from_valid_from,
  adr6.valid_to AS valid_to_valid_to,
  GREATEST(
    IFNULL(adrc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(adr6.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(adrct.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "adrc")} AS adrc
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "adr6")} AS adr6
  ON
    adrc.client = adr6.client
    AND adrc.addrnumber = adr6.addrnumber
    AND adrc.date_from = adr6.date_from
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "adrct")} AS adrct
  ON
    adrc.client = adrct.client
    AND adrc.addrnumber = adrct.addrnumber
    AND adrc.langu = adrct.langu
    AND adrc.date_from = adrct.date_from
    AND adrc.nation = adrct.nation
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["adrc", "adr6", "adrct"]),
  ])}
`
);
