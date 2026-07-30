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
const materializationType = tableConfig.materializationType || "view";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t001.mandt AS client_mandt,
  t001.bukrs AS company_code_bukrs,
  t001.waers AS currency_code_waers,
  t001.butxt AS company_text_butxt,
  t001.ort01 AS city_name_ort01,
  t001.land1 AS country_land1,
  t001.spras AS language_spras,
  t001.ktopl AS chart_of_accounts_ktopl,
  t001.periv AS fiscal_year_variant_periv,
  t001.rcomp AS company_rcomp,
  t001.kkber AS credit_control_area_kkber,
  t001.ktop2 AS country_chart_of_accounts_ktop2,
  t001.fikrs AS funds_management_fikrs,
  IFNULL(t001.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001")} AS t001
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t001"])
])}
`
);
