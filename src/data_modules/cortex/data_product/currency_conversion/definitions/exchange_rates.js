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

// Limitations:
// 1. Triangulation (via reference currency) is not supported.
// 2. Alternative exchange rate types (fallback) are not supported.

const moduleConfig = config.product[moduleContext.moduleId];
const materializationType = tableConfig.materializationType || "incremental";
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "exchange_rate_type_kurst",
    "from_currency_fcurr",
    "to_currency_tcurr",
    "conv_date"
  ]
);

publish("exchange_rates", publishConfig).query(
  (ctx) => `
WITH
  TCURR AS (
    SELECT
      tcurr.mandt,
      tcurr.kurst,
      tcurr.fcurr,
      tcurr.tcurr,
      IF(tcurr.ukurs < 0, SAFE_DIVIDE(1, ABS(tcurr.ukurs)), tcurr.ukurs) AS ukurs,
      PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurr.gdatu AS INT64) AS STRING)) AS start_date,
      IF(
        LEAD(PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurr.gdatu AS INT64) AS STRING))) OVER (
          PARTITION BY tcurr.mandt, tcurr.kurst, tcurr.fcurr, tcurr.tcurr
          ORDER BY tcurr.gdatu DESC) IS NULL,
        DATE("9999-12-31"),
        DATE_SUB(
          LEAD(PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurr.gdatu AS INT64) AS STRING))) OVER (
            PARTITION BY tcurr.mandt, tcurr.kurst, tcurr.fcurr, tcurr.tcurr
            ORDER BY tcurr.gdatu DESC),
          INTERVAL 1 DAY)
      ) AS end_date,
      tcurr.recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurr")} AS tcurr
  ),
  TCURF AS (
    SELECT
      tcurf.mandt,
      tcurf.kurst,
      tcurf.fcurr,
      tcurf.tcurr,
      PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurf.gdatu AS INT64) AS STRING)) AS start_date,
      IF(
        LEAD(PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurf.gdatu AS INT64) AS STRING))) OVER (
          PARTITION BY tcurf.mandt, tcurf.kurst, tcurf.fcurr, tcurf.tcurr
          ORDER BY tcurf.gdatu DESC) IS NULL,
        DATE("9999-12-31"),
        DATE_SUB(
          LEAD(PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(tcurf.gdatu AS INT64) AS STRING))) OVER (
            PARTITION BY tcurf.mandt, tcurf.kurst, tcurf.fcurr, tcurf.tcurr
            ORDER BY tcurf.gdatu DESC),
          INTERVAL 1 DAY)
      ) AS end_date,
      COALESCE(tcurf.ffact, 1) AS ffact,
      COALESCE(tcurf.tfact, 1) AS tfact,
      tcurf.recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurf")} AS tcurf
  ),
  CurrencyConversion AS (
    SELECT
      tcurr.mandt,
      tcurr.kurst,
      tcurr.fcurr,
      tcurr.tcurr,
      tcurr.ukurs * (tcurf.tfact / tcurf.ffact) AS ukurs,
      GREATEST(tcurr.start_date, tcurf.start_date) AS start_date,
      LEAST(tcurr.end_date, tcurf.end_date) AS end_date,
      GREATEST(tcurr.recordstamp, tcurf.recordstamp) as recordstamp
    FROM
      TCURR AS tcurr
    INNER JOIN
      TCURF AS tcurf
      ON tcurr.mandt = tcurf.mandt
        AND tcurr.kurst = tcurf.kurst
        AND tcurr.fcurr = tcurf.fcurr
        AND tcurr.tcurr = tcurf.tcurr
    WHERE tcurr.start_date <= tcurf.end_date
      AND tcurr.end_date >= tcurf.start_date
    UNION ALL
    SELECT DISTINCT
      tcurr_src.mandt,
      tcurr_src.kurst,
      tcurr_src.fcurr,
      tcurr_src.fcurr AS tcurr,
      1 AS ukurs,
      DATE_SUB(CURRENT_DATE(), INTERVAL 10 YEAR) AS start_date,
      DATE("9999-12-31") AS end_date,
      tcurr_src.recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurr")} AS tcurr_src
    WHERE NOT EXISTS (
      -- Check if SAP already maintains this exact same-to-same pair
      SELECT 1 
      FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurr")} AS existing
      WHERE existing.mandt = tcurr_src.mandt
        AND existing.kurst = tcurr_src.kurst
        AND existing.fcurr = tcurr_src.fcurr
        AND existing.tcurr = tcurr_src.fcurr
    )
  )
SELECT
  mandt as client_mandt,
  kurst as exchange_rate_type_kurst,
  fcurr as from_currency_fcurr,
  tcurr as to_currency_tcurr,
  ukurs as exchange_rate_ukurs,
  start_date,
  end_date,
  conv_date,
  recordstamp as source_last_updated_at,
  CURRENT_TIMESTAMP() as bq_loaded_at
FROM
  CurrencyConversion,
  UNNEST(
    GENERATE_DATE_ARRAY(
      start_date,
      LEAST(end_date, DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH))
  )) AS conv_date
${sql_helper.buildDynamicWhere([
  `conv_date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 10 YEAR) AND DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH)`,
  incremental.getFilter(ctx, ["CurrencyConversion"])
])}
`
);
