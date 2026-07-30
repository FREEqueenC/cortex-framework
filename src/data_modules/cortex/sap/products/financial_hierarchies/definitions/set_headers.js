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

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  header.mandt AS client_mandt,
  header.setclass AS set_class_setclass,
  header.subclass AS subclass_subclass,
  header.setname AS set_name_setname,
  text.langu AS language_key_langu,
  header.settype AS set_type_settype,
  header.tabname AS table_name_tabname,
  header.fieldname AS field_name_fieldname,
  header.credate AS created_on_credate,
  header.cretime AS created_at_cretime,
  header.creuser AS created_by_creuser,
  header.upddate AS changed_on_upddate,
  header.updtime AS changed_at_updtime,
  header.upduser AS changed_by_upduser,
  text.descript AS set_title_descript,
  GREATEST(
    IFNULL(header.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(text.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setheader')} AS header
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setheadert')} AS text
  ON header.mandt = text.mandt
  AND header.setclass = text.setclass
  AND header.subclass = text.subclass
  AND header.setname = text.setname
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["header", "text"])
])}
`
);
