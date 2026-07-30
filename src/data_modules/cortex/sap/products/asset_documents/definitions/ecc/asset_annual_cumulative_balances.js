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
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "depreciation_area_afabe",
    "fiscal_year_gjahr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  anlc.mandt AS client_mandt,
  anlc.bukrs AS company_code_bukrs,
  anlc.anln1 AS asset_number_anln1,
  anlc.anln2 AS asset_subnumber_anln2,
  anlc.afabe AS depreciation_area_afabe,
  anlc.gjahr AS fiscal_year_gjahr,
  anlc.ndabj AS expired_useful_life_ndabj,
  anlc.ndabp AS expired_ul_periods_ndabp,
  anlc.kansw AS cum_acq_production_costs_kansw,
  anlc.knafa AS cum_ordinary_depreciation_knafa,
  anlc.ksafa AS cum_special_depreciation_ksafa,
  anlc.kaafa AS cum_unplanned_depreciation_kaafa,
  IFNULL(anlc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anlc")} AS anlc
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anlc"])
])}
`
);
