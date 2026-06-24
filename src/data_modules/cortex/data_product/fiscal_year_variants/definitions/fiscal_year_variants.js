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
    "fiscal_year_variant_periv",
  ]
);

publish("fiscal_year_variants", publishConfig).query(
  (ctx) => `
SELECT
  t009.mandt AS client_mandt,
  t009.periv AS fiscal_year_variant_periv,
  t009.xkale AS calendar_year_xkale,
  t009.xjabh AS year_dependent_xjabh,
  t009.anzbp AS number_of_posting_periods_anzbp,
  t009.anzsp AS number_of_special_periods_anzsp,
  t009.xweek AS fiscal_weeks_from_fy_start_xweek,
  t009.fyofb AS offset_before_fiscal_year_fyofb,
  t009.fyofe AS offset_after_fiscal_year_fyofe,
  t009.xweekquart AS weekly_calendar_xweekquart,
  IFNULL(t009.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t009")} AS t009
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t009"])
])}
`
);
