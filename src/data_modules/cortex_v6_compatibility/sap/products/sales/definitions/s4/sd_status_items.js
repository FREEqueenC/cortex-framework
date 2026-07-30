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

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("sd_status_items", { ...publishConfig, name: "SDStatus_Items" }).query(
  (ctx) => `
SELECT
  VBAP.MANDT AS Client_MANDT,
  VBAP.VBELN AS SDDocumentNumber_VBELN,
  VBAP.POSNR AS ItemNumberOfTheSdDocument_POSNR,
  VBAP.RFSTA AS ReferenceStatus_RFSTA,
  VBAP.RFGSA AS OverallStatusOfReference_RFGSA,
  VBAP.BESTA AS ConfirmationStatusOfDocumentItem_BESTA,
  VBAP.LFSTA AS DeliveryStatus_LFSTA,
  VBAP.LFGSA AS OverallDeliveryStatusOfTheItem_LFGSA,
  VBAP.WBSTA AS GoodsMovementStatus_WBSTA,
  LIPS.FKSTA AS BillingStatusOfDelivery_FKSTA,
  VBAP.FKSAA AS BillingStatusForOrder_FKSAA,
  VBAP.ABSTA AS RejectionStatusForSdItem_ABSTA,
  VBAP.GBSTA AS OverallProcessingStatusOfTheSdDocumentItem_GBSTA,
  LIPS.KOSTA AS PickingStatusputawayStatus_KOSTA,
  LIPS.LVSTA AS StatusOfWarehouseManagementActivities_LVSTA,
  VBAP.UVALL AS GeneralIncompletionStatusOfItem_UVALL,
  VBAP.UVVLK AS IncompletionStatusOfTheItemWithRegardToDelivery_UVVLK,
  VBAP.UVFAK AS ItemIncompletionStatusWithRespectToBilling_UVFAK,
  VBAP.UVPRS AS PricingForItemIsIncomplete_UVPRS,
  LIPS.FKIVP AS IntercompanyBillingStatus_FKIVP,
  VBAP.UVP01 AS CustomerReserves1_ItemStatus_UVP01,
  VBAP.UVP02 AS CustomerReserves2_ItemStatus_UVP02,
  VBAP.UVP03 AS ItemReserves3_ItemStatus_UVP03,
  VBAP.UVP04 AS ItemReserves4_ItemStatus_UVP04,
  VBAP.UVP05 AS CustomerReserves5_ItemStatus_UVP05,
  LIPS.PKSTA AS PackingStatusOfItem_PKSTA,
  LIPS.KOQUA AS ConfirmationStatusOfPickingputaway_KOQUA,
  VBAP.CMPPI AS StatusOfCreditCheckAgainstFinancialDocument_CMPPI,
  VBAP.CMPPJ AS StatusOfCreditCheckAgainstExportCreditInsurance_CMPPJ,
  LIPS.UVPIK AS IncompleteStatusOfItemForPickingputaway_UVPIK,
  LIPS.UVPAK AS IncompleteStatusOfItemForPackaging_UVPAK,
  LIPS.UVWAK AS IncompleteStatusOfItemRegardingGoodsIssue_UVWAK,
  VBAP.DCSTA AS DelayStatus_DCSTA,
  CAST(NULL AS STRING) AS RevenueDeterminationStatus_RRSTA,
  LIPS.VLSTP AS DecentralizedWhseProcessing_VLSTP,
  VBAP.FSSTA AS BillingBlockStatusForItems_FSSTA,
  VBAP.LSSTA AS DeliveryBlockStatusForItem_LSSTA,
  LIPS.PDSTA AS PodStatusOnItemLevel_PDSTA,
  VBAP.MANEK AS ManualCompletionOfContract_MANEK,
  LIPS.HDALL AS InboundDeliveryItemNotYetComplete__onHold___HDALL,
  CAST(NULL AS STRING) AS Indicator_StockableTypeSwitchedIntoStandardProduct_LTSPS,
  CAST(NULL AS STRING) AS AllocationStatusOfASalesDocumentItem_FSH_AR_STAT_ITM,
  CAST(NULL AS STRING) AS StatusOfSalesOrderItem_MILL_VS_VSSTA,
  ( CASE LIPS.FKSTA
    WHEN 'A' THEN 'Not Yet Processed'
    WHEN 'B' THEN 'Partially Processed'
    WHEN 'C' THEN 'Completely Processed'
    END ) AS Billing_Status,
  ( CASE VBAP.LFSTA
      WHEN 'A' THEN 'Not Yet Processed'
      WHEN 'B' THEN 'Partially Processed'
      WHEN 'C' THEN 'Completely Processed'
    END ) AS Delivery_Status
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbap')} AS VBAP
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'lips')} AS LIPS
  ON VBAP.VBELN = LIPS.VGBEL
    AND VBAP.POSNR = LIPS.VGPOS
    AND VBAP.MANDT = LIPS.MANDT
`
);
