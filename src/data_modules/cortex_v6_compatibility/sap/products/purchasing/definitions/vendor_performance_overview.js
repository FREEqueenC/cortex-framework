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

publish("vendor_performance_overview", { ...publishConfig, name: "VendorPerformanceOverview" }).query(
  (ctx) => `
WITH
  currency_decimal AS (
    ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  MaterialLedger AS (
    ${master_data.getMaterialLedger(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  VendorPerformance AS (
    SELECT
      Client_MANDT,
      PurchasingDocumentDate_BEDAT,
      Company_BUKRS,
      PurchasingOrganization_EKORG,
      PurchasingGroup_EKGRP,
      VendorAccountNumber_LIFNR,
      NAME1 AS VendorName,
      CountryKey_LAND1 AS VendorCountry,
      FiscalyearVariant_PERIV,
      MaterialNumber_MATNR,
      Plant_WERKS,
      MaterialType_MTART,
      InvoiceDate,
      MAX(YearOfPurchasingDocumentDate_BEDAT) AS YearOfPurchasingDocumentDate_BEDAT,
      MAX(MonthOfPurchasingDocumentDate_BEDAT) AS MonthOfPurchasingDocumentDate_BEDAT,
      MAX(WeekOfPurchasingDocumentDate_BEDAT) AS WeekOfPurchasingDocumentDate_BEDAT,
      ANY_VALUE(CompanyText_BUTXT) AS Company,
      ANY_VALUE(PurchasingOrganizationText_EKOTX) AS PurchasingOrganization,
      ANY_VALUE(PurchasingGroupText_EKNAM) AS PurchasingGroup,
      ANY_VALUE(MaterialText_MAKTX) AS Material,
      ANY_VALUE(DescriptionOfMaterialType_MTBEZ) AS MaterialType,
      SUM(POQuantity_MENGE) AS POQuantity_MENGE,
      AVG(NetPrice_NETPR) AS AverageNetPrice,
      TargetCurrency_TCURR,
      LanguageKey_SPRAS,
      AVG(ExchangeRate_UKURS) AS ExchangeRate_UKURS,
      AVG(NetPriceInTargetCurrency_NETPR) AS AverageNetPriceInTargetCurrency,
      COUNTIF(IsRejected) AS CountRejectedOrders,
      COUNTIF(NOT IsRejected) AS CountNotRejectedOrders,
      COUNTIF(VendorOnTimeDelivery = 'NotDelayed') AS CountNotDelayedOrders,
      COUNTIF(VendorOnTimeDelivery = 'Delayed') AS CountDelayedOrders,
      COUNTIF(VendorInFullDelivery = 'DeliveredInFull') AS CountInFullOrders,
      COUNTIF(VendorInFullDelivery = 'NotDeliveredInFull') AS CountNotInFullOrders,
      COUNTIF(VendorInvoiceAccuracy = 'AccurateInvoice') AS CountAccurateInvoices,
      COUNTIF(VendorInvoiceAccuracy = 'InaccurateInvoice') AS CountInaccurateInvoices,
      COUNTIF(PastDueOrOpenItems = 'PastDue') AS CountPastDueOrders,
      COUNTIF(PastDueOrOpenItems = 'Open') AS CountOpenOrders,
      COALESCE(SUM(InvoiceAmountInSourceCurrency), 0) AS TotalSpend,
      COALESCE(SUM(InvoiceAmountInTargetCurrency), 0) AS TotalSpendInTargetCurrency,
      SUM(InvoiceCount) AS ClearedInvoices,
      MAX(YearOfInvoiceDate) AS YearOfInvoiceDate,
      MAX(MonthOfInvoiceDate) AS MonthOfInvoiceDate,
      MAX(WeekOfInvoiceDate) AS WeekOfInvoiceDate,
      MAX(FiscalYear) AS FiscalYear,
      MAX(FiscalPeriod) AS FiscalPeriod
    FROM
      ${ctx.ref('VendorPerformance')} AS VendorPerformance
    WHERE
      VendorPerformance.Client_MANDT = '${moduleConfig.sources.sapModule.mandt}'
    GROUP BY
      Client_MANDT,
      PurchasingDocumentDate_BEDAT,
      InvoiceDate,
      Company_BUKRS,
      PurchasingOrganization_EKORG,
      PurchasingGroup_EKGRP,
      VendorAccountNumber_LIFNR,
      NAME1,
      CountryKey_LAND1,
      FiscalyearVariant_PERIV,
      MaterialNumber_MATNR,
      Plant_WERKS,
      MaterialType_MTART,
      TargetCurrency_TCURR,
      LanguageKey_SPRAS
  )

SELECT
  VendorPerformance.Client_MANDT,
  VendorPerformance.PurchasingDocumentDate_BEDAT,
  VendorPerformance.YearOfPurchasingDocumentDate_BEDAT,
  VendorPerformance.MonthOfPurchasingDocumentDate_BEDAT,
  VendorPerformance.WeekOfPurchasingDocumentDate_BEDAT,
  VendorPerformance.Company_BUKRS,
  VendorPerformance.Company,
  VendorPerformance.PurchasingOrganization_EKORG,
  VendorPerformance.PurchasingOrganization,
  VendorPerformance.PurchasingGroup_EKGRP,
  VendorPerformance.PurchasingGroup,
  VendorPerformance.VendorAccountNumber_LIFNR,
  VendorPerformance.VendorName,
  VendorPerformance.VendorCountry,
  VendorPerformance.FiscalyearVariant_PERIV,
  VendorPerformance.MaterialNumber_MATNR,
  VendorPerformance.Plant_WERKS,
  VendorPerformance.MaterialType_MTART,
  VendorPerformance.POQuantity_MENGE,
  VendorPerformance.FiscalYear,
  VendorPerformance.FiscalPeriod,
  VendorPerformance.InvoiceDate,
  VendorPerformance.TotalSpend,
  VendorPerformance.ClearedInvoices,
  VendorPerformance.YearOfInvoiceDate,
  VendorPerformance.MonthOfInvoiceDate,
  VendorPerformance.WeekOfInvoiceDate,
  VendorPerformance.AverageNetPrice,
  VendorPerformance.TargetCurrency_TCURR,
  VendorPerformance.AverageNetPriceInTargetCurrency,
  VendorPerformance.TotalSpendInTargetCurrency,
  VendorPerformance.CountRejectedOrders,
  VendorPerformance.CountNotRejectedOrders,
  VendorPerformance.CountNotDelayedOrders,
  VendorPerformance.CountDelayedOrders,
  VendorPerformance.CountInFullOrders,
  VendorPerformance.CountNotInFullOrders,
  VendorPerformance.CountAccurateInvoices,
  VendorPerformance.CountInaccurateInvoices,
  VendorPerformance.CountPastDueOrders,
  VendorPerformance.CountOpenOrders,
  VendorPerformance.Material,
  VendorPerformance.MaterialType,
  VendorPerformance.LanguageKey_SPRAS,
  CASE
    WHEN VendorPerformance.MaterialType_MTART = 'FERT' OR VendorPerformance.MaterialType_MTART = 'HALB'
      THEN COALESCE(MaterialLedger.StandardCost_STPRS, VendorPerformance.AverageNetPrice)
    WHEN VendorPerformance.MaterialType_MTART = 'ROH' OR VendorPerformance.MaterialType_MTART = 'HIBE'
      THEN COALESCE(MaterialLedger.MovingAveragePrice, VendorPerformance.AverageNetPrice)
  END AS ValuationPrice,
  CASE
    WHEN VendorPerformance.MaterialType_MTART = 'FERT' OR VendorPerformance.MaterialType_MTART = 'HALB'
      THEN COALESCE(MaterialLedger.StandardCost_STPRS, VendorPerformance.AverageNetPrice) * VendorPerformance.ExchangeRate_UKURS
    WHEN VendorPerformance.MaterialType_MTART = 'ROH' OR VendorPerformance.MaterialType_MTART = 'HIBE'
      THEN COALESCE(MaterialLedger.MovingAveragePrice, VendorPerformance.AverageNetPrice) * VendorPerformance.ExchangeRate_UKURS
  END AS ValuationPriceInTargetCurrency,
  ABS(
    CASE
      WHEN VendorPerformance.MaterialType_MTART = 'FERT' OR VendorPerformance.MaterialType_MTART = 'HALB'
        THEN COALESCE(MaterialLedger.StandardCost_STPRS, VendorPerformance.AverageNetPrice)
      WHEN VendorPerformance.MaterialType_MTART = 'ROH' OR VendorPerformance.MaterialType_MTART = 'HIBE'
        THEN COALESCE(MaterialLedger.MovingAveragePrice, VendorPerformance.AverageNetPrice)
    END
    - VendorPerformance.AverageNetPrice
  ) * VendorPerformance.POQuantity_MENGE AS PurchasePriceVariance,
  ABS(
    CASE
      WHEN VendorPerformance.MaterialType_MTART = 'FERT' OR VendorPerformance.MaterialType_MTART = 'HALB'
        THEN COALESCE(MaterialLedger.StandardCost_STPRS, VendorPerformance.AverageNetPrice)
      WHEN VendorPerformance.MaterialType_MTART = 'ROH' OR VendorPerformance.MaterialType_MTART = 'HIBE'
        THEN COALESCE(MaterialLedger.MovingAveragePrice, VendorPerformance.AverageNetPrice)
    END
    - VendorPerformance.AverageNetPrice
  ) * VendorPerformance.POQuantity_MENGE * VendorPerformance.ExchangeRate_UKURS AS PurchasePriceVarianceInTargetCurrency
FROM
  VendorPerformance
LEFT JOIN
  MaterialLedger AS MaterialLedger
  ON
    VendorPerformance.Client_MANDT = MaterialLedger.Client_MANDT
    AND VendorPerformance.Plant_WERKS = MaterialLedger.ValuationArea_BWKEY
    AND VendorPerformance.MaterialNumber_MATNR = MaterialLedger.MaterialNumber_MATNR
    AND VendorPerformance.FiscalYear = MaterialLedger.FiscalYear
    AND RIGHT(VendorPerformance.FiscalPeriod, 2) = MaterialLedger.PostingPeriod
    AND MaterialLedger.ValuationType_BWTAR = ''
`
);
