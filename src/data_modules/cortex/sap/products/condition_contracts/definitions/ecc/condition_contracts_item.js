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
const date = require("includes/date.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
   
    "client_mandt",
    "condition_contract_num",
    "item_guid"

  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH
  date_dimension AS (
    ${date.getDateDimension()}
  )
SELECT
  wcocoi.client AS client_mandt,
  wcocoi.num AS condition_contract_num,
  wcocoi.item_guid AS item_guid,
  wcocoi.guid AS condition_contract_guid,
  wcocoi.eligible_cust AS eligible_customer_eligible_cust,
  wcocoi.eligible_vendor AS eligible_vendor,
  wcocoi.list_num AS list_number_list_num,
  wcocoi.exclusion AS filter_exclusion,
  wcocoi.reference AS reference,
  wcocoi.deact AS deactivated_deact,
  wcocoi.date_from AS valid_from_date_from,
  wcocoi.date_to AS valid_to_date_to,
  wcocoi.eligible_plant AS plant_eligible_plant,
  wcocoi.quantity AS quantity,
  wcocoi.unit_of_measure AS unit_of_measure,
  wcocoi.ext_guid AS external_eligible_guid_ext_guid,
  dimensional_date_date_from.cal_year AS year_of_valid_from_date_from,
  dimensional_date_date_from.cal_quarter AS quarter_of_valid_from_date_from,
  dimensional_date_date_from.cal_month AS month_of_valid_from_date_from,
  dimensional_date_date_from.cal_week AS week_of_valid_from_date_from,
  dimensional_date_date_to.cal_year AS year_of_valid_to_date_to,
  dimensional_date_date_to.cal_quarter AS quarter_of_valid_to_date_to,
  dimensional_date_date_to.cal_month AS month_of_valid_to_date_to,
  dimensional_date_date_to.cal_week AS week_of_valid_to_date_to,
  IFNULL(
    wcocoi.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wcocoi")} AS wcocoi
LEFT JOIN date_dimension AS dimensional_date_date_from
  ON wcocoi.date_from = dimensional_date_date_from.date
LEFT JOIN date_dimension AS dimensional_date_date_to
  ON wcocoi.date_to = dimensional_date_date_to.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wcocoi"])
])}
`
);
