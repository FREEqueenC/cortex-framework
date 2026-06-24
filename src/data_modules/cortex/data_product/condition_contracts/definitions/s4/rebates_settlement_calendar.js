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
const currency = require("includes/cortex/currency.js");
const date = require("includes/cortex/date.js");
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
   
    "client_mandt",
    "condition_contract_num",
    "settlement_date_settl_date",
    "settlement_date_sequential_id_settl_date_seq_id"

  ]
);

publish("rebates_settlement_calendar", publishConfig).query(
  (ctx) => `
WITH
  date_dimension AS (
    ${date.getDateDimension()}
  )
SELECT
  wb2_d_settl_cal.mandt AS client_mandt,
  wb2_d_settl_cal.num AS condition_contract_num,
  wb2_d_settl_cal.settl_date AS settlement_date_settl_date,
  wb2_d_settl_cal.settl_date_seq_id AS settlement_date_sequential_id_settl_date_seq_id,
  wb2_d_settl_cal.settl_date_type AS settlement_date_type_settl_date_type,
  wb2_d_settl_cal.guid AS settlement_calendar_guid,
  wb2_d_settl_cal.ref_settl_date AS reference_settlement_date_ref_settl_date,
  wb2_d_settl_cal.ref_settl_date_seq_id AS ref_settlement_date_sequential_id_ref_settl_date_seq_id,
  wb2_d_settl_cal.settl_exec_date AS settlement_execution_date_settl_exec_date,
  wb2_d_settl_cal.busvol_date_from AS business_volume_date_from_busvol_date_from,
  wb2_d_settl_cal.busvol_date_to AS business_volume_date_to_busvol_date_to,
  wb2_d_settl_cal.settl_date_usage AS settlement_date_usage_settl_date_usage,
  wb2_d_settl_cal.valdt AS fixed_value_date_valdt,
  wb2_d_settl_cal.ext_guid AS external_calendar_guid_ext_guid,
  dimensional_date_settl_date.cal_year AS year_of_settlement_date_settl_date,
  dimensional_date_settl_date.cal_quarter AS quarter_of_settlement_date_settl_date,
  dimensional_date_settl_date.cal_month AS month_of_settlement_date_settl_date,
  dimensional_date_settl_date.cal_week AS week_of_settlement_date_settl_date,
  dimensional_date_ref_settl_date.cal_year AS year_of_reference_settlement_date_ref_settl_date,
  dimensional_date_ref_settl_date.cal_quarter AS quarter_of_reference_settlement_date_ref_settl_date,
  dimensional_date_ref_settl_date.cal_month AS month_of_reference_settlement_date_ref_settl_date,
  dimensional_date_ref_settl_date.cal_week AS week_of_reference_settlement_date_ref_settl_date,
  dimensional_date_settl_exec_date.cal_year AS year_of_settlement_execution_date_settl_exec_date,
  dimensional_date_settl_exec_date.cal_quarter AS quarter_of_settlement_execution_date_settl_exec_date,
  dimensional_date_settl_exec_date.cal_month AS month_of_settlement_execution_date_settl_exec_date,
  dimensional_date_settl_exec_date.cal_week AS week_of_settlement_execution_date_settl_exec_date,
  dimensional_date_busvol_date_from.cal_year AS year_of_business_volume_date_from_busvol_date_from,
  dimensional_date_busvol_date_from.cal_quarter AS quarter_of_business_volume_date_from_busvol_date_from,
  dimensional_date_busvol_date_from.cal_month AS month_of_business_volume_date_from_busvol_date_from,
  dimensional_date_busvol_date_from.cal_week AS week_of_business_volume_date_from_busvol_date_from,
  dimensional_date_busvol_date_to.cal_year AS year_of_business_volume_date_to_busvol_date_to,
  dimensional_date_busvol_date_to.cal_quarter AS quarter_of_business_volume_date_to_busvol_date_to,
  dimensional_date_busvol_date_to.cal_month AS month_of_business_volume_date_to_busvol_date_to,
  dimensional_date_busvol_date_to.cal_week AS week_of_business_volume_date_to_busvol_date_to,
  dimensional_date_valdt.cal_year AS year_of_fixed_value_date_valdt,
  dimensional_date_valdt.cal_quarter AS quarter_of_fixed_value_date_valdt,
  dimensional_date_valdt.cal_month AS month_of_fixed_value_date_valdt,
  dimensional_date_valdt.cal_week AS week_of_fixed_value_date_valdt,
  IFNULL(
    wb2_d_settl_cal.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wb2_d_settl_cal")} AS wb2_d_settl_cal
LEFT JOIN date_dimension AS dimensional_date_settl_date
  ON wb2_d_settl_cal.settl_date = dimensional_date_settl_date.date
LEFT JOIN date_dimension AS dimensional_date_ref_settl_date
  ON wb2_d_settl_cal.ref_settl_date = dimensional_date_ref_settl_date.date
LEFT JOIN date_dimension AS dimensional_date_settl_exec_date
  ON wb2_d_settl_cal.settl_exec_date = dimensional_date_settl_exec_date.date
LEFT JOIN date_dimension AS dimensional_date_busvol_date_from
  ON wb2_d_settl_cal.busvol_date_from = dimensional_date_busvol_date_from.date
LEFT JOIN date_dimension AS dimensional_date_busvol_date_to
  ON wb2_d_settl_cal.busvol_date_to = dimensional_date_busvol_date_to.date
LEFT JOIN date_dimension AS dimensional_date_valdt
  ON wb2_d_settl_cal.valdt = dimensional_date_valdt.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wb2_d_settl_cal"])
])}
`
);
