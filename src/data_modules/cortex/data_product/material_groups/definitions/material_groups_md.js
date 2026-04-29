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

const materializationType = tableConfig.materializationType || "view";

const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "material_group_matkl",
    "language_spras"
  ]
);

publish("material_groups_md", publishConfig).query(
  (ctx) => `
SELECT
  t023.mandt AS client_mandt,
  t023.matkl AS material_group_matkl,
  t023t.spras AS language_spras,
  t023t.wgbez AS material_group_name_wgbez,
  t023t.wgbez60 AS material_group_name_long_wgbez60,
  t023.spart AS division_spart,
  t023.abtnr AS department_abtnr,
  t023.anlkl AS asset_class_anlkl,
  t023.begru AS authorization_group_begru,
  t023.bklas AS valuation_class_bklas,
  t023.ekwsl AS purchasing_value_key_ekwsl,
  t023.gewei AS default_unit_of_weight_gewei,
  t023.price_group AS price_level_group_price_group,
  t023.def_schdsc AS scenario_def_schdsc,
  t023.j_1bnbm AS ncm_code_j_1bnbm,
  t023.lref3 AS logist_reference_lref3,
  t023.wwgda AS reference_group_ref_material_wwgda,
  t023.wwgpa AS group_material_wwgpa,
  -- SAFE GREATEST: Protects against NULLs if Text is missing
  GREATEST(
    IFNULL(t023.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t023t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't023')} AS t023
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't023t')} AS t023t
  ON t023.mandt = t023t.mandt
  AND t023.matkl = t023t.matkl
${incremental.getWhere(ctx, ["t023.recordstamp", "t023t.recordstamp"])}
`
);
