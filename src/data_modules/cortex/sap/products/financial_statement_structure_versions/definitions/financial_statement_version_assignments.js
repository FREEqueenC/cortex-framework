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
    "financial_statement_version_versn",
    "financial_statement_item_ergsl",
    "chart_of_accounts_ktopl",
    "gl_account_from_vonkt"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  fagl_011zc.mandt AS client_mandt,
  fagl_011zc.versn AS financial_statement_version_versn,
  fagl_011zc.ergsl AS financial_statement_item_ergsl,
  fagl_011zc.ktopl AS chart_of_accounts_ktopl,
  fagl_011zc.vonkt AS gl_account_from_vonkt,
  fagl_011zc.biskt AS gl_account_to_biskt,
  fagl_011zc.xsoll AS debit_balance_indicator_xsoll,
  fagl_011zc.xhabn AS credit_balance_indicator_xhabn,
  fagl_011zc.xverd AS group_balance_indicator_xverd,
  IFNULL(fagl_011zc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "fagl_011zc")} AS fagl_011zc
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["fagl_011zc"])
])}
`
);
