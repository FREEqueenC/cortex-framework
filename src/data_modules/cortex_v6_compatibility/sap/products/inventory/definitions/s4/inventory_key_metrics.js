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
const master_data = require("includes/master_data.js");

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("inventory_key_metrics", { ...publishConfig, name: "InventoryKeyMetrics" }).query(
  (ctx) => `
WITH
  currency_decimal AS (
    ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  CurrencyConversion AS (
    SELECT
      Client_MANDT, FromCurrency_FCURR, ToCurrency_TCURR, ConvDate, ExchangeRate_UKURS
    FROM (
      ${currencyHelper.getCurrencyConversionCTE(ctx, moduleConfig.sources.sapModule.datasetId, moduleConfig)}
    )
  ),
  MaterialLedger AS (
    ${master_data.getMaterialLedger(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  ValueAndCost AS (
    SELECT DISTINCT
      StockMonthlySnapshots.Client_MANDT,
      StockMonthlySnapshots.MaterialNumber_MATNR,
      StockMonthlySnapshots.Plant_WERKS,
      StockMonthlySnapshots.MonthEndDate,
      StockMonthlySnapshots.FiscalYear,
      StockMonthlySnapshots.FiscalPeriod,
      COALESCE(
        MaterialLedger.ValueOfTotalValuatedStock_SALK3,
        LAST_VALUE(MaterialLedger.ValueOfTotalValuatedStock_SALK3 IGNORE NULLS)
          OVER (
            PARTITION BY
              StockMonthlySnapshots.MaterialNumber_MATNR, StockMonthlySnapshots.Plant_WERKS
            ORDER BY
              StockMonthlySnapshots.MonthEndDate
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS ValueOfTotalValuatedStock_SALK3,
      COALESCE(
        MaterialLedger.StandardCost_STPRS,
        LAST_VALUE(MaterialLedger.StandardCost_STPRS IGNORE NULLS)
          OVER (
            PARTITION BY
              StockMonthlySnapshots.MaterialNumber_MATNR, StockMonthlySnapshots.Plant_WERKS
            ORDER BY
              StockMonthlySnapshots.MonthEndDate
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS StandardCost_STPRS,
      COALESCE(
        MaterialLedger.MovingAveragePrice,
        LAST_VALUE(MaterialLedger.MovingAveragePrice IGNORE NULLS)
          OVER (
            PARTITION BY
              StockMonthlySnapshots.MaterialNumber_MATNR, StockMonthlySnapshots.Plant_WERKS
            ORDER BY
              StockMonthlySnapshots.MonthEndDate
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) AS MovingAveragePrice_VERPR
    FROM
      ${ctx.ref('StockMonthlySnapshots')} AS StockMonthlySnapshots
    LEFT JOIN
      MaterialLedger AS MaterialLedger
      ON
        StockMonthlySnapshots.Client_MANDT = MaterialLedger.Client_MANDT
        AND StockMonthlySnapshots.MaterialNumber_MATNR = MaterialLedger.MaterialNumber_MATNR
        AND StockMonthlySnapshots.Plant_WERKS = MaterialLedger.ValuationArea_BWKEY
        AND StockMonthlySnapshots.FiscalYear = MaterialLedger.FiscalYear
        AND StockMonthlySnapshots.FiscalPeriod = MaterialLedger.PostingPeriod
        AND MaterialLedger.ValuationType_BWTAR = ''
  ),
  CurrentStock AS (
    SELECT
      StockMonthlySnapshots.Client_MANDT,
      StockMonthlySnapshots.MaterialNumber_MATNR,
      StockMonthlySnapshots.Plant_WERKS,
      StockMonthlySnapshots.MaterialType_MTART,
      SlowMovingThreshold.ThresholdValue,
      StockMonthlySnapshots.DescriptionOfMaterialType_MTBEZ,
      StockMonthlySnapshots.MaterialText_MAKTX,
      StockMonthlySnapshots.MaterialGroup_MATKL,
      StockMonthlySnapshots.MaterialGroupName_WGBEZ,
      StockMonthlySnapshots.Plant_Name2_NAME2,
      StockMonthlySnapshots.CompanyCode_BUKRS,
      StockMonthlySnapshots.CompanyText_BUTXT,
      StockMonthlySnapshots.CountryKey_LAND1,
      StockMonthlySnapshots.Languagekey_SPRAS,
      StockMonthlySnapshots.FiscalYear,
      StockMonthlySnapshots.FiscalPeriod,
      StockMonthlySnapshots.CalYear,
      StockMonthlySnapshots.CalMonth,
      StockMonthlySnapshots.BaseUnitOfMeasure_MEINS,
      StockMonthlySnapshots.CurrencyKey_WAERS,
      IF(
        StockMonthlySnapshots.MonthEndDate = LAST_DAY(CURRENT_DATE),
        CURRENT_DATE,
        StockMonthlySnapshots.MonthEndDate
      ) AS MonthEndDate,
      StockMonthlySnapshots.MonthEndDate
        BETWEEN
          LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH))
        AND
          LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH))
        AS IsPast12MonthsExcludingCurrent,
      StockMonthlySnapshots.MonthEndDate
        BETWEEN
          LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH))
        AND
          LAST_DAY(CURRENT_DATE)
        AS IsPast12MonthsIncludingCurrent,
      ValueOfTotalValuatedStock_SALK3,
      StandardCost_STPRS,
      MovingAveragePrice_VERPR,
      SUM(StockMonthlySnapshots.QuantityMonthlyCumulative) AS QuantityMonthlyCumulative,
      SUM(StockMonthlySnapshots.AmountMonthlyCumulative) AS AmountMonthlyCumulative,
      SUM(StockMonthlySnapshots.StockOnHand) AS StockOnHand,
      SUM(StockMonthlySnapshots.StockOnHandValue) AS StockOnHandValue,
      SUM(StockMonthlySnapshots.QuantityIssuedToDelivery) AS QuantityIssuedToDelivery,
      SUM(StockMonthlySnapshots.TotalConsumptionQuantity) AS TotalConsumptionQuantity
    FROM
      ${ctx.ref('StockMonthlySnapshots')} AS StockMonthlySnapshots
    LEFT JOIN
      ValueAndCost
      ON
        StockMonthlySnapshots.Client_MANDT = ValueAndCost.Client_MANDT
        AND StockMonthlySnapshots.MaterialNumber_MATNR = ValueAndCost.MaterialNumber_MATNR
        AND StockMonthlySnapshots.Plant_WERKS = ValueAndCost.Plant_WERKS
        AND StockMonthlySnapshots.MonthEndDate = ValueAndCost.MonthEndDate
        AND StockMonthlySnapshots.FiscalPeriod = ValueAndCost.FiscalPeriod
        AND StockMonthlySnapshots.FiscalYear = ValueAndCost.FiscalYear
    LEFT JOIN
      ${ctx.ref('SlowMovingThreshold')} AS SlowMovingThreshold
      ON
        StockMonthlySnapshots.Client_MANDT = SlowMovingThreshold.Client_MANDT
        AND StockMonthlySnapshots.MaterialType_MTART = SlowMovingThreshold.MaterialType_MTART
    GROUP BY
      StockMonthlySnapshots.Client_MANDT,
      StockMonthlySnapshots.MaterialNumber_MATNR,
      StockMonthlySnapshots.Plant_WERKS,
      StockMonthlySnapshots.MaterialType_MTART,
      SlowMovingThreshold.ThresholdValue,
      StockMonthlySnapshots.DescriptionOfMaterialType_MTBEZ,
      StockMonthlySnapshots.MaterialText_MAKTX,
      StockMonthlySnapshots.MaterialGroup_MATKL,
      StockMonthlySnapshots.MaterialGroupName_WGBEZ,
      StockMonthlySnapshots.Plant_Name2_NAME2,
      StockMonthlySnapshots.CompanyCode_BUKRS,
      StockMonthlySnapshots.CompanyText_BUTXT,
      StockMonthlySnapshots.CountryKey_LAND1,
      StockMonthlySnapshots.LanguageKey_SPRAS,
      ValueAndCost.ValueOfTotalValuatedStock_SALK3,
      ValueAndCost.StandardCost_STPRS,
      ValueAndCost.MovingAveragePrice_VERPR,
      StockMonthlySnapshots.BaseUnitOfMeasure_MEINS,
      StockMonthlySnapshots.CurrencyKey_WAERS,
      StockMonthlySnapshots.FiscalYear,
      StockMonthlySnapshots.FiscalPeriod,
      StockMonthlySnapshots.CalYear,
      StockMonthlySnapshots.CalMonth,
      StockMonthlySnapshots.MonthEndDate
  ),
  CalculatedMetrics AS (
    SELECT DISTINCT
      CurrentStock.Client_MANDT,
      CurrentStock.MaterialNumber_MATNR,
      CurrentStock.Plant_WERKS,
      CurrentStock.LanguageKey_SPRAS,
      CurrentStock.MonthEndDate,
      CurrentStock.FiscalPeriod,
      CurrentStock.FiscalYear,
      IF(
        IsPast12MonthsExcludingCurrent,
        SUM(CurrentStock.TotalConsumptionQuantity)
          OVER (
            PARTITION BY
              CurrentStock.Client_MANDT, CurrentStock.MaterialNumber_MATNR,
              CurrentStock.Plant_WERKS, CurrentStock.LanguageKey_SPRAS,
              IsPast12MonthsExcludingCurrent),
        0) AS TotalConsumptionQuantityForPastYear,
      IF(
        IsPast12MonthsIncludingCurrent,
        SUM(CurrentStock.TotalConsumptionQuantity)
          OVER (
            PARTITION BY
              CurrentStock.Client_MANDT, CurrentStock.MaterialNumber_MATNR,
              CurrentStock.Plant_WERKS, CurrentStock.LanguageKey_SPRAS,
              IsPast12MonthsIncludingCurrent),
        0) AS TotalConsumptionQuantityForPastYearTillToday,
      IF(
        IsPast12MonthsIncludingCurrent,
        SUM(TotalConsumptionQuantity / (365 + EXTRACT(DAY FROM CURRENT_DATE)))
          OVER (
            PARTITION BY
              CurrentStock.Client_MANDT, CurrentStock.MaterialNumber_MATNR,
              CurrentStock.Plant_WERKS, CurrentStock.LanguageKey_SPRAS,
              IsPast12MonthsIncludingCurrent
          ),
        0) AS DemandPerDayForPastYearTillToday,
      SUM(CurrentStock.ValueOfTotalValuatedStock_SALK3)
        OVER (
          PARTITION BY
            CurrentStock.Client_MANDT, CurrentStock.MaterialNumber_MATNR,
            CurrentStock.Plant_WERKS, CurrentStock.LanguageKey_SPRAS
          ORDER BY
            CurrentStock.CalYear, CurrentStock.CalMonth
          ROWS BETWEEN 2 PRECEDING AND 1 PRECEDING
        ) AS InventoryByMonth,
      SUM(CurrentStock.ValueOfTotalValuatedStock_SALK3 / 2)
        OVER (
          PARTITION BY
            CurrentStock.Client_MANDT, CurrentStock.MaterialNumber_MATNR,
            CurrentStock.Plant_WERKS, CurrentStock.LanguageKey_SPRAS
          ORDER BY
            CurrentStock.CalYear, CurrentStock.CalMonth
          ROWS BETWEEN 2 PRECEDING AND 1 PRECEDING
        ) AS AvgInventoryByMonth
    FROM
      CurrentStock
  ),
  Inventory AS (
    SELECT
      CurrentStock.Client_MANDT,
      CurrentStock.MaterialNumber_MATNR,
      CurrentStock.Plant_WERKS,
      CurrentStock.MaterialType_MTART,
      CurrentStock.ThresholdValue,
      CurrentStock.DescriptionOfMaterialType_MTBEZ,
      CurrentStock.MaterialText_MAKTX,
      CurrentStock.MaterialGroup_MATKL,
      CurrentStock.MaterialGroupName_WGBEZ,
      CurrentStock.Plant_Name2_NAME2,
      CurrentStock.CompanyCode_BUKRS,
      CurrentStock.CompanyText_BUTXT,
      CurrentStock.CountryKey_LAND1,
      CurrentStock.Languagekey_SPRAS,
      CurrentStock.ValueOfTotalValuatedStock_SALK3,
      CurrentStock.StandardCost_STPRS,
      CurrentStock.MovingAveragePrice_VERPR,
      CurrentStock.FiscalYear,
      CurrentStock.FiscalPeriod,
      CurrentStock.CalYear,
      CurrentStock.CalMonth,
      CurrentStock.MonthEndDate,
      CurrentStock.BaseUnitOfMeasure_MEINS,
      CurrentStock.CurrencyKey_WAERS,
      CurrentStock.QuantityMonthlyCumulative,
      CurrentStock.AmountMonthlyCumulative,
      CurrentStock.StockOnHand,
      CurrentStock.StockOnHandValue,
      CurrentStock.QuantityIssuedToDelivery,
      CurrentStock.TotalConsumptionQuantity,
      CurrentStock.QuantityIssuedToDelivery * CurrentStock.StandardCost_STPRS AS CostOfGoodsSoldByMonth,
      CalculatedMetrics.TotalConsumptionQuantityForPastYear,
      CalculatedMetrics.TotalConsumptionQuantityForPastYearTillToday,
      CalculatedMetrics.DemandPerDayForPastYearTillToday,
      CalculatedMetrics.InventoryByMonth,
      CalculatedMetrics.AvgInventoryByMonth,
      CASE
        WHEN CurrentStock.MaterialType_MTART IN ('FERT', 'HALB')
          THEN CurrentStock.QuantityMonthlyCumulative * CurrentStock.StandardCost_STPRS
        WHEN CurrentStock.MaterialType_MTART IN ('ROH', 'HIBE')
          THEN CurrentStock.QuantityMonthlyCumulative * CurrentStock.MovingAveragePrice_VERPR
        ELSE 0
      END AS InventoryValue
    FROM
      CurrentStock
    LEFT JOIN
      CalculatedMetrics
      ON
        CurrentStock.Client_MANDT = CalculatedMetrics.Client_MANDT
        AND CurrentStock.MaterialNumber_MATNR = CalculatedMetrics.MaterialNumber_MATNR
        AND CurrentStock.Plant_WERKS = CalculatedMetrics.Plant_WERKS
        AND CurrentStock.LanguageKey_SPRAS = CalculatedMetrics.LanguageKey_SPRAS
        AND CurrentStock.MonthEndDate = CalculatedMetrics.MonthEndDate
        AND CurrentStock.FiscalPeriod = CalculatedMetrics.FiscalPeriod
        AND CurrentStock.FiscalYear = CalculatedMetrics.FiscalYear
  )

SELECT
  Inventory.Client_MANDT,
  Inventory.MaterialNumber_MATNR,
  Inventory.Plant_WERKS,
  Inventory.MaterialType_MTART,
  Inventory.DescriptionOfMaterialType_MTBEZ,
  Inventory.MaterialText_MAKTX,
  Inventory.MaterialGroup_MATKL,
  Inventory.MaterialGroupName_WGBEZ,
  Inventory.Plant_Name2_NAME2,
  Inventory.CompanyCode_BUKRS,
  Inventory.CompanyText_BUTXT,
  Inventory.CountryKey_LAND1,
  Inventory.LanguageKey_SPRAS,
  Inventory.FiscalYear,
  Inventory.FiscalPeriod,
  Inventory.CalYear,
  Inventory.CalMonth,
  Inventory.MonthEndDate,
  Inventory.QuantityMonthlyCumulative,
  Inventory.BaseUnitOfMeasure_MEINS,
  Inventory.AmountMonthlyCumulative,
  Inventory.CurrencyKey_WAERS,
  Inventory.StockOnHand,
  Inventory.StockOnHandValue,
  Inventory.QuantityIssuedToDelivery,
  Inventory.TotalConsumptionQuantity,
  Inventory.ValueOfTotalValuatedStock_SALK3,
  Inventory.StandardCost_STPRS,
  Inventory.MovingAveragePrice_VERPR,
  Inventory.TotalConsumptionQuantityForPastYear,
  Inventory.TotalConsumptionQuantityForPastYearTillToday,
  Inventory.DemandPerDayForPastYearTillToday,
  Inventory.CostOfGoodsSoldByMonth,
  Inventory.InventoryValue,
  Inventory.ThresholdValue,
  Inventory.InventoryByMonth,
  Inventory.AvgInventoryByMonth,
  CurrencyConversion.ExchangeRate_UKURS,
  CurrencyConversion.ToCurrency_TCURR AS TargetCurrency_TCURR,
  Inventory.AmountMonthlyCumulative * CurrencyConversion.ExchangeRate_UKURS AS AmountMonthlyCumulativeInTargetCurrency,
  Inventory.StockOnHandValue * CurrencyConversion.ExchangeRate_UKURS AS StockOnHandValueInTargetCurrency,
  Inventory.StandardCost_STPRS * CurrencyConversion.ExchangeRate_UKURS AS StandardCostInTargetCurrency_STPRS,
  Inventory.MovingAveragePrice_VERPR * CurrencyConversion.ExchangeRate_UKURS AS MovingAveragePriceInTargetCurrency_VERPR,
  Inventory.CostOfGoodsSoldByMonth * CurrencyConversion.ExchangeRate_UKURS AS CostofGoodsSoldInTargetCurrency,
  Inventory.InventoryValue * CurrencyConversion.ExchangeRate_UKURS AS InventoryValueInTargetCurrency,
  Inventory.InventoryByMonth * CurrencyConversion.ExchangeRate_UKURS AS InventoryByMonthInTargetCurrency,
  Inventory.AvgInventoryByMonth * CurrencyConversion.ExchangeRate_UKURS AS AvgInventoryByMonthInTargetCurrency,
  Inventory.ValueOfTotalValuatedStock_SALK3 * CurrencyConversion.ExchangeRate_UKURS AS ValueOfTotalValuatedStockInTargetCurrency_SALK3,
  IF(
    COALESCE(
      IF(
        Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
        SAFE_DIVIDE((Inventory.TotalConsumptionQuantityForPastYear * 100), Inventory.StockOnHand),
        0
      ),
      0
    ) < Inventory.ThresholdValue,
    IF(
      Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
      (Inventory.StockOnHandValue * CurrencyConversion.ExchangeRate_UKURS),
      0
    ),
    0
  ) AS SlowMovingInventoryAsOfPreviousMonthInTargetCurrency,
  COALESCE(
    IF(
      Inventory.MonthEndDate = CURRENT_DATE,
      SAFE_DIVIDE(Inventory.StockOnHand, Inventory.DemandPerDayForPastYearTillToday),
      0
    ),
    0
  ) AS DaysOfSupplyAsOfToday,
  IF(
    COALESCE(
      IF(
        Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
        SAFE_DIVIDE((Inventory.TotalConsumptionQuantityForPastYear * 100), Inventory.StockOnHand),
        0
      ),
      0
    ) < Inventory.ThresholdValue,
    COALESCE(
      IF(
        Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
        SAFE_DIVIDE((Inventory.TotalConsumptionQuantityForPastYear * 100), Inventory.StockOnHand),
        0
      ),
      0
    ),
    0
  ) AS SlowMovingIndicatorAsOfPreviousMonth,
  IF(
    COALESCE(
      IF(
        Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
        SAFE_DIVIDE((Inventory.TotalConsumptionQuantityForPastYear * 100), Inventory.StockOnHand),
        0
      ),
      0
    ) < Inventory.ThresholdValue,
    IF(
      Inventory.MonthEndDate = LAST_DAY(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)),
      Inventory.StockOnHandValue,
      0
    ),
    0
  ) AS SlowMovingInventoryAsOfPreviousMonthInSourceCurrency,
  COALESCE(
    SAFE_DIVIDE(Inventory.CostOfGoodsSoldByMonth, Inventory.AvgInventoryByMonth),
    0
  ) AS InventoryTurnByMonth
FROM
  Inventory
LEFT JOIN
  CurrencyConversion AS CurrencyConversion
  ON
    Inventory.Client_MANDT = CurrencyConversion.Client_MANDT
    AND Inventory.CurrencyKey_WAERS = CurrencyConversion.FromCurrency_FCURR
    AND Inventory.MonthEndDate = CurrencyConversion.ConvDate
`
);
