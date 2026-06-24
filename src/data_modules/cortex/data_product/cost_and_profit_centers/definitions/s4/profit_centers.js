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
  ["client_mandt", "profit_center_prctr", "valid_to_date_datbi", "controlling_area_kokrs", "language_spras"]
);

publish("profit_centers", publishConfig).query(
  (ctx) => `
SELECT
  cepc.mandt AS client_mandt,
  cepc.prctr AS profit_center_prctr,
  cepc.datbi AS valid_to_date_datbi,
  cepc.kokrs AS controlling_area_kokrs,
  cepct.spras AS language_spras,
  cepc.datab AS valid_from_date_datab,
  cepc.ersda AS created_on_ersda,
  cepc.usnam AS entered_by_usnam,
  cepc.merkmal AS field_name_of_co_pa_characteristic_merkmal,
  cepc.abtei AS department_abtei,
  cepc.verak AS person_responsible_for_profit_center_verak,
  cepc.verak_user AS user_responsible_for_the_profit_center_verak_user,
  cepc.waers AS currency_key_waers,
  cepc.nprctr AS successor_profit_center_nprctr,
  cepc.land1 AS country_key_land1,
  cepc.anred AS title_anred,
  cepc.name1 AS name1_name1,
  cepc.name2 AS name2_name2,
  cepc.name3 AS name3_name3,
  cepc.name4 AS name4_name4,
  cepc.ort01 AS city_ort01,
  cepc.ort02 AS district_ort02,
  cepc.stras AS street_and_house_number_stras,
  cepc.pfach AS po_box_pfach,
  cepc.pstlz AS postal_code_pstlz,
  cepc.pstl2 AS po_box_postal_code_pstl2,
  cepc.spras AS ctr_language_spras,
  cepc.telbx AS telebox_number_telbx,
  cepc.telf1 AS first_telephone_number_telf1,
  cepc.telf2 AS second_telephone_number_telf2,
  cepc.telfx AS fax_number_telfx,
  cepc.teltx AS teletex_number_teltx,
  cepc.telx1 AS telex_number_telx1,
  cepc.datlt AS data_communication_line_no_datlt,
  cepc.drnam AS printer_name_for_profit_center_drnam,
  cepc.khinr AS profit_center_area_khinr,
  cepc.bukrs AS company_code_bukrs,
  cepc.vname AS joint_venture_vname,
  cepc.recid AS recovery_indicator_recid,
  cepc.etype AS equity_type_etype,
  cepc.txjcd AS tax_jurisdiction_txjcd,
  cepc.regio AS region_state_regio,
  cepc.kvewe AS usage_of_the_condition_table_kvewe,
  cepc.kappl AS application_kappl,
  cepc.kalsm AS procedure_pricing_kalsm,
  cepc.logsystem AS logical_system_logsystem,
  cepc.lock_ind AS lock_indicator_lock_ind,
  cepc.pca_template AS template_for_formula_planning_in_profit_centers_pca_template,
  cepc.segment AS segment_for_segmental_reporting_segment,
  cepct.datbi AS txt_valid_to_date_datbi,
  cepct.ktext AS general_name_ktext,
  cepct.ltext AS long_text_ltext,
  cepct.mctxt AS search_term_for_matchcode_search_mctxt,
  GREATEST(
    IFNULL(cepc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(cepct.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cepc")} AS cepc
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cepct")} AS cepct
  ON cepc.mandt = cepct.mandt
    AND cepc.prctr = cepct.prctr
    AND cepc.datbi = cepct.datbi
    AND cepc.kokrs = cepct.kokrs
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["cepc", "cepct"])
])}
`
);
