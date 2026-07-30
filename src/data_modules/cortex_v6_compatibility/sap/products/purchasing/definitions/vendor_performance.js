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
const targetCurrencies = moduleConfig.moduleSettings?.targetCurrencies || ['USD'];
const rateType = moduleConfig.moduleSettings?.rateType || 'M';
const languages = moduleConfig.moduleSettings?.languages || ['E', 'S'];

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("vendor_performance", { ...publishConfig, name: "VendorPerformance" }).query(
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

  Vendors AS (
    ${master_data.getVendorsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  Companies AS (
    ${master_data.getCompaniesMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  PurchaseOrderScheduleLine AS (
    SELECT
      PurchaseOrders.Client_MANDT,
      PurchaseOrders.DocumentNumber_EBELN,
      PurchaseOrders.Item_EBELP,
      PurchaseOrders.DeliveryCompletedFlag_ELIKZ,
      PurchaseOrders.PurchasingDocumentDate_BEDAT,
      PurchaseOrders.NetOrderValueinPOCurrency_NETWR,
      PurchaseOrders.CurrencyKey_WAERS,
      PurchaseOrders.POQuantity_MENGE,
      PurchaseOrders.UoM_MEINS,
      PurchaseOrders.NetPrice_NETPR,
      PurchaseOrders.CreatedOn_AEDAT,
      PurchaseOrders.Status_STATU,
      PurchaseOrders.MaterialNumber_MATNR,
      PurchaseOrders.MaterialType_MTART,
      PurchaseOrders.MaterialGroup_MATKL,
      PurchaseOrders.PurchasingOrganization_EKORG,
      PurchaseOrders.PurchasingGroup_EKGRP,
      PurchaseOrders.VendorAccountNumber_LIFNR,
      PurchaseOrders.Company_BUKRS,
      PurchaseOrders.Plant_WERKS,
      PurchaseOrders.UnderdeliveryToleranceLimit_UNTTO,
      PurchaseOrders.OverdeliveryToleranceLimit_UEBTO,
      POScheduleLine.ItemDeliveryDate_EINDT,
      POScheduleLine.OrderDateOfScheduleLine_BEDAT,
      PurchaseOrders.YearOfPurchasingDocumentDate_BEDAT,
      PurchaseOrders.MonthOfPurchasingDocumentDate_BEDAT,
      PurchaseOrders.WeekOfPurchasingDocumentDate_BEDAT,
      PurchaseOrders.Language_SPRAS,
      COALESCE(
        (PurchaseOrders.UnderdeliveryToleranceLimit_UNTTO * PurchaseOrders.POQuantity_MENGE) / 100,
        0
      ) AS UnderdeliveryToleranceLimit,
      COALESCE(
        (PurchaseOrders.OverdeliveryToleranceLimit_UEBTO * PurchaseOrders.POQuantity_MENGE) / 100,
        0
      ) AS OverdeliveryToleranceLimit
    FROM
      ${ctx.ref('PurchaseDocuments')} AS PurchaseOrders
    LEFT JOIN
      (
        SELECT
          Client_MANDT, PurchasingDocumentNumber_EBELN, ItemNumberOfPurchasingDocument_EBELP,
          MAX(ItemDeliveryDate_EINDT) AS ItemDeliveryDate_EINDT,
          MAX(OrderDateOfScheduleLine_BEDAT) AS OrderDateOfScheduleLine_BEDAT
        FROM ${ctx.ref('POSchedule')}
        GROUP BY Client_MANDT, PurchasingDocumentNumber_EBELN, ItemNumberOfPurchasingDocument_EBELP
      ) AS POScheduleLine
      ON
        PurchaseOrders.Client_MANDT = POScheduleLine.Client_MANDT
        AND PurchaseOrders.DocumentNumber_EBELN = POScheduleLine.PurchasingDocumentNumber_EBELN
        AND PurchaseOrders.Item_EBELP = POScheduleLine.ItemNumberOfPurchasingDocument_EBELP
    WHERE PurchaseOrders.DocumentType_BSART IN ('NB', 'ENB')
      AND PurchaseOrders.ItemCategoryinPurchasingDocument_PSTYP != '2'
  ),

  PurchaseOrdersGoodsReceipt AS (
    SELECT
      PurchaseOrderScheduleLine.Client_MANDT,
      PurchaseOrderScheduleLine.DocumentNumber_EBELN,
      PurchaseOrderScheduleLine.Item_EBELP,
      PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ,
      PurchaseOrderScheduleLine.PurchasingDocumentDate_BEDAT,
      PurchaseOrderScheduleLine.NetOrderValueinPOCurrency_NETWR,
      PurchaseOrderScheduleLine.CurrencyKey_WAERS,
      PurchaseOrderScheduleLine.ItemDeliveryDate_EINDT,
      PurchaseOrderScheduleLine.OrderDateOfScheduleLine_BEDAT,
      PurchaseOrderScheduleLine.POQuantity_MENGE,
      PurchaseOrderScheduleLine.UoM_MEINS,
      PurchaseOrderScheduleLine.NetPrice_NETPR,
      PurchaseOrderScheduleLine.CreatedOn_AEDAT,
      PurchaseOrderScheduleLine.Status_STATU,
      PurchaseOrderScheduleLine.MaterialNumber_MATNR,
      PurchaseOrderScheduleLine.MaterialType_MTART,
      PurchaseOrderScheduleLine.MaterialGroup_MATKL,
      PurchaseOrderScheduleLine.PurchasingOrganization_EKORG,
      PurchaseOrderScheduleLine.PurchasingGroup_EKGRP,
      PurchaseOrderScheduleLine.Company_BUKRS,
      PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit_UNTTO,
      PurchaseOrderScheduleLine.OverdeliveryToleranceLimit_UEBTO,
      PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit,
      PurchaseOrderScheduleLine.OverdeliveryToleranceLimit,
      PurchaseOrderScheduleLine.VendorAccountNumber_LIFNR,
      PurchaseOrderScheduleLine.Plant_WERKS,
      PurchaseOrderScheduleLine.YearOfPurchasingDocumentDate_BEDAT,
      PurchaseOrderScheduleLine.MonthOfPurchasingDocumentDate_BEDAT,
      PurchaseOrderScheduleLine.WeekOfPurchasingDocumentDate_BEDAT,
      PurchaseOrderScheduleLine.Language_SPRAS,
      POOrderHistory.AmountInLocalCurrency_DMBTR,
      POOrderHistory.CurrencyKey_WAERS AS POOrderHistoryCurrencyKey_WAERS,
      IF(
        POOrderHistory.MovementType__inventoryManagement___BWART = '101',
        POOrderHistory.PostingDateInTheDocument_BUDAT,
        NULL
      ) AS PostingDateInTheDocument_BUDAT,

      IF(
        PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ IS NULL,
        FALSE,
        TRUE
      ) AS IsDelivered,

      IF(
        PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ = 'X',
        COALESCE(
          DATE_DIFF(
            IF(
              POOrderHistory.MovementType__inventoryManagement___BWART = '101',
              MAX(POOrderHistory.PostingDateInTheDocument_BUDAT) OVER (
                PARTITION BY
                  PurchaseOrderScheduleLine.Client_MANDT,
                  PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                  PurchaseOrderScheduleLine.Item_EBELP
              ),
              NULL
            ),
            PurchaseOrderScheduleLine.PurchasingDocumentDate_BEDAT,
            DAY
          ),
          0
        ),
        NULL
      ) AS VendorCycleTimeInDays,

      IF(
        POOrderHistory.MovementType__inventoryManagement___BWART IN ('122', '161'),
        TRUE,
        FALSE
      ) AS IsRejected,
      IF(
        POOrderHistory.MovementType__inventoryManagement___BWART IN ('122', '161'),
        POOrderHistory.Quantity_MENGE,
        0
      ) AS RejectedQuantity,

      IF(
        PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ = 'X',
        IF(
          IF(
            POOrderHistory.MovementType__inventoryManagement___BWART = '101',
            POOrderHistory.PostingDateInTheDocument_BUDAT,
            NULL
          ) <= PurchaseOrderScheduleLine.ItemDeliveryDate_EINDT,
          TRUE,
          FALSE
        ),
        NULL
      ) AS IsDeliveredOnTime,

      IF(
        PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ = 'X',
        IF(
          PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit_UNTTO IS NULL AND PurchaseOrderScheduleLine.OverdeliveryToleranceLimit_UEBTO IS NULL,
          IF(
            SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              )) OVER (
              PARTITION BY
                PurchaseOrderScheduleLine.Client_MANDT,
                PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                PurchaseOrderScheduleLine.Item_EBELP
            ) >= PurchaseOrderScheduleLine.POQuantity_MENGE,
            TRUE,
            FALSE
          ),
          IF(
            SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              )) OVER (
              PARTITION BY
                PurchaseOrderScheduleLine.Client_MANDT,
                PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                PurchaseOrderScheduleLine.Item_EBELP
            ) >= PurchaseOrderScheduleLine.POQuantity_MENGE - PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit,
            TRUE,
            FALSE
          )
          OR IF(
            SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              )) OVER (
              PARTITION BY
                PurchaseOrderScheduleLine.Client_MANDT,
                PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                PurchaseOrderScheduleLine.Item_EBELP
            ) <= PurchaseOrderScheduleLine.POQuantity_MENGE + PurchaseOrderScheduleLine.OverdeliveryToleranceLimit,
            TRUE,
            FALSE
          )
        ),
        NULL
      ) AS IsDeliveredInFull,

      IF(
        PurchaseOrderScheduleLine.DeliveryCompletedFlag_ELIKZ = 'X',
        IF(
          PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit_UNTTO IS NULL AND PurchaseOrderScheduleLine.OverdeliveryToleranceLimit_UEBTO IS NULL,
          IF(
            PurchaseOrderScheduleLine.POQuantity_MENGE = SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              )) OVER (
              PARTITION BY
                PurchaseOrderScheduleLine.Client_MANDT,
                PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                PurchaseOrderScheduleLine.Item_EBELP
            ),
            TRUE,
            FALSE
          ),
          IF(
            SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              ))
              OVER (
                PARTITION BY
                  PurchaseOrderScheduleLine.Client_MANDT,
                  PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                  PurchaseOrderScheduleLine.Item_EBELP
              )
            BETWEEN PurchaseOrderScheduleLine.POQuantity_MENGE - PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit
            AND PurchaseOrderScheduleLine.POQuantity_MENGE + PurchaseOrderScheduleLine.OverdeliveryToleranceLimit,
            TRUE,
            FALSE
          )
          OR IF(
            SUM(
              IF(
                POOrderHistory.MovementType__inventoryManagement___BWART = '101',
                POOrderHistory.Quantity_MENGE,
                (POOrderHistory.Quantity_MENGE * -1)
              ))
              OVER (
                PARTITION BY
                  PurchaseOrderScheduleLine.Client_MANDT,
                  PurchaseOrderScheduleLine.DocumentNumber_EBELN,
                  PurchaseOrderScheduleLine.Item_EBELP
              )
            BETWEEN PurchaseOrderScheduleLine.POQuantity_MENGE - PurchaseOrderScheduleLine.UnderdeliveryToleranceLimit
            AND PurchaseOrderScheduleLine.POQuantity_MENGE + PurchaseOrderScheduleLine.OverdeliveryToleranceLimit,
            TRUE,
            FALSE
          )
        ),
        NULL
      ) AS IsGoodsReceiptAccurate,

      IF(
        POOrderHistory.MovementType__inventoryManagement___BWART = '101',
        POOrderHistory.AmountInLocalCurrency_DMBTR,
        (POOrderHistory.AmountInLocalCurrency_DMBTR * -1)
      ) AS GoodsReceiptAmountInSourceCurrency,

      IF(
        POOrderHistory.MovementType__inventoryManagement___BWART = '101',
        POOrderHistory.Quantity_MENGE,
        (POOrderHistory.Quantity_MENGE * -1)
      ) AS GoodsReceiptQuantity
    FROM
      PurchaseOrderScheduleLine
    LEFT JOIN
      (
        SELECT
          Client_MANDT,
          PurchasingDocumentNumber_EBELN,
          ItemNumberOfPurchasingDocument_EBELP,
          MovementType__inventoryManagement___BWART,
          AmountInLocalCurrency_DMBTR,
          CurrencyKey_WAERS,
          PostingDateInTheDocument_BUDAT,
          Quantity_MENGE
        FROM ${ctx.ref('PurchaseDocumentsHistory')}
        WHERE TransactioneventType_VGABE = '1'
          AND MovementType__inventoryManagement___BWART IN ('101', '102', '161', '122')
      ) AS POOrderHistory
      ON
        PurchaseOrderScheduleLine.Client_MANDT = POOrderHistory.Client_MANDT
        AND PurchaseOrderScheduleLine.DocumentNumber_EBELN = POOrderHistory.PurchasingDocumentNumber_EBELN
        AND PurchaseOrderScheduleLine.Item_EBELP = POOrderHistory.ItemNumberOfPurchasingDocument_EBELP
  ),

  PurchaseDocuments AS (
    SELECT
      PurchaseOrdersGoodsReceipt.Client_MANDT,
      PurchaseOrdersGoodsReceipt.DocumentNumber_EBELN,
      PurchaseOrdersGoodsReceipt.Item_EBELP,
      PurchaseOrdersGoodsReceipt.Language_SPRAS,
      MAX(PurchaseOrdersGoodsReceipt.PurchasingDocumentDate_BEDAT) AS PurchasingDocumentDate_BEDAT,
      AVG(PurchaseOrdersGoodsReceipt.NetOrderValueinPOCurrency_NETWR) AS NetOrderValueinPOCurrency_NETWR,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.CurrencyKey_WAERS) AS CurrencyKey_WAERS,
      MAX(PurchaseOrdersGoodsReceipt.ItemDeliveryDate_EINDT) AS ItemDeliveryDate_EINDT,
      MAX(PurchaseOrdersGoodsReceipt.OrderDateOfScheduleLine_BEDAT) AS OrderDateOfScheduleLine_BEDAT,
      MAX(PurchaseOrdersGoodsReceipt.PostingDateInTheDocument_BUDAT) AS PostingDateInTheDocument_BUDAT,
      SUM(PurchaseOrdersGoodsReceipt.AmountInLocalCurrency_DMBTR) AS AmountInLocalCurrency_DMBTR,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.POOrderHistoryCurrencyKey_WAERS) AS POOrderHistoryCurrencyKey_WAERS,
      AVG(PurchaseOrdersGoodsReceipt.POQuantity_MENGE) AS POQuantity_MENGE,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.UoM_MEINS) AS UoM_MEINS,
      AVG(PurchaseOrdersGoodsReceipt.NetPrice_NETPR) AS NetPrice_NETPR,
      MAX(PurchaseOrdersGoodsReceipt.CreatedOn_AEDAT) AS CreatedOn_AEDAT,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.Status_STATU) AS Status_STATU,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.MaterialNumber_MATNR) AS MaterialNumber_MATNR,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.MaterialType_MTART) AS MaterialType_MTART,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.MaterialGroup_MATKL) AS MaterialGroup_MATKL,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.PurchasingOrganization_EKORG) AS PurchasingOrganization_EKORG,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.PurchasingGroup_EKGRP) AS PurchasingGroup_EKGRP,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.VendorAccountNumber_LIFNR) AS VendorAccountNumber_LIFNR,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.Company_BUKRS) AS Company_BUKRS,
      ANY_VALUE(PurchaseOrdersGoodsReceipt.Plant_WERKS) AS Plant_WERKS,
      LOGICAL_AND(PurchaseOrdersGoodsReceipt.IsDelivered) AS IsDelivered,
      MAX(PurchaseOrdersGoodsReceipt.VendorCycleTimeInDays) AS VendorCycleTimeInDays,
      LOGICAL_OR(PurchaseOrdersGoodsReceipt.IsRejected) AS IsRejected,
      SUM(PurchaseOrdersGoodsReceipt.RejectedQuantity) AS RejectedQuantity,
      LOGICAL_AND(PurchaseOrdersGoodsReceipt.IsDeliveredOnTime) AS IsDeliveredOnTime,
      LOGICAL_AND(PurchaseOrdersGoodsReceipt.IsDeliveredInFull) AS IsDeliveredInFull,
      LOGICAL_AND(PurchaseOrdersGoodsReceipt.IsGoodsReceiptAccurate) AS IsGoodsReceiptAccurate,
      SUM(PurchaseOrdersGoodsReceipt.GoodsReceiptQuantity) AS GoodsReceiptQuantity,
      SUM(PurchaseOrdersGoodsReceipt.GoodsReceiptAmountInSourceCurrency) AS GoodsReceiptAmountInSourceCurrency,
      MAX(PurchaseOrdersGoodsReceipt.YearOfPurchasingDocumentDate_BEDAT) AS YearOfPurchasingDocumentDate_BEDAT,
      MAX(PurchaseOrdersGoodsReceipt.MonthOfPurchasingDocumentDate_BEDAT) AS MonthOfPurchasingDocumentDate_BEDAT,
      MAX(PurchaseOrdersGoodsReceipt.WeekOfPurchasingDocumentDate_BEDAT) AS WeekOfPurchasingDocumentDate_BEDAT
    FROM PurchaseOrdersGoodsReceipt
    GROUP BY
      PurchaseOrdersGoodsReceipt.Client_MANDT,
      PurchaseOrdersGoodsReceipt.DocumentNumber_EBELN,
      PurchaseOrdersGoodsReceipt.Item_EBELP,
      PurchaseOrdersGoodsReceipt.Language_SPRAS
  )

