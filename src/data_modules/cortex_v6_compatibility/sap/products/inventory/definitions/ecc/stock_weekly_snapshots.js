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
const publish_config = require("includes/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  "incremental",
  tableConfig,
  moduleConfig,
  ["mandt", "werks", "matnr", "charg", "lgort", "bukrs", "stock_characteristic", "meins", "waers", "week_end_date"]
);

publish("stock_weekly_snapshots", { ...publishConfig, name: "stock_weekly_snapshots" }).query(
  (ctx) => `
WITH
  LastSnapshots AS (
    ${ctx.when(ctx.incremental(),
      `SELECT
        mandt, werks, matnr, charg, lgort, bukrs, meins, waers, stock_characteristic,
        cal_year, cal_week,
        week_end_date,
        0 AS total_weekly_movement_quantity,
        0 AS total_weekly_movement_amount,
        quantity_weekly_cumulative AS start_quantity,
        amount_weekly_cumulative AS start_amount
      FROM
        ${ctx.self()}
      WHERE
        week_end_date = (SELECT MAX(week_end_date) FROM ${ctx.self()})`,
      
      `SELECT
        NULL AS mandt, NULL AS werks, NULL AS matnr, NULL AS charg, NULL AS lgort, NULL AS bukrs, NULL AS meins, NULL AS waers, NULL AS stock_characteristic,
        0 AS cal_year, 0 AS cal_week,
        CAST(NULL AS DATE) AS week_end_date,
        0 AS total_weekly_movement_quantity,
        0 AS total_weekly_movement_amount,
        0.0 AS start_quantity,
        0.0 AS start_amount
       LIMIT 0`
    )}
  ),

  NewMovements AS (
    SELECT
      src.mandt,
      src.werks,
      COALESCE(src.matnr,'') as matnr,
      COALESCE(src.charg,'') as charg,
      COALESCE(src.lgort,'') as lgort,
      COALESCE(src.bukrs,'') as bukrs,
      COALESCE(src.meins,'') as meins,
      COALESCE(src.waers,'') as waers,
      StockCharacteristicsConfig.StockCharacteristic AS stock_characteristic,
      EXTRACT(YEAR FROM LAST_DAY(datedim.Date, WEEK(SUNDAY))) AS cal_year,
      EXTRACT(WEEK FROM LAST_DAY(datedim.Date, WEEK(SUNDAY))) AS cal_week,
      LAST_DAY(datedim.Date, WEEK(SUNDAY)) AS week_end_date,
      SUM(IF(src.shkzg = 'H', (src.dmbtr * -1), src.dmbtr)) AS total_weekly_movement_amount,
      SUM(IF(src.shkzg = 'H', (src.menge * -1), src.menge)) AS total_weekly_movement_quantity
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mseg')} AS src
    LEFT JOIN
      ${ctx.ref('calendar_date_dim')} AS datedim
      ON src.budat_mkpf = datedim.Date
    LEFT JOIN
      ${ctx.ref('StockCharacteristicsConfig')} AS StockCharacteristicsConfig
      ON src.mandt = StockCharacteristicsConfig.Client_MANDT
        AND IFNULL(src.sobkz,'') = StockCharacteristicsConfig.SpecialStockIndicator_SOBKZ
        AND IFNULL(src.bwart,'') = StockCharacteristicsConfig.MovementType_BWART
        AND IFNULL(src.shkzg,'') = StockCharacteristicsConfig.Debit_CreditIndicator_SHKZG
        AND IFNULL(src.insmk,'') = StockCharacteristicsConfig.StockType_INSMK
    WHERE
      1 = 1
      ${ctx.when(ctx.incremental(), `AND src.budat_mkpf > (SELECT MAX(week_end_date) FROM ${ctx.self()})`)}
    GROUP BY
      src.mandt,
      src.werks,
      src.matnr,
      src.charg,
      src.meins,
      src.waers,
      src.lgort,
      src.bukrs,
      StockCharacteristicsConfig.StockCharacteristic,
      cal_year,
      cal_week,
      week_end_date
  ),

  CombinedData AS (
    SELECT
      mandt, werks, matnr, charg, lgort, bukrs, meins, waers, stock_characteristic,
      cal_year, cal_week, week_end_date,
      total_weekly_movement_quantity,
      total_weekly_movement_amount,
      0 AS start_quantity,
      0 AS start_amount
    FROM
      NewMovements

    ${ctx.when(ctx.incremental(), `
    UNION ALL
    SELECT
      mandt, werks, matnr, charg, lgort, bukrs, meins, waers, stock_characteristic,
      cal_year, cal_week, week_end_date,
      total_weekly_movement_quantity,
      total_weekly_movement_amount,
      start_quantity,
      start_amount
    FROM
      LastSnapshots
    `)}
  ),

  CumulativeTotals AS (
    SELECT
      mandt,
      werks,
      matnr,
      charg,
      lgort,
      bukrs,
      cal_year,
      cal_week,
      meins,
      waers,
      stock_characteristic,
      week_end_date,
      total_weekly_movement_quantity,
      total_weekly_movement_amount,
      SUM(start_quantity + total_weekly_movement_quantity) OVER (
        PARTITION BY mandt, werks, matnr, charg, lgort, bukrs, stock_characteristic, meins, waers
        ORDER BY week_end_date ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS quantity_weekly_cumulative,
      SUM(start_amount + total_weekly_movement_amount) OVER (
        PARTITION BY mandt, werks, matnr, charg, lgort, bukrs, stock_characteristic, meins, waers
        ORDER BY week_end_date ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS amount_weekly_cumulative
    FROM
      CombinedData
  )

SELECT
  *
FROM
  CumulativeTotals
WHERE
  1 = 1
  ${ctx.when(ctx.incremental(), `AND week_end_date > (SELECT MAX(week_end_date) FROM ${ctx.self()})`)}
`
);
