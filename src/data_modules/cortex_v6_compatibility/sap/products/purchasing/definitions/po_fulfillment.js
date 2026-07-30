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

publish("po_fulfillment", { ...publishConfig, name: "POFulfillment" }).query(
  (ctx) => `
WITH eket AS (
  SELECT
    Client_MANDT,
    PurchasingDocumentNumber_EBELN,
    ItemNumberOfPurchasingDocument_EBELP,
    StatisticsRelevantDeliveryDate_SLFDT,
    ItemDeliveryDate_EINDT,
    SUM(ScheduledQuantity_MENGE) AS ScheduledQuantity_MENGE,
    SUM(QuantityOfGoodsReceived_WEMNG) AS QuantityOfGoodsReceived_WEMNG
  FROM
    ${ctx.ref('POSchedule')}
  GROUP BY
    Client_MANDT,
    PurchasingDocumentNumber_EBELN,
    ItemNumberOfPurchasingDocument_EBELP,
    StatisticsRelevantDeliveryDate_SLFDT,
    ItemDeliveryDate_EINDT
)
SELECT
  PO.Client_MANDT,
  PO.DocumentNumber_EBELN,
  PO.Item_EBELP,
  PO.DocumentCategory_BSTYP,
  PO.DocumentType_BSART,
  PO.VendorAccountNumber_LIFNR,
  PO.Language_SPRAS,
  PO.TermsPaymentKey_ZTERM,
  PO.CashDiscountPercentage1_ZBD1P,
  PO.PurchasingOrganization_EKORG,
  PO.PurchasingGroup_EKGRP,
  PO.CurrencyKey_WAERS,
  PO.MaterialNumber_MATNR,
  PO.ShortText_TXZ01,
  PO.MaterialGroup_MATKL,
  PO.StorageLocation_LGORT,
  PO.POQuantity_MENGE,
  PO.UoM_MEINS,
  PO.OrderPriceUnit_BPRME,
  PO.NetPrice_NETPR,
  PO.NetOrderValueinPOCurrency_NETWR,
  PO.GrossordervalueinPOcurrency_BRTWR,
  PO.DeliveryCompletedFlag_ELIKZ,
  PO.NetWeight_NTGEW,
  PO.ReturnsItem_RETPO,
  delivery.ItemDeliveryDate_EINDT,
  IF(PO.ReturnsItem_RETPO IS NULL, delivery.ScheduledQuantity_MENGE, delivery.ScheduledQuantity_MENGE * -1) AS TotalScheduledQty,
  IF(PO.ReturnsItem_RETPO IS NULL, delivery.QuantityOfGoodsReceived_WEMNG, delivery.QuantityOfGoodsReceived_WEMNG * -1) AS TotalReceivedQty,
  (IF(PO.ReturnsItem_RETPO IS NULL, delivery.ScheduledQuantity_MENGE, delivery.ScheduledQuantity_MENGE * -1) - IF(PO.ReturnsItem_RETPO IS NULL, delivery.QuantityOfGoodsReceived_WEMNG, delivery.QuantityOfGoodsReceived_WEMNG * -1)) AS PendingQty
FROM
  ${ctx.ref('PurchaseDocuments')} AS PO
INNER JOIN
  eket AS delivery
  ON PO.Client_MANDT = delivery.Client_MANDT
    AND PO.DocumentNumber_EBELN = delivery.PurchasingDocumentNumber_EBELN
    AND PO.Item_EBELP = delivery.ItemNumberOfPurchasingDocument_EBELP
`
);
