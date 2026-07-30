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
    "business_partner_partner"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  but000.client AS client_client,
  but000.partner AS business_partner_partner,
  but000.type AS bp_category_type,
  but000.bpkind AS bp_type_bpkind,
  but000.bu_group AS grouping_bu_group,
  but000.bp_sort AS phonetic_sort_field_bp_sort,
  but000.title AS title_title,
  but000.name_org1 AS name_1_name_org1,
  but000.name_org2 AS name_2_name_org2,
  but000.name_org3 AS name_3_name_org3,
  but000.name_org4 AS name_4_name_org4,
  but000.legal_enty AS legal_form_legal_enty,
  but000.ind_sector AS industry_sector_ind_sector,
  but000.found_dat AS date_founded_found_dat,
  but000.liquid_dat AS liquidation_date_liquid_dat,
  but000.legal_org AS legal_entity_legal_org,
  but000.name_last AS last_name_name_last,
  but000.name_first AS first_name_name_first,
  but000.name_lst2 AS other_last_name_name_lst2,
  but000.name_last2 AS name_at_birth_name_last2,
  but000.namemiddle AS middle_name_namemiddle,
  but000.title_aca1 AS academic_title_1_title_aca1,
  but000.title_aca2 AS academic_title_2_title_aca2,
  but000.title_royl AS name_supplement_title_royl,
  but000.prefix1 AS prefix_1_prefix1,
  but000.prefix2 AS prefix_2_prefix2,
  but000.initials AS initials_initials,
  but000.nickname AS known_as_nickname,
  but000.gender AS sex_gender,
  but000.marst AS marital_status_marst,
  but000.emplo AS employer_emplo,
  but000.jobgr AS occupation_jobgr,
  but000.birthdt AS date_of_birth_birthdt,
  but000.birthpl AS birthplace_birthpl,
  but000.birthdt_status AS birth_date_status_birthdt_status,
  but000.deathdt AS death_date_deathdt,
  but000.xsexm AS male_xsexm,
  but000.xsexf AS female_xsexf,
  but000.xsexu AS unknown_xsexu,
  but000.xblck AS central_block_xblck,
  but000.xdele AS archiving_flag_xdele,
  but000.xpcpt AS purpose_completed_flag_xpcpt,
  but000.bu_langu AS language_bu_langu,
  but000.langu_corr AS correspondence_lang_langu_corr,
  but000.valid_from AS valid_from_valid_from,
  but000.valid_to AS valid_to_valid_to,
  but000.natpers AS natural_person_natpers,
  but000.bu_sort1 AS search_term_1_bu_sort1,
  but000.bu_sort2 AS search_term_2_bu_sort2,
  but000.source AS data_origin_source,
  but000.augrp AS authorization_group_augrp,
  but000.perno AS personnel_number_perno,
  but000.persnumber AS person_number_persnumber,
  but000.addrcomm AS address_number_addrcomm,
  but000.td_switch AS partner_converted_td_switch,
  but000.is_org_centre AS is_org_center_is_org_centre,
  but000.bpext AS external_bp_number_bpext,
  but000.bu_logsys AS logical_system_bu_logsys,
  but000.partner_guid AS business_partner_guid_partner_guid,
  but000.chusr AS changed_by_chusr,
  but000.chdat AS changed_on_chdat,
  but000.chtim AS changed_at_chtim,
  but000.crusr AS created_by_crusr,
  but000.crdat AS created_on_crdat,
  but000.crtim AS created_at_crtim,
  but000.not_released AS not_released_not_released,
  but000.not_lg_competent AS not_legally_competent_not_lg_competent,
  but000.title_let AS salutation_title_let,
  but000.contact AS contact_contact,
  but000.print_mode AS print_format_print_mode,
  but000.location_1 AS int_location_no_1_location_1,
  but000.location_2 AS int_location_no_2_location_2,
  but000.location_3 AS check_digit_location_3,
  but000.natio AS nationality_natio,
  but000.cntax AS cntax,
  but000.cndsc AS country_of_origin_cndsc,
  but000.xubname AS user_name_xubname,
  but000.children AS children_children,
  but000.mem_house AS mem_house,
  but000.partgrptyp AS partner_group_type_partgrptyp,
  but000.name_grp1 AS name_1_name_grp1,
  but000.name_grp2 AS name_2_name_grp2,
  but000.mc_name1 AS name_1_last_name_mc_name1,
  but000.mc_name2 AS name_2_first_name_mc_name2,
  but000.db_key AS db_key,
  but000.par_rel AS release_necessary_par_rel,
  but000.kbanks AS bank_country_kbanks,
  but000.kbankl AS bank_key_kbankl,
  but000.recordstamp AS but000_recordstamp,
  GREATEST(
    IFNULL(but000.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "but000")} AS but000
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["but000"])
])}
`
);
