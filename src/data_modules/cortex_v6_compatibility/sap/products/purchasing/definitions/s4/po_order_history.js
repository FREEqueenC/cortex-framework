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
const date = require("includes/date.js");
const currencyHelper = require("includes/cortex_v6_compatibility_currency.js");

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("po_order_history", { ...publishConfig, name: "POOrderHistory" }).query(
  (ctx) => `
WITH calendar_date_dim AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
)
SELECT
  PO.VendorAccountNumber_LIFNR,
  ekbe.MANDT AS Client_MANDT,
  ekbe.EBELN AS PurchasingDocumentNumber_EBELN,
  ekbe.EBELP AS ItemNumberOfPurchasingDocument_EBELP,
  ekbe.ZEKKN AS SequentialNumberOfAccountAssignment_ZEKKN,
  ekbe.VGABE AS TransactioneventType_VGABE,
  ekbe.GJAHR AS MaterialDocumentYear_GJAHR,
  ekbe.BELNR AS NumberOfMaterialDocument_BELNR,
  ekbe.BUZEI AS ItemInMaterialDocument_BUZEI,
  ekbe.BEWTP AS PurchaseOrderHistoryCategory_BEWTP,
  ekbe.BWART AS MovementType__inventoryManagement___BWART,
  ekbe.BUDAT AS PostingDateInTheDocument_BUDAT,
  ekbe.MENGE AS Quantity_MENGE,
  ekbe.BPMNG AS QuantityInPurchaseOrderPriceUnit_BPMNG,
  ekbe.WAERS AS CurrencyKey_WAERS,
  ekbe.WESBS AS GoodsReceiptBlockedStockInOrderUnit_WESBS,
  ekbe.BPWES AS QuantityInGrBlockedStockInOrderPriceUnit_BPWES,
  ekbe.SHKZG AS DebitcreditIndicator_SHKZG,
  ekbe.BWTAR AS ValuationType_BWTAR,
  ekbe.ELIKZ AS deliveryCompleted_ELIKZ,
  ekbe.XBLNR AS ReferenceDocumentNumber_XBLNR,
  ekbe.LFGJA AS FiscalYearOfAReferenceDocument_LFGJA,
  ekbe.LFBNR AS DocumentNoOfAReferenceDocument_LFBNR,
  ekbe.LFPOS AS ItemOfAReferenceDocument_LFPOS,
  ekbe.GRUND AS ReasonForMovement_GRUND,
  ekbe.CPUDT AS DayOnWhichAccountingDocumentWasEntered_CPUDT,
  ekbe.CPUTM AS TimeOfEntry_CPUTM,
  ekbe.EVERE AS ComplianceWithShippingInstructions_EVERE,
  ekbe.REFWR AS InvoiceValueInForeignCurrency_REFWR,
  ekbe.MATNR AS MaterialNumber_MATNR,
  ekbe.WERKS AS Plant_WERKS,
  ekbe.XWSBR AS ReversalOfGrAllowedForGrBasedIvDespiteInvoice_XWSBR,
  ekbe.ETENS AS SequentialNumberOfVendorConfirmation_ETENS,
  ekbe.KNUMV AS NumberOfTheDocumentCondition_KNUMV,
  ekbe.MWSKZ AS TaxOnSalespurchasesCode_MWSKZ,
  ekbe.LSMNG AS QuantityInUnitOfMeasureFromDeliveryNote_LSMNG,
  ekbe.LSMEH AS UnitOfMeasureFromDeliveryNote_LSMEH,
  ekbe.EMATN AS MaterialNumber_EMATN,
  ekbe.HSWAE AS LocalCurrencyKey_HSWAE,
  ekbe.BAMNG AS Quantity_BAMNG,
  ekbe.CHARG AS BatchNumber_CHARG,
  ekbe.BLDAT AS DocumentDateInDocument_BLDAT,
  ekbe.XWOFF AS CalculationOfValOpen_XWOFF,
  ekbe.XUNPL AS UnplannedAccountAssignmentFromInvoiceVerification_XUNPL,
  ekbe.ERNAM AS NameOfPersonWhoCreatedTheObject_ERNAM,
  ekbe.SRVPOS AS ServiceNumber_SRVPOS,
  ekbe.PACKNO AS PackageNumberOfService_PACKNO,
  ekbe.INTROW AS LineNumberOfService_INTROW,
  ekbe.BEKKN AS NumberOfPoAccountAssignment_BEKKN,
  ekbe.LEMIN AS ReturnsIndicator_LEMIN,
  ekbe.AREWB AS ClearingValueOnGrirAccountInPoCurrency_AREWB,
  ekbe.REWRB AS InvoiceAmountInPoCurrency_REWRB,
  ekbe.SAPRL AS SapRelease_SAPRL,
  ekbe.MENGE_POP AS Quantity_MENGE_POP,
  ekbe.BPMNG_POP AS QuantityInPurchaseOrderPriceUnit_BPMNG_POP,
  ekbe.DMBTR_POP AS AmountInLocalCurrency_DMBTR_POP,
  ekbe.WRBTR_POP AS AmountInDocumentCurrency_WRBTR_POP,
  ekbe.WESBB AS ValuatedGoodsReceiptBlockedStockInOrderUnit_WESBB,
  ekbe.BPWEB AS QuantityInValuatedGrBlockedStockInOrderPriceUnit_BPWEB,
  ekbe.WEORA AS AcceptanceAtOrigin_WEORA,
  ekbe.AREWR_POP AS GrirAccountClearingValueInLocalCurrency_AREWR_POP,
  ekbe.KUDIF AS ExchangeRateDifferenceAmount_KUDIF,
  ekbe.RETAMT_FC AS RetentionAmountInDocumentCurrency_RETAMT_FC,
  ekbe.RETAMT_LC AS RetentionAmountInCompanyCodeCurrency_RETAMT_LC,
  ekbe.RETAMTP_FC AS PostedRetentionAmountInDocumentCurrency_RETAMTP_FC,
  ekbe.RETAMTP_LC AS PostedSecurityRetentionAmountInCompanyCodeCurrency_RETAMTP_LC,
  ekbe.XMACC AS MultipleAccountAssignment_XMACC,
  ekbe.WKURS AS ExchangeRate_WKURS,
  ekbe.INV_ITEM_ORIGIN AS OriginOfAnInvoiceItem_INV_ITEM_ORIGIN,
  ekbe.VBELN_ST AS Delivery_VBELN_ST,
  ekbe.VBELP_ST AS DeliveryItem_VBELP_ST,
  ekbe.SGT_SCAT AS StockSegment_SGT_SCAT,
  ekbe.ET_UPD AS ProcedureForUpdatingTheScheduleLineQuantity_ET_UPD,
  ekbe.J_SC_DIE_COMP_F AS DepreciationCompletionFlag_J_SC_DIE_COMP_F,
  ekbe.WRF_CHARSTC1 AS CharacteristicValue1_WRF_CHARSTC1,
  ekbe.WRF_CHARSTC2 AS CharacteristicValue2_WRF_CHARSTC2,
  ekbe.WRF_CHARSTC3 AS CharacteristicValue3_WRF_CHARSTC3,
  CalendarDateDimension_BUDAT.cal_year AS YearOfPostingDateInTheDocument_BUDAT,
  CalendarDateDimension_BUDAT.cal_month AS MonthOfPostingDateInTheDocument_BUDAT,
  CalendarDateDimension_BUDAT.cal_week AS WeekOfPostingDateInTheDocument_BUDAT,
  CalendarDateDimension_BUDAT.cal_quarter AS QuarterOfPostingDateInTheDocument_BUDAT,
  CalendarDateDimension_BLDAT.cal_year AS YearOfDocumentDateInDocument_BLDAT,
  CalendarDateDimension_BLDAT.cal_month AS MonthOfDocumentDateInDocument_BLDAT,
  CalendarDateDimension_BLDAT.cal_week AS WeekOfDocumentDateInDocument_BLDAT,
  CalendarDateDimension_BLDAT.cal_quarter AS QuarterOfDocumentDateInDocument_BLDAT,
  COALESCE(ekbe.DMBTR * currency_decimal.CURRFIX, ekbe.DMBTR) AS AmountInLocalCurrency_DMBTR,
  COALESCE(ekbe.WRBTR * currency_decimal.CURRFIX, ekbe.WRBTR) AS AmountInDocumentCurrency_WRBTR,
  COALESCE(ekbe.AREWR * currency_decimal.CURRFIX, ekbe.AREWR) AS GrirAccountClearingValueInLocalCurrency_AREWR,
  COALESCE(ekbe.REEWR * currency_decimal.CURRFIX, ekbe.REEWR) AS InvoiceValueEntered__inLocalCurrency___REEWR,
  COALESCE(ekbe.AREWW * currency_decimal.CURRFIX, ekbe.AREWW) AS ClearingValueOnGrirClearingAccount__transacCurrency___AREWW
FROM
  ${ctx.ref('PurchaseDocuments')} AS PO
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ekbe')} AS ekbe
  ON PO.Client_MANDT = ekbe.MANDT
    AND PO.DocumentNumber_EBELN = ekbe.EBELN
    AND PO.Item_EBELP = ekbe.EBELP
LEFT JOIN currency_decimal AS currency_decimal
  ON PO.CurrencyKey_WAERS = currency_decimal.CURRKEY
LEFT JOIN calendar_date_dim AS CalendarDateDimension_BUDAT
  ON CalendarDateDimension_BUDAT.Date = ekbe.BUDAT
LEFT JOIN calendar_date_dim AS CalendarDateDimension_BLDAT
  ON CalendarDateDimension_BLDAT.Date = ekbe.BLDAT
WHERE ekbe.VGABE IN ('1', '2')
`
);
