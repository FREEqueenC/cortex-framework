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

const languages = moduleConfig.moduleSettings?.languages || ['E'];

const materializationType = tableConfig.materializationType || "view";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("stock_monthly_snapshots_legacy", { ...publishConfig, name: "StockMonthlySnapshots" }).query(
  (ctx) => `
WITH
  LanguageKey AS (
    SELECT spras AS LanguageKey_SPRAS
    FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't002')}
    WHERE spras IN UNNEST(${JSON.stringify(languages)})
  ),
  currency_decimal AS (
    ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  StorageLocationsMD AS (
    ${master_data.getStorageLocationsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  CompaniesMD AS (
    ${master_data.getCompaniesMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  PlantsMD AS (
    ${master_data.getPlantsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  MaterialsMD AS (
    ${master_data.getMaterialsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  MaterialTypesMD AS (
    ${master_data.getMaterialTypesMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  MaterialGroupsMD AS (
    ${master_data.getMaterialGroupsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  )

SELECT
  StockMonthlySnapshots.mandt AS Client_MANDT,
  StockMonthlySnapshots.matnr AS MaterialNumber_MATNR,
  MaterialsMD.MaterialText_MAKTX,
  StockMonthlySnapshots.werks AS Plant_WERKS,
  PlantsMD.Name2_NAME2 AS Plant_Name2_NAME2,
  StockMonthlySnapshots.lgort AS StorageLocation_LGORT,
  StorageLocationsMD.StorageLocationText_LGOBE,
  StockMonthlySnapshots.charg AS BatchNumber_CHARG,
  StockMonthlySnapshots.bukrs AS CompanyCode_BUKRS,
  MaterialsMD.MaterialType_MTART,
  MaterialTypesMD.DescriptionOfMaterialType_MTBEZ,
  MaterialsMD.MaterialGroup_MATKL,
  MaterialGroupsMD.MaterialGroupName_WGBEZ,
  CompaniesMD.CompanyText_BUTXT,
  PlantsMD.CountryKey_LAND1,
  StockMonthlySnapshots.stock_characteristic AS StockCharacteristic,
  FiscalDateDimension_MONTHENDDATE.FiscalYear,
  FiscalDateDimension_MONTHENDDATE.FiscalPeriod,
  StockMonthlySnapshots.cal_year AS CalYear,
  StockMonthlySnapshots.cal_month AS CalMonth,
  StockMonthlySnapshots.month_end_date AS MonthEndDate,
  SUM(SUM(StockMonthlySnapshots.total_monthly_movement_quantity)) OVER (
    PARTITION BY
      StockMonthlySnapshots.mandt,
      StockMonthlySnapshots.matnr,
      StockMonthlySnapshots.werks,
      StockMonthlySnapshots.lgort,
      StockMonthlySnapshots.charg,
      StockMonthlySnapshots.bukrs,
      StockMonthlySnapshots.stock_characteristic,
      StockMonthlySnapshots.meins,
      StockMonthlySnapshots.waers,
      LanguageKey.LanguageKey_SPRAS
    ORDER BY StockMonthlySnapshots.month_end_date ASC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS QuantityMonthlyCumulative,
  StockMonthlySnapshots.meins AS BaseUnitOfMeasure_MEINS,
  CAST(SUM(SUM(COALESCE(
    StockMonthlySnapshots.total_monthly_movement_amount * currency_decimal.CURRFIX,
    StockMonthlySnapshots.total_monthly_movement_amount
  ))) OVER (
    PARTITION BY
      StockMonthlySnapshots.mandt,
      StockMonthlySnapshots.matnr,
      StockMonthlySnapshots.werks,
      StockMonthlySnapshots.lgort,
      StockMonthlySnapshots.charg,
      StockMonthlySnapshots.bukrs,
      StockMonthlySnapshots.stock_characteristic,
      StockMonthlySnapshots.meins,
      StockMonthlySnapshots.waers,
      LanguageKey.LanguageKey_SPRAS
    ORDER BY StockMonthlySnapshots.month_end_date ASC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS NUMERIC) AS AmountMonthlyCumulative,
  StockMonthlySnapshots.waers AS CurrencyKey_WAERS,
  LanguageKey.LanguageKey_SPRAS,

  -- Quantity Issued To Delivery
  SUM(IF(
    StockMonthlySnapshots.bwart IN ('601', '602'),
    (StockMonthlySnapshots.total_monthly_movement_quantity * -1),
    0
  )) AS QuantityIssuedToDelivery,

  -- Stock On Hand
  SUM(IF(
    StockMonthlySnapshots.stock_characteristic = 'Unrestricted',
    StockMonthlySnapshots.quantity_monthly_cumulative,
    0
  )) AS StockOnHand,

  -- Stock On Hand Value
  CAST(SUM(IF(
    StockMonthlySnapshots.stock_characteristic = 'Unrestricted',
    COALESCE(
      StockMonthlySnapshots.amount_monthly_cumulative * currency_decimal.CURRFIX,
      StockMonthlySnapshots.amount_monthly_cumulative
    ),
    0
  )) AS NUMERIC) AS StockOnHandValue,

  -- Total Consumption Quantity
  SUM(IF(
    MaterialsMD.MaterialType_MTART IN ('FERT', 'HALB') AND StockMonthlySnapshots.bwart IN ('601', '602'),
    (StockMonthlySnapshots.total_monthly_movement_quantity * -1),
    IF(
      MaterialsMD.MaterialType_MTART IN ('ROH', 'HIBE') AND StockMonthlySnapshots.bwart IN ('261', '262'),
      (StockMonthlySnapshots.total_monthly_movement_quantity * -1),
      0
    )
  )) AS TotalConsumptionQuantity
FROM ${ctx.ref('stock_monthly_snapshots')} AS StockMonthlySnapshots
LEFT JOIN currency_decimal AS currency_decimal
  ON StockMonthlySnapshots.waers = currency_decimal.CURRKEY
LEFT JOIN StorageLocationsMD AS StorageLocationsMD
  ON StockMonthlySnapshots.mandt = StorageLocationsMD.Client_MANDT
    AND StockMonthlySnapshots.lgort = StorageLocationsMD.StorageLocation_LGORT
    AND StockMonthlySnapshots.werks = StorageLocationsMD.Plant_WERKS
LEFT JOIN CompaniesMD AS CompaniesMD
  ON StockMonthlySnapshots.mandt = CompaniesMD.Client_MANDT
    AND StockMonthlySnapshots.bukrs = CompaniesMD.CompanyCode_BUKRS
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_MONTHENDDATE
  ON StockMonthlySnapshots.mandt = FiscalDateDimension_MONTHENDDATE.MANDT
    AND CompaniesMD.FiscalyearVariant_PERIV = FiscalDateDimension_MONTHENDDATE.PERIV
    AND StockMonthlySnapshots.month_end_date = FiscalDateDimension_MONTHENDDATE.DATE
LEFT JOIN PlantsMD AS PlantsMD
  ON StockMonthlySnapshots.mandt = PlantsMD.Client_MANDT
    AND StockMonthlySnapshots.werks = PlantsMD.Plant_WERKS
CROSS JOIN LanguageKey AS LanguageKey
LEFT JOIN MaterialsMD AS MaterialsMD
  ON StockMonthlySnapshots.mandt = MaterialsMD.Client_MANDT
    AND StockMonthlySnapshots.matnr = MaterialsMD.MaterialNumber_MATNR
    AND MaterialsMD.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN MaterialTypesMD AS MaterialTypesMD
  ON MaterialsMD.Client_MANDT = MaterialTypesMD.Client_MANDT
    AND MaterialsMD.MaterialType_MTART = MaterialTypesMD.MaterialType_MTART
    AND MaterialTypesMD.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN MaterialGroupsMD AS MaterialGroupsMD
  ON MaterialsMD.Client_MANDT = MaterialGroupsMD.Client_MANDT
    AND MaterialsMD.MaterialGroup_MATKL = MaterialGroupsMD.MaterialGroup_MATKL
    AND MaterialGroupsMD.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
WHERE StockMonthlySnapshots.stock_characteristic != 'BlockedReturns'
GROUP BY
  StockMonthlySnapshots.mandt,
  StockMonthlySnapshots.matnr,
  MaterialsMD.MaterialText_MAKTX,
  StockMonthlySnapshots.werks,
  PlantsMD.Name2_NAME2,
  StockMonthlySnapshots.lgort,
  StorageLocationsMD.StorageLocationText_LGOBE,
  StockMonthlySnapshots.charg,
  StockMonthlySnapshots.bukrs,
  MaterialsMD.MaterialType_MTART,
  MaterialTypesMD.DescriptionOfMaterialType_MTBEZ,
  MaterialsMD.MaterialGroup_MATKL,
  MaterialGroupsMD.MaterialGroupName_WGBEZ,
  CompaniesMD.CompanyText_BUTXT,
  PlantsMD.CountryKey_LAND1,
  StockMonthlySnapshots.stock_characteristic,
  FiscalDateDimension_MONTHENDDATE.FiscalYear,
  FiscalDateDimension_MONTHENDDATE.FiscalPeriod,
  StockMonthlySnapshots.cal_year,
  StockMonthlySnapshots.cal_month,
  StockMonthlySnapshots.month_end_date,
  StockMonthlySnapshots.meins,
  StockMonthlySnapshots.waers,
  LanguageKey.LanguageKey_SPRAS
`
);
