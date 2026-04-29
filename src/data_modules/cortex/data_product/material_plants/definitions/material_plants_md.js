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

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "material_number_matnr",
    "plant_werks"
  ]
);

publish("material_plants_md", publishConfig).query(
    (ctx) => `
SELECT
  marc.mandt as client_mandt,
  marc.matnr as material_number_matnr,
  marc.werks as plant_werks,
  marc.pstat as maintenance_status_pstat,
  marc.lvorm as flag_material_for_deletion_at_plant_level_lvorm,
  marc.bwtty as valuation_category_bwtty,
  marc.xchar as batch_management_indicator_xchar,
  marc.mmsta as plant_specific_material_status_mmsta,
  marc.mmstd as date_from_which_the_plant_specific_material_status_is_valid_mmstd,
  marc.eisbe as safety_stock_eisbe,
  IFNULL(marc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "marc")} AS marc
${incremental.getWhere(ctx, ["marc.recordstamp"])}
`
);