SELECT
  PurchaseDocuments.Client_MANDT,
  PurchaseDocuments.DocumentNumber_EBELN,
  PurchaseDocuments.Item_EBELP,
  PurchaseDocuments.PurchasingDocumentDate_BEDAT,
  PurchaseDocuments.NetOrderValueinPOCurrency_NETWR,
  PurchaseDocuments.CurrencyKey_WAERS,
  PurchaseDocuments.ItemDeliveryDate_EINDT,
  PurchaseDocuments.OrderDateOfScheduleLine_BEDAT,
  PurchaseDocuments.PostingDateInTheDocument_BUDAT,
  PurchaseDocuments.AmountInLocalCurrency_DMBTR,
  PurchaseDocuments.POOrderHistoryCurrencyKey_WAERS,
  PurchaseDocuments.POQuantity_MENGE,
  PurchaseDocuments.UoM_MEINS,
  PurchaseDocuments.NetPrice_NETPR,
  PurchaseDocuments.CreatedOn_AEDAT,
  PurchaseDocuments.Status_STATU,
  PurchaseDocuments.MaterialNumber_MATNR,
  PurchaseDocuments.MaterialType_MTART,
  PurchaseDocuments.MaterialGroup_MATKL,
  PurchaseDocuments.PurchasingOrganization_EKORG,
  PurchaseDocuments.PurchasingGroup_EKGRP,
  PurchaseDocuments.VendorAccountNumber_LIFNR,
  PurchaseDocuments.Company_BUKRS,
  PurchaseDocuments.Plant_WERKS AS Plant_WERKS,
  PurchaseDocuments.YearOfPurchasingDocumentDate_BEDAT,
  PurchaseDocuments.MonthOfPurchasingDocumentDate_BEDAT,
  PurchaseDocuments.WeekOfPurchasingDocumentDate_BEDAT,
  FiscalDateDimension_BEDAT.FiscalYear,
  FiscalDateDimension_BEDAT.FiscalPeriod,
  PurchaseOrdersInvoiceReceipt.InvoiceQuantity,
  PurchaseOrdersInvoiceReceipt.InvoiceAmountInSourceCurrency,
  PurchaseOrdersInvoiceReceipt.InvoiceDate,
  PurchaseOrdersInvoiceReceipt.YearOfInvoiceDate,
  PurchaseOrdersInvoiceReceipt.MonthOfInvoiceDate,
  PurchaseOrdersInvoiceReceipt.WeekOfInvoiceDate,
  PurchaseOrdersInvoiceReceipt.InvoiceCount,
  PurchasingOrganizations.PurchasingOrganizationText_EKOTX,
  PurchasingGroups.PurchasingGroupText_EKNAM,
  Vendors.CountryKey_LAND1,
  Vendors.NAME1,
  Companies.CompanyText_BUTXT,
  Companies.FiscalyearVariant_PERIV,
  LanguageKey.LanguageKey_SPRAS,
  Materials.MaterialText_MAKTX,
  MaterialTypes.DescriptionOfMaterialType_MTBEZ,
  PurchaseDocuments.VendorCycleTimeInDays,
  PurchaseDocuments.RejectedQuantity,
  PurchaseDocuments.GoodsReceiptQuantity,
  PurchaseDocuments.GoodsReceiptAmountInSourceCurrency,
  CurrencyConversion.ExchangeRate_UKURS,
  CurrencyConversion.ToCurrency_TCURR AS TargetCurrency_TCURR,
  PurchaseDocuments.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS AS AmountInTargetCurrency_DMBTR,
  PurchaseDocuments.NetPrice_NETPR * CurrencyConversion.ExchangeRate_UKURS AS NetPriceInTargetCurrency_NETPR,
  PurchaseDocuments.NetOrderValueinPOCurrency_NETWR * CurrencyConversion.ExchangeRate_UKURS AS NetOrderValueinTargetCurrency_NETWR,
  PurchaseDocuments.GoodsReceiptAmountInSourceCurrency * CurrencyConversion.ExchangeRate_UKURS AS GoodsReceiptAmountInTargetCurrency,
  PurchaseOrdersInvoiceReceipt.InvoiceAmountInSourceCurrency * CurrencyConversion.ExchangeRate_UKURS AS InvoiceAmountInTargetCurrency,
  IF(
    PurchaseDocuments.IsDelivered, TRUE, FALSE
  ) AS IsDelivered,
  IF(
    PurchaseDocuments.IsRejected, TRUE, FALSE
  ) AS IsRejected,
  IF(
    PurchaseDocuments.IsDeliveredOnTime IS NULL,
    'NotApplicable',
    IF(
      PurchaseDocuments.IsDeliveredOnTime,
      'NotDelayed',
      'Delayed'
    )
  ) AS VendorOnTimeDelivery,
  IF(
    PurchaseDocuments.IsDeliveredInFull IS NULL,
    'NotApplicable',
    IF(
      PurchaseDocuments.IsDeliveredInFull,
      'DeliveredInFull',
      'NotDeliveredInFull'
    )
  ) AS VendorInFullDelivery,
  IF(
    PurchaseDocuments.IsDeliveredInFull IS NULL OR PurchaseDocuments.IsDeliveredOnTime IS NULL,
    'NotApplicable',
    IF(
      PurchaseDocuments.IsDeliveredInFull AND PurchaseDocuments.IsDeliveredOnTime,
      'OTIF',
      'NotOTIF'
    )
  ) AS VendorOnTimeInFullDelivery,
  IF(
    PurchaseDocuments.IsGoodsReceiptAccurate IS NULL OR PurchaseOrdersInvoiceReceipt.InvoiceQuantity IS NULL,
    'NotApplicable',
    IF(
      PurchaseDocuments.IsGoodsReceiptAccurate
      AND PurchaseDocuments.POQuantity_MENGE = PurchaseOrdersInvoiceReceipt.InvoiceQuantity,
      'AccurateInvoice',
      'InaccurateInvoice'
    )
  ) AS VendorInvoiceAccuracy,
  IF(
    PurchaseDocuments.IsDelivered,
    'NotApplicable',
    IF(
      CURRENT_DATE() > PurchaseDocuments.ItemDeliveryDate_EINDT,
      'PastDue',
      'Open'
    )
  ) AS PastDueOrOpenItems
