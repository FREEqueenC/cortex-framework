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
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "country_key_land1",
    "region_bland",
    "language_key_spras"
  ]
);

publish("country_tax_regions", publishConfig).query(
  (ctx) => `
SELECT
  t005s.mandt AS client_mandt,
  t005s.land1 AS country_key_land1,
  t005s.bland AS region_bland,
  t005u.spras AS language_key_spras,
  t005u.bezei AS region_name_bezei,
  t005s.fprcd AS provincial_tax_code_fprcd,
  t005s.herbl AS state_of_manufacture_herbl,
  GREATEST(
    IFNULL(t005s.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t005u.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t005s")} AS t005s
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t005u")} AS t005u
  ON t005s.mandt = t005u.mandt
  AND t005s.land1 = t005u.land1
  AND t005s.bland = t005u.bland
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t005s", "t005u"])
])}
`
);
