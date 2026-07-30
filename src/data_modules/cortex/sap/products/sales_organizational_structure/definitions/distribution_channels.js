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
    "distribution_channel_vtweg",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  tvtw.mandt as client_mandt,
  tvtw.vtweg as distribution_channel_vtweg,
  tvtwt.spras as language_key_spras,
  tvtwt.vtext as name_vtext,
  GREATEST(
    IFNULL(tvtw.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tvtwt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvtw')} AS tvtw
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvtwt')} AS tvtwt
  ON tvtw.mandt = tvtwt.mandt
  AND tvtw.vtweg = tvtwt.vtweg
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["tvtw", "tvtwt"])
])}
`,
);
