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
    "item_node_stlkn",
    "counter_stasz"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  stas.mandt AS client_mandt,
  stas.stlty AS bill_of_material_category_stlty,
  stas.stlnr AS bill_of_material_stlnr,
  stas.stlal AS alternative_bill_of_material_stlal,
  stas.stlkn AS item_node_stlkn,
  stas.stasz AS counter_stasz,
  stas.datuv AS valid_from_datuv,
  stas.techv AS technical_status_from_techv,
  stas.aennr AS change_number_aennr,
  stas.lkenz AS deletion_indicator_lkenz,
  stas.andat AS created_on_andat,
  stas.annam AS created_by_annam,
  stas.aedat AS changed_on_aedat,
  stas.aenam AS changed_by_aenam,
  stas.dvdat AS scheduled_on_dvdat,
  stas.dvnam AS date_shifted_by_dvnam,
  stas.aehlp AS work_field_aehlp,
  stas.stvkn AS item_node_stvkn,
  stas.idpos AS item_group_idpos,
  stas.idvar AS component_variant_idvar,
  stas.lpsrt AS sort_key_logical_item_lpsrt,
  IFNULL(stas.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "stas")} AS stas
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["stas"])
])}
`
);
