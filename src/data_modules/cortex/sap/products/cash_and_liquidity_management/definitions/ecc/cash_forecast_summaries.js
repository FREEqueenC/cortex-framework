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

const currency = require("includes/currency.js");
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
    "not_used_segmt",
    "company_code_bukrs",
    "general_ledger_account_number_bnkko",
    "planning_level_ebene",
    "planned_currency_dispw",
    "planning_date_datum",
    "expiration_date_avdat",
    "business_area_gsber",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  fdsb.mandt AS client_mandt,
  fdsb.segmt AS not_used_segmt,
  fdsb.bukrs AS company_code_bukrs,
  fdsb.bnkko AS general_ledger_account_number_bnkko,
  fdsb.ebene AS planning_level_ebene,
  fdsb.dispw AS planned_currency_dispw,
  fdsb.datum AS planning_date_datum,
  fdsb.avdat AS expiration_date_avdat,
  fdsb.gsber AS business_area_gsber,
  ${currency.amountWithDecimalShift("fdsb.wrshb", "currency_decimal_dispw")} AS amount_wrshb,
  ${currency.amountWithDecimalShift("fdsb.dmshb", "currency_decimal_t001")} AS local_currency_amount_dmshb,
  IFNULL(fdsb.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "fdsb")} AS fdsb
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
  ON fdsb.mandt = t001.mandt
  AND fdsb.bukrs = t001.bukrs
LEFT JOIN currency_decimal AS currency_decimal_dispw
  ON fdsb.dispw = currency_decimal_dispw.currkey
LEFT JOIN currency_decimal AS currency_decimal_t001
  ON t001.waers = currency_decimal_t001.currkey
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, "fdsb"),
])}
`
);
