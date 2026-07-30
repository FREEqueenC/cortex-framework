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
const currencyHelper = require("includes/cortex_v6_compatibility_currency.js");

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("stock_weekly_snapshots_legacy", { ...publishConfig, name: "StockWeeklySnapshots" }).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
)
SELECT
  StockWeeklySnapshots.MANDT AS Client_MANDT,
  StockWeeklySnapshots.MATNR AS MaterialNumber_MATNR,
  StockWeeklySnapshots.WERKS AS Plant_WERKS,
  StockWeeklySnapshots.CHARG AS BatchNumber_CHARG,
  StockWeeklySnapshots.LGORT AS StorageLocation_LGORT,
  StockWeeklySnapshots.BUKRS AS CompanyCode_BUKRS,
  CompaniesMD.CompanyText_BUTXT,
  FiscalDateDimension_WEEKENDDATE.FiscalYear,
  FiscalDateDimension_WEEKENDDATE.FiscalPeriod,
  StockWeeklySnapshots.cal_year AS CalYear,
  StockWeeklySnapshots.cal_week AS CalWeek,
  StockWeeklySnapshots.week_end_date AS WeekEndDate,
  StockWeeklySnapshots.MEINS AS BaseUnitOfMeasure_MEINS,
  StockWeeklySnapshots.WAERS AS CurrencyKey_WAERS,
  StockWeeklySnapshots.total_weekly_movement_quantity AS TotalWeeklyMovementQuantity,
  StockWeeklySnapshots.quantity_weekly_cumulative AS QuantityWeeklyCumulative,
  CAST(COALESCE(
    StockWeeklySnapshots.total_weekly_movement_amount * currency_decimal.CURRFIX,
    StockWeeklySnapshots.total_weekly_movement_amount
  ) AS NUMERIC) AS TotalWeeklyMovementAmount,
  CAST(COALESCE(
    StockWeeklySnapshots.amount_weekly_cumulative * currency_decimal.CURRFIX,
    StockWeeklySnapshots.amount_weekly_cumulative
  ) AS NUMERIC) AS AmountWeeklyCumulative,
  StockWeeklySnapshots.stock_characteristic AS StockCharacteristic
FROM
  ${ctx.ref('stock_weekly_snapshots')} AS StockWeeklySnapshots
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CompaniesMD')} AS CompaniesMD
  ON
    StockWeeklySnapshots.MANDT = CompaniesMD.Client_MANDT
    AND StockWeeklySnapshots.BUKRS = CompaniesMD.CompanyCode_BUKRS
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_WEEKENDDATE
  ON
    StockWeeklySnapshots.MANDT = FiscalDateDimension_WEEKENDDATE.MANDT
    AND CompaniesMD.FiscalyearVariant_PERIV = FiscalDateDimension_WEEKENDDATE.PERIV
    AND StockWeeklySnapshots.WEEK_END_DATE = FiscalDateDimension_WEEKENDDATE.DATE
LEFT JOIN
  currency_decimal AS currency_decimal
  ON
    StockWeeklySnapshots.WAERS = currency_decimal.CURRKEY
WHERE StockWeeklySnapshots.Stock_Characteristic != 'BlockedReturns'
`
);
