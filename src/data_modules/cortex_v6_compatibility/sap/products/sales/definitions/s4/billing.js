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

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("billing", { ...publishConfig, name: "Billing" }).query(
  (ctx) => `
WITH
  AGG_PRCD_ELEMENTS AS (
    SELECT
      Prcd_Elements.client AS Mandt,
      Prcd_Elements.knumv AS Knumv,
      Prcd_Elements.kposn AS Kposn,
      SUM(IF(Prcd_Elements.koaid = 'C' AND Prcd_Elements.kinak IS NULL, Prcd_Elements.kwert, NULL)) AS Rebate
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'prcd_elements')} AS Prcd_Elements
    GROUP BY Mandt, Knumv, Kposn
  ),
  currency_decimal AS (
    ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
  )

SELECT
  VBRK.MANDT AS Client_MANDT,
  VBRK.FKART AS BillingType_FKART,
  VBRK.FKTYP AS BillingCategory_FKTYP,
  VBRK.VKORG AS SalesOrganization_VKORG,
  VBRK.VTWEG AS DistributionChannel_VTWEG,
  VBRK.SPART AS Division_SPART,
  VBRK.VBTYP AS SDDocumentCategory_VBTYP,
  VBRK.BZIRK AS SalesDistrict_BZIRK,
  VBRK.PLTYP AS PriceListType_PLTYP,
  VBRK.FKSTO AS BillingDocumentIsCancelled_FKSTO,
  VBRK.KUNRG AS Payer_KUNRG,
  VBRK.INCO1 AS IncotermsPart1_INCO1,
  VBRK.INCO2 AS IncotermsPart2_INCO2,
  VBRK.LAND1 AS DestinationCountry_LAND1,
  VBRK.REGIO AS Region_REGIO,
  VBRK.COUNC AS CountryCode_COUNC,
  VBRK.CITYC AS CityCode_CITYC,
  VBRK.TAXK1 AS TaxClassification1ForCustomer_TAXK1,
  VBRK.TAXK2 AS TaxClassification2ForCustomer_TAXK2,
  VBRK.TAXK3 AS TaxClassification3ForCustomer_TAXK3,
  VBRK.TAXK4 AS TaxClassification4ForCustomer_TAXK4,
  VBRK.TAXK5 AS TaxClassification5ForCustomer_TAXK5,
  VBRK.LANDTX AS TaxDepartureCountry_LANDTX,
  VBRK.STCEG_L AS CountryOfSalesTaxIDNumber_STCEG_L,
  VBRK.FKDAT AS BillingDate_FKDAT,
  VBRK.BELNR AS AccountingDocumentNumber_BELNR,
  VBRK.GJAHR AS FiscalYear_GJAHR,
  VBRK.POPER AS PostingPeriod_POPER,
  VBRK.WAERK AS SdDocumentCurrency_WAERK,
  VBRK.KNUMV AS NumberOfTheDocumentCondition_KNUMV,
  VBRK.VSBED AS ShippingConditions_VSBED,
  VBRK.KUNAG AS SoldToParty_KUNAG,
  VBRP.VBELN AS BillingDocument_VBELN,
  VBRP.POSNR AS BillingItem_POSNR,
  VBRP.PSTYV AS SalesDocumentItemCategory_PSTYV,
  VBRP.POSAR AS ItemType_POSAR,
  VBRP.PRODH AS ProductHierarchy_PRODH,
  VBRP.WERKS AS Plant_WERKS,
  VBRP.LGORT AS StorageLocation_LGORT,
  VBRP.VSTEL AS ShippingPointReceivingPoint_VSTEL,
  VBRP.FKIMG AS ActualBilledQuantity_FKIMG,
  VBRP.VRKME AS SalesUnit_VRKME,
  VBRP.MEINS AS BaseUnitOfMeasure_MEINS,
  VBRP.SMENG AS ScaleQuantity_SMENG,
  VBRP.FKLMG AS BilledQuantityInStockKeepingUnit_FKLMG,
  VBRP.LMENG AS RequiredDeliveryQuantity_LMENG,
  VBRP.MATNR AS MaterialNumber_MATNR,
  VBRP.ARKTX AS ShortTextForSalesOrderItem_ARKTX,
  VBRP.MATWA AS MaterialEntered_MATWA,
  VBRP.CHARG AS BatchNumber_CHARG,
  VBRP.PRCTR AS ProfitCenter_PRCTR,
  VBRP.SPART AS Division_SPART_VBRP,
  VBRP.GSBER AS BusinessArea_GSBER,
  VBRP.VGBEL AS DocumentNumberOfTheReferenceDocument_VGBEL,
  VBRP.VGPOS AS ItemNumberOfTheReferenceItem_VGPOS,
  VBRP.AUBEL AS SalesDocument_AUBEL,
  VBRP.AUPOS AS SalesDocumentItem_AUPOS,
  VBRP.SHKZG AS ReturnsItem_SHKZG,
  VBRP.WAVWR AS CostInDocumentCurrency_WAVWR,
  VBRP.KOUPD AS ConditionUpdate_KOUPD,
  VBRP.VGTYP AS DocumentCategoryOfPrecedingSDDocument_VGTYP,
  VBRP.KOKRS AS ControllingArea_KOKRS,
  VBRP.PAOBJNR AS ProfitabilitySegmentNumber_PAOBJNR,
  VBRP.SKTOF AS CashDiscountIndicator_SKTOF,
  VBRP.VOLUM AS Volume_VOLUM,
  VBRP.BRGEW AS GrossWeight_BRGEW,
  VBRP.NTGEW AS NetWeight_NTGEW,
  
  COALESCE(VBRP.NETWR * currency_decimal.CURRFIX, VBRP.NETWR) AS NetValue_NETWR,
  COALESCE(VBRK.MWSBK * currency_decimal.CURRFIX, VBRK.MWSBK) AS TaxAmount_MWSBK,
  COALESCE(VBRP.MWSBP * currency_decimal.CURRFIX, VBRP.MWSBP) AS TaxAmountPos_MWSBP,
  COALESCE(AGG_PRCD_ELEMENTS.rebate * currency_decimal.CURRFIX, AGG_PRCD_ELEMENTS.rebate) AS Rebate,
  
  -- Windowed Metrics
  COUNT(VBRK.VBELN) OVER (PARTITION BY CalendarDateDimension_FKDAT.CalYear) AS YearOrderCount,
  COUNT(VBRK.VBELN) OVER (PARTITION BY CalendarDateDimension_FKDAT.CalYear, CalendarDateDimension_FKDAT.CalMonth) AS MonthOrderCount,
  COUNT(VBRK.VBELN) OVER (PARTITION BY CalendarDateDimension_FKDAT.CalYear, CalendarDateDimension_FKDAT.CalMonth, CalendarDateDimension_FKDAT.CalWeek) AS WeekOrderCount

FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbrk')} AS VBRK
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbrp')} AS VBRP
  ON
    VBRK.VBELN = VBRP.VBELN
    AND VBRK.MANDT = VBRP.MANDT
INNER JOIN
  AGG_PRCD_ELEMENTS
  ON
    AGG_PRCD_ELEMENTS.MANDT = VBRK.MANDT
    AND CAST(AGG_PRCD_ELEMENTS.Knumv AS STRING) = VBRK.KNUMV
    AND CAST(AGG_PRCD_ELEMENTS.Kposn AS STRING) = VBRP.POSNR
LEFT JOIN
  currency_decimal AS currency_decimal
  ON VBRK.WAERK = currency_decimal.CURRKEY
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'calendar_date_dim')} AS CalendarDateDimension_FKDAT
  ON CalendarDateDimension_FKDAT.Date = VBRK.FKDAT
`
);
