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
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("po_vendor_confirmation", { ...publishConfig, name: "POVendorConfirmation" }).query(
  (ctx) => `
WITH Vendors_Inline AS (
  SELECT
    mandt AS Client_MANDT,
    lifnr AS AccountNumberOfVendorOrCreditor_LIFNR,
    name1 AS NAME1,
    name2 AS NAME2,
    spras AS Language_LANGU,
    CAST('1900-01-01' AS DATE) AS ValidFromDate_DATE_FROM,
    CAST('9999-12-31' AS DATE) AS ValidToDate_DATE_TO,
    CAST(NULL AS STRING) AS VersionIdForInternationalAddresses_NATION
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'lfa1')}
)
SELECT
  EKES.MANDT AS Client_MANDT,
  EKES.EBELN AS PurchasingDocumentNumber_EBELN,
  EKES.EBELP AS ItemNumberOfPurchasingDocument_EBELP,
  EKES.ETENS AS SequentialNumberOfVendorConfirmation_ETENS,
  EKES.EBTYP AS ConfirmationCategory_EBTYP,
  EKES.EINDT AS DeliveryDateOfVendorConfirmation_EINDT,
  EKES.LPEIN AS DateCategoryOfDeliveryDateInVendorConfirmation_LPEIN,
  EKES.UZEIT AS DeliveryDateTimeSpotInVendorConfirmation_UZEIT,
  EKES.ERDAT AS CreationDateOfConfirmation_ERDAT,
  EKES.EZEIT AS TimeAtWhichVendorConfirmationWasCreated_EZEIT,
  EKES.MENGE AS QuantityAsPerVendorConfirmation_MENGE,
  EKES.DABMG AS QuantityReduced__mrp___DABMG,
  EKES.ESTKZ AS CreationIndicator_VendorConfirmation_ESTKZ,
  EKES.LOEKZ AS VendorConfirmationDeletionIndicator_LOEKZ,
  EKES.KZDIS AS Indicator_ConfirmationIsRelevantToMaterialsPlanning_KZDIS,
  EKES.XBLNR AS ReferenceDocumentNumber__forDependenciesSeeLongText___XBLNR,
  EKES.VBELN AS Delivery_VBELN,
  EKES.VBELP AS DeliveryItem_VBELP,
  EKES.MPROF AS MfrPartProfile_MPROF,
  EKES.EMATN AS MaterialNumberCorrespondingToManufacturerPartNumber_EMATN,
  EKES.MAHNZ AS NumberOfRemindersexpediters_MAHNZ,
  EKES.CHARG AS BatchNumber_CHARG,
  EKES.UECHA AS HigherLevelItemOfBatchSplitItem_UECHA,
  EKES.REF_ETENS AS SequentialNumberOfVendorConfirmation_REF_ETENS,
  EKES.IMWRK AS DeliveryHasStatusinPlant_IMWRK,
  EKES.VBELN_ST AS Delivery_VBELN_ST,
  EKES.VBELP_ST AS DeliveryItem_VBELP_ST,
  EKES.HANDOVERDATE AS HandoverDateAtTheHandoverLocation_HANDOVERDATE,
  EKES.HANDOVERTIME AS HandoverTimeAtTheHandoverLocation_HANDOVERTIME,
  EKES.SGT_SCAT AS StockSegment_SGT_SCAT,
  EKES.FSH_SALLOC_QTY AS AllocatedStockQuantity_FSH_SALLOC_QTY,
  vendor.AccountNumberOfVendorOrCreditor_LIFNR,
  vendor.NAME1,
  vendor.NAME2,
  docs.TermsPaymentKey_ZTERM,
  docs.DiscountDays1_ZBD1T
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ekes')} AS EKES
INNER JOIN ${ctx.ref('PurchaseDocuments')} AS docs
  ON EKES.MANDT = docs.Client_MANDT
    AND EKES.EBELN = docs.DocumentNumber_EBELN
    AND docs.Item_EBELP = EKES.EBELP
INNER JOIN Vendors_Inline AS vendor
  ON vendor.Client_MANDT = docs.Client_MANDT
    AND vendor.AccountNumberOfVendorOrCreditor_LIFNR = docs.VendorAccountNumber_LIFNR
    AND vendor.Language_LANGU = docs.Language_SPRAS
    AND vendor.ValidFromDate_DATE_FROM <= EKES.ERDAT
    AND vendor.ValidToDate_DATE_TO >= EKES.ERDAT
    AND COALESCE(vendor.VersionIdForInternationalAddresses_NATION, '') = ''
`
);
