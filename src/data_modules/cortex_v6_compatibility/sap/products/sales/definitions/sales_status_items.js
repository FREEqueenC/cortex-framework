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

publish("sales_status_items", { ...publishConfig, name: "SalesStatus_Items" }).query(
  (ctx) => `
WITH
  MaterialsMD AS (
    ${master_data.getMaterialsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  )

SELECT
  SO.Client_MANDT,
  SO.SalesOrder_VBELV,
  SO.SalesItem_POSNV,
  so_status.Delivery_Status,
  SO.DeliveryNumber_VBELV,
  SO.DeliveryItem_POSNV,
  SO.InvoiceNumber_VBELN,
  SO.InvoiceItem_POSNN,
  vbap.CumulativeOrderQuantity_KWMENG AS SalesQty,
  vbap.SalesUnit_VRKME,
  vbap.NetPrice_NETWR,
  vbap.Currency_WAERK,
  SO.DeliveredQty_RFMNG,
  SO.DeliveredUoM_MEINS,
  SO.InvoiceQty_RFMNG,
  SO.InvoiceUoM_MEINS,
  SO.InvoiceValue_RFWRT,
  SO.InvoiceCurrency_WAERS,
  vbap.MaterialNumber_MATNR,
  mat.MaterialText_MAKTX,
  vbap.ProductHierarchy_PRODH,
  mat.Language_SPRAS
FROM ${ctx.ref('SDDocumentFlow')} AS SO
INNER JOIN ${ctx.ref('SalesOrders')} AS vbap
  ON SO.Client_MANDT = vbap.Client_MANDT
    AND SO.SalesOrder_VBELV = vbap.SalesDocument_VBELN
    AND SAFE_CAST(SO.SalesItem_POSNV AS INT64) = SAFE_CAST(vbap.Item_POSNR AS INT64)
INNER JOIN MaterialsMD AS mat
  ON SO.Client_MANDT = mat.Client_MANDT
    AND vbap.MaterialNumber_MATNR = mat.MaterialNumber_MATNR
INNER JOIN ${ctx.ref('SDStatus_Items')} AS so_status
  ON SO.Client_MANDT = so_status.Client_MANDT
    AND SO.SalesOrder_VBELV = so_status.SDDocumentNumber_VBELN
    AND SAFE_CAST(SO.SalesItem_POSNV AS INT64) = SAFE_CAST(so_status.ItemNumberOfTheSdDocument_POSNR AS INT64)
`
);
