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

const languages = moduleConfig.moduleSettings?.languages || ['E'];

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("sales_fulfillment", { ...publishConfig, name: "SalesFulfillment" }).query(
  (ctx) => `
WITH
  SO AS (
    SELECT
      SO.Client_MANDT,
      SO.InvoiceUoM_MEINS,
      SO.InvoiceCurrency_WAERS,
      SO.MaterialNumber_MATNR,
      SO.MaterialText_MAKTX,
      SO.DeliveredUoM_MEINS,
      SO.ProductHierarchy_PRODH,
      SO.Language_SPRAS,
      SUM(SO.InvoiceQty_RFMNG) AS BilledQty,
      SUM(SO.InvoiceValue_RFWRT) AS InvoicePrice,
      SUM(SO.DeliveredQty_RFMNG) AS DeliveredQty,
      (SUM(SO.DeliveredQty_RFMNG) - SUM(SO.InvoiceQty_RFMNG)) AS DeliveredPendingBilling
    FROM ${ctx.ref('SalesStatus_Items')} AS SO
    WHERE Language_SPRAS IN UNNEST(${JSON.stringify(languages)})
    GROUP BY
      SO.Client_MANDT, Currency_WAERK, DeliveredUoM_MEINS,
      InvoiceUoM_MEINS, InvoiceCurrency_WAERS,
      SalesUnit_VRKME, MaterialNumber_MATNR, MaterialText_MAKTX,
      ProductHierarchy_PRODH, Language_SPRAS
  )

SELECT
  SO.Client_MANDT,
  SO.MaterialNumber_MATNR,
  SO.MaterialText_MAKTX,
  vbap.SalesUnit_VRKME,
  vbap.Currency_WAERK,
  SO.DeliveredQty,
  SO.DeliveredUoM_MEINS,
  SO.DeliveredPendingBilling,
  vbap.SalesOrganization_VKORG,
  SUM(vbap.CumulativeOrderQuantity_KWMENG) AS SalesQty,
  SUM(vbap.NetPrice_NETWR) AS NetPrice,
  (SUM(vbap.CumulativeOrderQuantity_KWMENG) - SO.DeliveredQty) AS PendingDelivery
FROM ${ctx.ref('SalesOrders_V2')} AS vbap
LEFT OUTER JOIN SO
  ON SO.Client_MANDT = vbap.Client_MANDT
    AND SO.MaterialNumber_MATNR = vbap.MaterialNumber_MATNR
    AND SO.InvoiceCurrency_WAERS = vbap.Currency_WAERK
GROUP BY
  SO.Client_MANDT, vbap.SalesUnit_VRKME, vbap.Currency_WAERK,
  SO.MaterialNumber_MATNR, SO.MaterialText_MAKTX, SO.DeliveredUoM_MEINS,
  SO.DeliveredQty, SO.DeliveredPendingBilling, vbap.SalesOrganization_VKORG
`
);
