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
  ["mandt", "werks", "matnr", "charg", "lgort", "bukrs", "stock_characteristic", "sobkz", "bwart", "shkzg", "insmk", "meins", "waers", "month_end_date"]
);

publish("stock_monthly_snapshots", { ...publishConfig, name: "stock_monthly_snapshots" }).query(
  (ctx) => `
WITH
  LastSnapshots AS (
    ${ctx.when(ctx.incremental(),
      `SELECT
        mandt, werks, matnr, charg, lgort, bukrs, sobkz, bwart, shkzg, insmk, meins, waers, stock_characteristic,
        cal_year, cal_month,
        month_end_date,
        0 AS total_monthly_movement_quantity,
        0 AS total_monthly_movement_amount,
        quantity_monthly_cumulative AS start_quantity,
        amount_weekly_cumulative AS start_amount
      FROM
        ${ctx.self()}
      WHERE
        month_end_date = (SELECT MAX(month_end_date) FROM ${ctx.self()})`,
      
      `SELECT
        NULL AS mandt, NULL AS werks, NULL AS matnr, NULL AS charg, NULL AS lgort, NULL AS bukrs, NULL AS sobkz, NULL AS bwart, NULL AS shkzg, NULL AS insmk, NULL AS meins, NULL AS waers, NULL AS stock_characteristic,
        0 AS cal_year, 0 AS cal_week,
        CAST(NULL AS DATE) AS month_end_date,
        0 AS total_monthly_movement_quantity,
        0 AS total_monthly_movement_amount,
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
      src.sobkz,
      src.bwart,
      src.shkzg,
      src.insmk,
      StockCharacteristicsConfig.StockCharacteristic AS stock_characteristic,
      EXTRACT(YEAR FROM LAST_DAY(datedim.Date, MONTH)) AS cal_year,
      EXTRACT(MONTH FROM LAST_DAY(datedim.Date, MONTH)) AS cal_month,
      LAST_DAY(datedim.Date, MONTH) AS month_end_date,
      SUM(src.dmbtr_stock) AS total_monthly_movement_amount,
      SUM(src.stock_qty) AS total_monthly_movement_quantity
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'matdoc')} AS src
    LEFT JOIN
      ${ctx.ref('calendar_date_dim')} AS datedim
      ON src.budat = datedim.Date
    LEFT JOIN
      ${ctx.ref('StockCharacteristicsConfig')} AS StockCharacteristicsConfig
      ON src.mandt = StockCharacteristicsConfig.Client_MANDT
        AND IFNULL(src.sobkz,'') = IFNULL(StockCharacteristicsConfig.SpecialStockIndicator_SOBKZ,'')
        AND IFNULL(src.bstaus_sg,'') = IFNULL(StockCharacteristicsConfig.StockCharacteristic_BSTAUS_SG,'')
    WHERE
      1 = 1
      ${ctx.when(ctx.incremental(), `AND src.budat > (SELECT MAX(month_end_date) FROM ${ctx.self()})`)}
    GROUP BY
      src.mandt,
      src.werks,
      src.matnr,
      src.charg,
      src.meins,
      src.waers,
      src.lgort,
      src.bukrs,
      src.sobkz,
      src.bwart,
      src.shkzg,
      src.insmk,
      StockCharacteristicsConfig.StockCharacteristic,
      cal_year,
      cal_month,
      month_end_date
  ),

  CombinedData AS (
    SELECT
      mandt, werks, matnr, charg, lgort, bukrs, sobkz, bwart, shkzg, insmk, meins, waers, stock_characteristic,
      cal_year, cal_month, month_end_date,
      total_monthly_movement_quantity,
      total_monthly_movement_amount,
      0 AS start_quantity,
      0 AS start_amount
    FROM
      NewMovements

    ${ctx.when(ctx.incremental(), `
    UNION ALL
    SELECT
      mandt, werks, matnr, charg, lgort, bukrs, sobkz, bwart, shkzg, insmk, meins, waers, stock_characteristic,
      cal_year, cal_month, month_end_date,
      total_monthly_movement_quantity,
      total_monthly_movement_amount,
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
      sobkz,
      bwart,
      shkzg,
      insmk,
      cal_year,
      cal_month,
      meins,
      waers,
      stock_characteristic,
      month_end_date,
      total_monthly_movement_quantity,
      total_monthly_movement_amount,
      SUM(start_quantity + total_monthly_movement_quantity) OVER (
        PARTITION BY mandt, werks, matnr, charg, lgort, bukrs, stock_characteristic, sobkz, bwart, shkzg, insmk, meins, waers
        ORDER BY month_end_date ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS quantity_monthly_cumulative,
      SUM(start_amount + total_monthly_movement_amount) OVER (
        PARTITION BY mandt, werks, matnr, charg, lgort, bukrs, stock_characteristic, sobkz, bwart, shkzg, insmk, meins, waers
        ORDER BY month_end_date ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS amount_monthly_cumulative
    FROM
      CombinedData
  )

SELECT
  *
FROM
  CumulativeTotals
WHERE
  1 = 1
  ${ctx.when(ctx.incremental(), `AND month_end_date > (SELECT MAX(month_end_date) FROM ${ctx.self()})`)}
`
);
