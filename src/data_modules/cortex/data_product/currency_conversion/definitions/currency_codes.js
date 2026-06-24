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
    "currency_code_waers",
    "language_spras"
  ]
);

publish("currency_codes", publishConfig).query(
  (ctx) => `
SELECT
  tcurc.mandt AS client_mandt,
  tcurc.waers AS currency_code_waers,
  tcurc.isocd AS currency_iso_isocd,
  tcurx.currdec AS currency_decimals_currdec,
  tcurt.spras AS language_spras,
  tcurt.ktext AS curr_short_text_ktext,
  tcurt.ltext AS curr_long_text_ltext,
  GREATEST(
    IFNULL(tcurc.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00")),
    IFNULL(tcurt.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00")),
    IFNULL(tcurx.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00"))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurc")} AS tcurc
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx")} AS tcurx
  -- TCURX does not have mandt column, it is cross client in SAP
  ON tcurc.waers = tcurx.currkey
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurt")} AS tcurt
  ON tcurc.waers = tcurt.waers
  AND tcurc.mandt = tcurt.mandt
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["tcurc", "tcurt", "tcurx"])
  ])}
`
);
