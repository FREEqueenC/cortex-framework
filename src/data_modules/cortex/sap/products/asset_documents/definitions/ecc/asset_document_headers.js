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
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "fiscal_year_gjahr",
    "sequence_number_lnran"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH 
  date_dimension AS (
    ${date.getDateDimension()}
  )
SELECT
  anek.mandt AS client_mandt,
  anek.bukrs AS company_code_bukrs,
  anek.anln1 AS asset_number_anln1,
  anek.anln2 AS asset_subnumber_anln2,
  anek.gjahr AS fiscal_year_gjahr,
  anek.lnran AS sequence_number_lnran,
  anek.bldat AS document_date_bldat,
  anek.budat AS posting_date_budat,
  anek.monat AS fiscal_period_monat,
  anek.cpudt AS entry_date_cpudt,
  anek.cputm AS entry_time_cputm,
  anek.usnam AS user_name_usnam,
  anek.tcode AS transaction_code_tcode,
  anek.belnr AS accounting_document_number_belnr,
  anek.buzei AS accounting_document_line_item_buzei,
  anek.bzdat AS asset_value_date_bzdat,
  anek.xantei AS proportional_values_indicator_xantei,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  IFNULL(
    anek.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anek")} AS anek
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON anek.bldat = dimensional_date_bldat.date
LEFT JOIN date_dimension AS dimensional_date_budat
  ON anek.budat = dimensional_date_budat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anek"])
])}
`,
);
