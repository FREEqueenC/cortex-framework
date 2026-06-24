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

const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const materializationType = tableConfig.materializationType || "incremental";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "object_number_objnr",
    "ledger_lednr",
    "value_type_wrttp",
    "object_indicator_trgkz",
    "fiscal_year_gjahr",
    "value_category_acpos",
    "budget_type_vorga",
    "version_versn",
    "category_abkat",
    "fund_geber",
    "transaction_currency_twaer",
    "period_block_perbl"
  ]
);

publish("project_info_database", publishConfig).query(
  (ctx) => `
    SELECT
      rpsco.mandt AS client_mandt,
      rpsco.objnr AS object_number_objnr,
      rpsco.lednr AS ledger_lednr,
      rpsco.wrttp AS value_type_wrttp,
      rpsco.trgkz AS object_indicator_trgkz,
      rpsco.gjahr AS fiscal_year_gjahr,
      rpsco.acpos AS value_category_acpos,
      rpsco.vorga AS budget_type_vorga,
      rpsco.versn AS version_versn,
      rpsco.abkat AS category_abkat,
      rpsco.geber AS fund_geber,
      rpsco.twaer AS transaction_currency_twaer,
      rpsco.perbl AS period_block_perbl,
      rpsco.beltp AS debit_type_beltp,
      rpsco.wlp00 AS period_value_wlp00,
      rpsco.wlp01 AS period_value_wlp01,
      rpsco.wlp02 AS period_value_wlp02,
      rpsco.wlp03 AS period_value_wlp03,
      rpsco.wlp04 AS period_value_wlp04,
      rpsco.wlp05 AS period_value_wlp05,
      rpsco.wlp06 AS period_value_wlp06,
      rpsco.wlp07 AS period_value_wlp07,
      rpsco.wlp08 AS period_value_wlp08,
      rpsco.wlp09 AS period_value_wlp09,
      rpsco.wlp10 AS period_value_wlp10,
      rpsco.wlp11 AS period_value_wlp11,
      rpsco.wlp12 AS period_value_wlp12,
      rpsco.wlp13 AS period_value_wlp13,
      rpsco.wlp14 AS period_value_wlp14,
      rpsco.wlp15 AS period_value_wlp15,
      rpsco.wlp16 AS period_value_wlp16,
      rpsco.wtp00 AS annual_value_wtp00,
      rpsco.wtp01 AS annual_value_wtp01,
      rpsco.wtp02 AS annual_value_wtp02,
      rpsco.wtp03 AS annual_value_wtp03,
      rpsco.wtp04 AS annual_value_wtp04,
      rpsco.wtp05 AS annual_value_wtp05,
      rpsco.wtp06 AS annual_value_wtp06,
      rpsco.wtp07 AS annual_value_wtp07,
      rpsco.wtp08 AS annual_value_wtp08,
      rpsco.wtp09 AS annual_value_wtp09,
      rpsco.wtp10 AS annual_value_wtp10,
      rpsco.wtp11 AS annual_value_wtp11,
      rpsco.wtp12 AS annual_value_wtp12,
      rpsco.wtp13 AS annual_value_wtp13,
      rpsco.wtp14 AS annual_value_wtp14,
      rpsco.wtp15 AS annual_value_wtp15,
      rpsco.wtp16 AS annual_value_wtp16,
      GREATEST(
        IFNULL(rpsco.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00"))
      ) AS source_last_updated_at,
      CURRENT_TIMESTAMP() AS bq_loaded_at
    FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rpsco")} AS rpsco
    ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["rpsco"])
  ])}
  `
);
