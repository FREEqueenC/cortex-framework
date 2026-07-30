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
    "country_key_land1"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t005k.mandt AS client_mandt,
  t005k.land1 AS country_key_land1,
  t005k.teleffrom AS international_dialing_code_for_telephonefax_teleffrom,
  t005k.telefto AS country_telephonefax_dialling_code_telefto,
  t005k.telefrm AS digit_to_be_deleted_for_calls_from_abroad_telefrm,
  t005k.telexfrom AS foreign_dialling_code_for_telex_telexfrom,
  t005k.telexto AS foreign_dialling_code_for_telex_telexto,
  t005k.mobile_sms AS indicator_mobile_telephones_are_sms_enabled_by_default_mobile_sms,
  IFNULL(t005k.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t005k")} AS t005k
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t005k"])
])}
`
);