FROM PurchaseDocuments
LEFT JOIN
  (
    SELECT
      Client_MANDT,
      PurchasingDocumentNumber_EBELN,
      ItemNumberOfPurchasingDocument_EBELP,
      SUM(Quantity_MENGE) AS InvoiceQuantity,
      SUM(AmountInLocalCurrency_DMBTR) AS InvoiceAmountInSourceCurrency,
      MAX(PostingDateInTheDocument_BUDAT) AS InvoiceDate,
      MAX(YearOfPostingDateInTheDocument_BUDAT) AS YearOfInvoiceDate,
      MAX(MonthOfPostingDateInTheDocument_BUDAT) AS MonthOfInvoiceDate,
      MAX(WeekOfPostingDateInTheDocument_BUDAT) AS WeekOfInvoiceDate,
      COUNT(PurchasingDocumentNumber_EBELN) AS InvoiceCount
    FROM
      ${ctx.ref('PurchaseDocumentsHistory')}
    GROUP BY Client_MANDT, PurchasingDocumentNumber_EBELN, ItemNumberOfPurchasingDocument_EBELP
  ) AS PurchaseOrdersInvoiceReceipt
  ON
    PurchaseDocuments.Client_MANDT = PurchaseOrdersInvoiceReceipt.Client_MANDT
    AND PurchaseDocuments.DocumentNumber_EBELN = PurchaseOrdersInvoiceReceipt.PurchasingDocumentNumber_EBELN
    AND PurchaseDocuments.Item_EBELP = PurchaseOrdersInvoiceReceipt.ItemNumberOfPurchasingDocument_EBELP
