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
    "hierarchy_id_hryid",
    "hierarchy_version_hryver",
    "valid_to_hryvalto",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mandt AS client_mandt,
  hryid AS hierarchy_id_hryid,
  hryver AS hierarchy_version_hryver,
  hryvalto AS valid_to_hryvalto,
  hryvalfrom AS valid_from_hryvalfrom,
  hrytyp AS hierarchy_type_hrytyp,
  updtime AS last_updated_at_updtime,
  upduser AS last_changed_by_upduser,
  IFNULL(recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'hrrp_directory')} AS hrrp_directory
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["hrrp_directory"])
])}
`
);
