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
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "language_key_spras",
    "description_language_sprsl"
  ]
);

publish("languages", publishConfig).query(
  (ctx) => `
SELECT
  t002.spras AS language_key_spras,
  t002.laiso AS iso_code_laiso,
  t002t.sprsl AS description_language_sprsl,
  t002t.sptxt AS language_name_sptxt,
  GREATEST(
    IFNULL(t002.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t002t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t002")} AS t002
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t002t")} AS t002t
  ON t002.spras = t002t.spras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t002", "t002t"])
])}
`
);
