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
const master_data = require("includes/master_data.js");

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

const targetCurrencies = moduleConfig.moduleSettings?.targetCurrencies || ['USD'];
const rateType = moduleConfig.moduleSettings?.rateType || 'M';
const languages = moduleConfig.moduleSettings?.languages || ['E'];

publish("inventory_by_plant", { ...publishConfig, name: "InventoryByPlant" }).query(
  (ctx) => `
WITH
  LanguageKey AS (
    SELECT LanguageKey_SPRAS
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'Languages_T002')}
    WHERE LanguageKey_SPRAS IN UNNEST(${JSON.stringify(languages)})
  ),

  CurrencyConversion AS (
    SELECT
      Client_MANDT, FromCurrency_FCURR, ToCurrency_TCURR, ConvDate, ExchangeRate_UKURS
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CurrencyConversion')}
    WHERE
      ToCurrency_TCURR IN UNNEST(${JSON.stringify(targetCurrencies)})
      AND ExchangeRateType_KURST = '${rateType}'
  ),

  Materials AS (
    ${master_data.getMaterialsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  MaterialTypes AS (
    ${master_data.getMaterialTypesMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  MaterialGroups AS (
    ${master_data.getMaterialGroupsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  Plants AS (
    ${master_data.getPlantsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  StorageLocations AS (
    ${master_data.getStorageLocationsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  MaterialCostAndPrice AS (
    SELECT DISTINCT
      StockWeeklySnapshots.MaterialNumber_MATNR,
      StockWeeklySnapshots.Plant_WERKS,
      StockWeeklySnapshots.WeekEndDate,
      StockWeeklySnapshots.FiscalYear,
      StockWeeklySnapshots.FiscalPeriod,
      COALESCE(
        MaterialLedger.StandardCost_STPRS,
        LAST_VALUE(MaterialLedger.StandardCost_STPRS IGNORE NULLS)
          OVER (
            PARTITION BY
              StockWeeklySnapshots.MaterialNumber_MATNR, StockWeeklySnapshots.Plant_WERKS
            ORDER BY
              StockWeeklySnapshots.WeekEndDate
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )) AS StandardCost_STPRS,
      COALESCE(
        MaterialLedger.MovingAveragePrice,
        LAST_VALUE(MaterialLedger.MovingAveragePrice IGNORE NULLS)
          OVER (
            PARTITION BY
              StockWeeklySnapshots.MaterialNumber_MATNR, StockWeeklySnapshots.Plant_WERKS
            ORDER BY
              StockWeeklySnapshots.WeekEndDate
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )) AS MovingAveragePrice_VERPR
    FROM
      ${ctx.ref('StockWeeklySnapshots')} AS StockWeeklySnapshots
    LEFT JOIN
      ${ctx.ref('MaterialLedger')} AS MaterialLedger
      ON
        StockWeeklySnapshots.Client_MANDT = MaterialLedger.Client_MANDT
        AND StockWeeklySnapshots.MaterialNumber_MATNR = MaterialLedger.MaterialNumber_MATNR
        AND StockWeeklySnapshots.Plant_WERKS = MaterialLedger.ValuationArea_BWKEY
        AND StockWeeklySnapshots.FiscalYear = MaterialLedger.FiscalYear
        AND StockWeeklySnapshots.FiscalPeriod = MaterialLedger.PostingPeriod
    WHERE
      MaterialLedger.ValuationType_BWTAR = ''
  ),

  CurrentStock AS (
    SELECT
      StockWeeklySnapshots.Client_MANDT,
      StockWeeklySnapshots.MaterialNumber_MATNR,
      StockWeeklySnapshots.BatchNumber_CHARG,
      StockWeeklySnapshots.Plant_WERKS,
      StockWeeklySnapshots.StorageLocation_LGORT,
      StorageLocations.StorageLocationText_LGOBE,
      StockWeeklySnapshots.CompanyCode_BUKRS,
      StockWeeklySnapshots.CompanyText_BUTXT,
      StockWeeklySnapshots.BaseUnitOfMeasure_MEINS,
      StockWeeklySnapshots.CurrencyKey_WAERS,
      StockWeeklySnapshots.CalYear,
      StockWeeklySnapshots.CalWeek,
      StockWeeklySnapshots.FiscalYear,
      StockWeeklySnapshots.FiscalPeriod,
      StockWeeklySnapshots.StockCharacteristic,
      MaterialsBatchMD.DateOfManufacture_HSDAT,
      MaterialPlantsMD.SafetyStock_EISBE,
      Plants.Name2_NAME2 AS PlantName_NAME2,
      Plants.CountryKey_LAND1,
      Plants.DivisionForIntercompanyBilling_SPART,
      Plants.ValuationArea_BWKEY,
      StockWeeklySnapshots.QuantityWeeklyCumulative,
      StockWeeklySnapshots.AmountWeeklyCumulative,
      IF(
        StockWeeklySnapshots.WeekEndDate = LAST_DAY(CURRENT_DATE, WEEK),
        CURRENT_DATE,
        StockWeeklySnapshots.WeekEndDate
      ) AS WeekEndDate,
      MaterialCostAndPrice.StandardCost_STPRS,
      MaterialCostAndPrice.MovingAveragePrice_VERPR
    FROM
      ${ctx.ref('StockWeeklySnapshots')} AS StockWeeklySnapshots
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'MaterialsBatchMD')} AS MaterialsBatchMD
      ON
        StockWeeklySnapshots.Client_MANDT = MaterialsBatchMD.Client_MANDT
        AND StockWeeklySnapshots.MaterialNumber_MATNR = MaterialsBatchMD.MaterialNumber_MATNR
        AND StockWeeklySnapshots.BatchNumber_CHARG = MaterialsBatchMD.BatchNumber_CHARG
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'MaterialPlantsMD')} AS MaterialPlantsMD
      ON
        StockWeeklySnapshots.Client_MANDT = MaterialPlantsMD.Client_MANDT
        AND StockWeeklySnapshots.MaterialNumber_MATNR = MaterialPlantsMD.MaterialNumber_MATNR
        AND StockWeeklySnapshots.Plant_WERKS = MaterialPlantsMD.Plant_WERKS
    LEFT JOIN
      Plants
      ON
        StockWeeklySnapshots.Client_MANDT = Plants.Client_MANDT
        AND StockWeeklySnapshots.Plant_WERKS = Plants.Plant_WERKS
    LEFT JOIN
      MaterialCostAndPrice
      ON
        StockWeeklySnapshots.MaterialNumber_MATNR = MaterialCostAndPrice.MaterialNumber_MATNR
        AND StockWeeklySnapshots.Plant_WERKS = MaterialCostAndPrice.Plant_WERKS
        AND StockWeeklySnapshots.WeekEndDate = MaterialCostAndPrice.WeekEndDate
        AND StockWeeklySnapshots.FiscalYear = MaterialCostAndPrice.FiscalYear
        AND StockWeeklySnapshots.FiscalPeriod = MaterialCostAndPrice.FiscalPeriod
    LEFT JOIN
      StorageLocations
      ON
        StockWeeklySnapshots.Client_MANDT = StorageLocations.Client_MANDT
        AND StockWeeklySnapshots.StorageLocation_LGORT = StorageLocations.StorageLocation_LGORT
        AND StockWeeklySnapshots.Plant_WERKS = StorageLocations.Plant_WERKS
  )

SELECT
  CurrentStock.Client_MANDT,
  CurrentStock.MaterialNumber_MATNR,
  CurrentStock.BatchNumber_CHARG,
  CurrentStock.Plant_WERKS,
  CurrentStock.StorageLocation_LGORT,
  CurrentStock.StorageLocationText_LGOBE,
  CurrentStock.CompanyCode_BUKRS,
  CurrentStock.CompanyText_BUTXT,
  CurrentStock.BaseUnitOfMeasure_MEINS,
  CurrentStock.CurrencyKey_WAERS,
  CurrentStock.DateOfManufacture_HSDAT,
  Materials.MaterialText_MAKTX,
  LanguageKey.LanguageKey_SPRAS,
  Materials.TotalShelfLife_MHDHB,
  Materials.MaterialType_MTART,
  MaterialTypes.DescriptionOfMaterialType_MTBEZ,
  CurrentStock.StandardCost_STPRS,
  CurrentStock.MovingAveragePrice_VERPR,
  Materials.MaterialGroup_MATKL,
  MaterialGroups.MaterialGroupName_WGBEZ,
  CurrentStock.SafetyStock_EISBE,
  CurrentStock.PlantName_NAME2,
  CurrentStock.CountryKey_LAND1,
  CurrentStock.DivisionForIntercompanyBilling_SPART,
  CurrentStock.ValuationArea_BWKEY,
  CurrentStock.CalYear,
  CurrentStock.CalWeek,
  CurrentStock.WeekEndDate,
  CurrentStock.FiscalYear,
  CurrentStock.FiscalPeriod,
  CurrentStock.QuantityWeeklyCumulative,
  CurrentStock.AmountWeeklyCumulative,
  CurrentStock.StockCharacteristic,
  CurrencyConversion.ExchangeRate_UKURS,
  CurrencyConversion.ToCurrency_TCURR AS TargetCurrency_TCURR,
  CurrentStock.AmountWeeklyCumulative * CurrencyConversion.ExchangeRate_UKURS AS AmountWeeklyCumulativeInTargetCurrency,
  CurrentStock.StandardCost_STPRS * CurrencyConversion.ExchangeRate_UKURS AS StandardCostInTargetCurrency_STPRS,
  CurrentStock.MovingAveragePrice_VERPR * CurrencyConversion.ExchangeRate_UKURS AS MovingAveragePriceInTargetCurrency_VERPR,

  COALESCE(
    IF(
      Materials.MaterialType_MTART IN ('FERT', 'HALB'),
      CurrentStock.QuantityWeeklyCumulative * (CurrentStock.StandardCost_STPRS * CurrencyConversion.ExchangeRate_UKURS),
      IF(
        Materials.MaterialType_MTART IN ('ROH', 'HIBE'),
        CurrentStock.QuantityWeeklyCumulative * (CurrentStock.MovingAveragePrice_VERPR * CurrencyConversion.ExchangeRate_UKURS),
        0
      )
    ), 0
  ) AS InventoryValueInTargetCurrency,

  IF(
    SAFE.DATE_ADD(
      CurrentStock.DateOfManufacture_HSDAT,
      INTERVAL CAST(Materials.TotalShelfLife_MHDHB AS INT64) DAY
    ) < CURRENT_DATE,
    (CurrentStock.AmountWeeklyCumulative * CurrencyConversion.ExchangeRate_UKURS),
    0
  ) AS ObsoleteInventoryValueInTargetCurrency,

  COALESCE(
    IF(
      Materials.MaterialType_MTART IN ('FERT', 'HALB'),
      CurrentStock.QuantityWeeklyCumulative * CurrentStock.StandardCost_STPRS,
      IF(
        Materials.MaterialType_MTART IN ('ROH', 'HIBE'),
        CurrentStock.QuantityWeeklyCumulative * CurrentStock.MovingAveragePrice_VERPR,
        0
      )
    ), 0
  ) AS InventoryValueInSourceCurrency,

  IF(
    SAFE.DATE_ADD(
      CurrentStock.DateOfManufacture_HSDAT,
      INTERVAL CAST(Materials.TotalShelfLife_MHDHB AS INT64) DAY
    ) < CURRENT_DATE,
    CurrentStock.QuantityWeeklyCumulative,
    0
  ) AS ObsoleteStock,

  IF(
    SAFE.DATE_ADD(
      CurrentStock.DateOfManufacture_HSDAT,
      INTERVAL CAST(Materials.TotalShelfLife_MHDHB AS INT64) DAY
    ) < CURRENT_DATE,
    CurrentStock.AmountWeeklyCumulative,
    0
  ) AS ObsoleteInventoryValueInSourceCurrency

FROM
  CurrentStock
LEFT JOIN
  CurrencyConversion
  ON
    CurrentStock.Client_MANDT = CurrencyConversion.Client_MANDT
    AND CurrentStock.CurrencyKey_WAERS = CurrencyConversion.FromCurrency_FCURR
    AND CurrentStock.WeekEndDate = CurrencyConversion.ConvDate
CROSS JOIN
  LanguageKey
LEFT JOIN
  Materials
  ON
    CurrentStock.Client_MANDT = Materials.Client_MANDT
    AND CurrentStock.MaterialNumber_MATNR = Materials.MaterialNumber_MATNR
    AND Materials.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  MaterialTypes
  ON
    Materials.Client_MANDT = MaterialTypes.Client_MANDT
    AND Materials.MaterialType_MTART = MaterialTypes.MaterialType_MTART
    AND MaterialTypes.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  MaterialGroups
  ON
    Materials.Client_MANDT = MaterialGroups.Client_MANDT
    AND Materials.MaterialGroup_MATKL = MaterialGroups.MaterialGroup_MATKL
    AND MaterialGroups.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
`
);