LEFT JOIN CurrencyConversion
  ON
    PurchaseDocuments.Client_MANDT = CurrencyConversion.Client_MANDT
    AND PurchaseDocuments.CurrencyKey_WAERS = CurrencyConversion.FromCurrency_FCURR
    AND PurchaseDocuments.PurchasingDocumentDate_BEDAT = CurrencyConversion.ConvDate
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'PurchasingOrganizationsMD')} AS PurchasingOrganizations
  ON
    PurchaseDocuments.Client_MANDT = PurchasingOrganizations.Client_MANDT
    AND PurchaseDocuments.PurchasingOrganization_EKORG = PurchasingOrganizations.PurchasingOrganization_EKORG
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'PurchasingGroupsMD')} AS PurchasingGroups
  ON
    PurchaseDocuments.Client_MANDT = PurchasingGroups.Client_MANDT
    AND PurchaseDocuments.PurchasingGroup_EKGRP = PurchasingGroups.PurchasingGroup_EKGRP
LEFT JOIN Vendors
  ON
    PurchaseDocuments.Client_MANDT = Vendors.Client_MANDT
    AND PurchaseDocuments.VendorAccountNumber_LIFNR = Vendors.AccountNumberOfVendorOrCreditor_LIFNR
    AND PurchaseDocuments.Language_SPRAS = Vendors.Language_LANGU
LEFT JOIN
  Companies
  ON
    PurchaseDocuments.Client_MANDT = Companies.Client_MANDT
    AND PurchaseDocuments.Company_BUKRS = Companies.CompanyCode_BUKRS
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_BEDAT
  ON
    PurchaseDocuments.Client_MANDT = FiscalDateDimension_BEDAT.mandt
    AND Companies.FiscalyearVariant_PERIV = FiscalDateDimension_BEDAT.periv
    AND PurchaseDocuments.PurchasingDocumentDate_BEDAT = FiscalDateDimension_BEDAT.Date
CROSS JOIN LanguageKey
LEFT JOIN
  Materials
  ON
    PurchaseDocuments.Client_MANDT = PurchaseDocuments.Client_MANDT
    AND PurchaseDocuments.MaterialNumber_MATNR = Materials.MaterialNumber_MATNR
    AND Materials.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  MaterialTypes
  ON
    PurchaseDocuments.Client_MANDT = MaterialTypes.Client_MANDT
    AND PurchaseDocuments.MaterialType_MTART = MaterialTypes.MaterialType_MTART
    AND MaterialTypes.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
`
);
