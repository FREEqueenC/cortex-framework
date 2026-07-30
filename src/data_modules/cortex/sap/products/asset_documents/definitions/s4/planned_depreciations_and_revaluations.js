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
const currency = require("includes/currency.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "fiscal_year_gjahr",
    "depreciation_area_afabe",
    "posting_period_poper",
    "sla_line_item_type_slalittype"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH 
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  faat_plan_values.mandt AS client_mandt,
  faat_plan_values.bukrs AS company_code_bukrs,
  faat_plan_values.anln1 AS asset_number_anln1,
  faat_plan_values.anln2 AS asset_subnumber_anln2,
  faat_plan_values.gjahr AS fiscal_year_gjahr,
  faat_plan_values.afabe AS depreciation_area_afabe,
  faat_plan_values.poper AS posting_period_poper,
  faat_plan_values.slalittype AS sla_line_item_type_slalittype,
  faat_plan_values.ldgrp AS ledger_group_ldgrp,
  faat_plan_values.anlgr AS group_asset_anlgr,
  faat_plan_values.anlgr2 AS group_asset_subnumber_anlgr2,
  faat_plan_values.movcat AS transaction_type_category_movcat,
  ${currency.amountWithDecimalShift("faat_plan_values.hsl", "curr_local")} AS amount_posted_in_company_code_currency_hsl,
  ${currency.amountWithDecimalShift("faat_plan_values.ksl", "curr_global")} AS amount_posted_in_global_currency_ksl,
  faat_plan_values.rhcur AS company_code_currency_rhcur,
  faat_plan_values.rkcur AS global_currency_rkcur,
  faat_plan_values.anlkl AS asset_class_anlkl,
  faat_plan_values.ktogr AS account_determination_ktogr,
  faat_plan_values.xpost AS to_be_posted_xpost,
  IFNULL(
    faat_plan_values.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "faat_plan_values")} AS faat_plan_values
LEFT JOIN currency_decimal AS curr_local
  ON faat_plan_values.rhcur = curr_local.currkey
LEFT JOIN currency_decimal AS curr_global
  ON faat_plan_values.rkcur = curr_global.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["faat_plan_values"])
])}
`,
);
