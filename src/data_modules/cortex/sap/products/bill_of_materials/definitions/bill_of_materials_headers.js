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
    "alternative_bill_of_material_stlal",
    "counter_stkoz"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  stko.mandt AS client_mandt,
  stko.stlty AS bill_of_material_category_stlty,
  stko.stlnr AS bill_of_material_stlnr,
  stko.stlal AS alternative_bill_of_material_stlal,
  stko.stkoz AS counter_stkoz,
  stko.datuv AS valid_from_datuv,
  stko.techv AS technical_status_from_techv,
  stko.aennr AS change_number_aennr,
  stko.lkenz AS deletion_indicator_lkenz,
  stko.loekz AS deletion_flag_loekz,
  stko.vgkzl AS previous_header_counter_vgkzl,
  stko.andat AS created_on_andat,
  stko.annam AS created_by_annam,
  stko.aedat AS changed_on_aedat,
  stko.aenam AS changed_by_aenam,
  stko.bmein AS base_unit_of_measure_bmein,
  stko.bmeng AS base_quantity_bmeng,
  stko.cadkz AS cad_indicator_cadkz,
  stko.labor AS laboratory_office_labor,
  stko.ltxsp AS long_text_language_ltxsp,
  stko.stktx AS alternative_text_stktx,
  stko.stlst AS bill_of_material_status_stlst,
  stko.wrkan AS created_in_plant_wrkan,
  stko.dvdat AS scheduled_on_dvdat,
  stko.dvnam AS date_shifted_by_dvnam,
  stko.aehlp AS work_field_aehlp,
  stko.alekz AS ale_indicator_alekz,
  stko.guidx AS id_item_change_status_guidx,
  stko.valid_to AS valid_to_valid_to,
  stko.ecn_to AS change_number_to_ecn_to,
  IFNULL(stko.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "stko")} AS stko
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["stko"])
])}
`
);
