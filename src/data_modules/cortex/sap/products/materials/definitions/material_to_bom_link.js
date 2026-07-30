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
    "material_number_matnr",
    "plant_werks",
    "bom_usage_stlan",
    "bill_of_material_stlnr",
    "alternative_bom_stlal"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mast.mandt AS client_mandt,
  mast.matnr AS material_number_matnr,
  mast.werks AS plant_werks,
  mast.stlan AS bom_usage_stlan,
  mast.stlnr AS bill_of_material_stlnr,
  mast.stlal AS alternative_bom_stlal,
  mast.losvn AS from_lot_size_losvn,
  mast.losbs AS to_lot_size_losbs,
  mast.andat AS created_on_andat,
  mast.annam AS created_by_annam,
  mast.aedat AS changed_on_aedat,
  mast.aenam AS changed_by_aenam,
  mast.cslty AS configured_material_cslty,
  IFNULL(mast.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mast")} AS mast
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mast"])
])}
`
);
