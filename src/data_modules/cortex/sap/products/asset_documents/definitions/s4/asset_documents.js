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
    "company_code_bukrs",
    "accounting_document_number_belnr",
    "fiscal_year_gjahr",
    "accounting_document_line_item_buzei"
  ]
);

const filters = tableConfig.filters || {};
const assetAccountTypes = filters.asset_account_types || ['A'];

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH 
  date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  acdoca.rclnt AS client_mandt,
  acdoca.rbukrs AS company_code_bukrs,
  acdoca.belnr AS accounting_document_number_belnr,
  acdoca.gjahr AS fiscal_year_gjahr,
  acdoca.buzei AS accounting_document_line_item_buzei,
  acdoca.anln1 AS asset_number_anln1,
  acdoca.anln2 AS asset_subnumber_anln2,
  acdoca.afabe AS depreciation_area_afabe,
  acdoca.anbwa AS transaction_type_bwasl,
  ${currency.amountWithDecimalShift("acdoca.hsl", "curr_local")} AS amount_posted_in_local_currency_hsl,
  ${currency.amountWithDecimalShift("acdoca.wsl", "curr_trans")} AS amount_posted_in_transaction_currency_wsl,
  acdoca.rhcur AS local_currency_key_rhcur,
  acdoca.rwcur AS transaction_currency_key_rwcur,
  acdoca.koart AS account_type_koart,
  bkpf.bldat AS document_date_bldat,
  bkpf.budat AS posting_date_budat,
  bkpf.monat AS fiscal_period_monat,
  bkpf.cpudt AS entry_date_cpudt,
  bkpf.cputm AS entry_time_cputm,
  bkpf.usnam AS user_name_usnam,
  bkpf.tcode AS transaction_code_tcode,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  GREATEST(
    IFNULL(acdoca.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(bkpf.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "acdoca")} AS acdoca
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "bkpf")} AS bkpf
  ON acdoca.rclnt = bkpf.mandt
  AND acdoca.rbukrs = bkpf.bukrs
  AND acdoca.belnr = bkpf.belnr
  AND acdoca.gjahr = bkpf.gjahr
LEFT JOIN currency_decimal AS curr_local
  ON acdoca.rhcur = curr_local.currkey
LEFT JOIN currency_decimal AS curr_trans
  ON acdoca.rwcur = curr_trans.currkey
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON bkpf.bldat = dimensional_date_bldat.date
LEFT JOIN date_dimension AS dimensional_date_budat
  ON bkpf.budat = dimensional_date_budat.date
${sql_helper.buildDynamicWhere([
  `acdoca.koart IN (${sql_helper.formatFilterArray(assetAccountTypes)})`,
  incremental.getFilter(ctx, ["acdoca", "bkpf"])
])}
`,
);
