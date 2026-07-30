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
    "set_class_setclass",
    "subclass_subclass",
    "set_name_setname",
    "language_key_langu",
  ]
);

const filters = tableConfig.filters || {};
const setClasses = filters.set_classes || ["0101"];

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mandt AS client_mandt,
  setclass AS set_class_setclass,
  subclass AS subclass_subclass,
  setname AS set_name_setname,
  langu AS language_key_langu,
  descript AS short_description_of_set_descript,
  IFNULL(recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setheadert')} AS setheadert
${sql_helper.buildDynamicWhere([
  `setclass IN (${sql_helper.formatFilterArray(setClasses)})`,
  incremental.getFilter(ctx, ["setheadert"])
])}
`
);
