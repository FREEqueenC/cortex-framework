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

const languages = moduleConfig.moduleSettings?.languages || ['E'];

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("stock_unrestricted_vs_sales", { ...publishConfig, name: "Stock_Unrestricted_vs_Sales" }).query(
  (ctx) => `
WITH
  SDDocumentFlow AS (
    SELECT
      SO.mandt AS Client_MANDT,
      SO.VBELV AS SalesOrder_VBELV,
      SO.POSNV AS SalesItem_POSNV,
      SO.RFMNG AS DeliveredQty_RFMNG,
      SO.MEINS AS DeliveredUoM_MEINS
    FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbfa')} AS SO
    WHERE SO.vbtyp_V = 'C'
      AND SO.vbtyp_n IN ('J', 'T')
  ),

  MaterialsMD AS (
    ${master_data.getMaterialsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  SalesOrders AS (
    SELECT
      vbak.mandt AS Client_MANDT,
      vbak.vbeln AS SalesDocument_VBELN,
      vbap.posnr AS Item_POSNR,
      vbap.matnr AS MaterialNumber_MATNR,
      vbap.kwmeng AS CumulativeOrderQuantity_KWMENG,
      vbap.vrkme AS SalesUnit_VRKME,
      vbak.waerk AS Currency_WAERK,
      vbap.werks AS Plant_WERKS,
      vbap.lgort AS StorageLocation_LGORT
    FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbak')} AS vbak
    INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbap')} AS vbap
      ON vbak.vbeln = vbap.vbeln AND vbak.mandt = vbap.mandt
  ),

  SalesStatus_Items AS (
    SELECT
      SO.Client_MANDT,
      SO.SalesOrder_VBELV,
      SO.SalesItem_POSNV,
      vbap.CumulativeOrderQuantity_KWMENG AS SalesQty,
      vbap.SalesUnit_VRKME,
      vbap.Currency_WAERK,
      SO.DeliveredQty_RFMNG,
      SO.DeliveredUoM_MEINS,
      vbap.MaterialNumber_MATNR,
      mat.MaterialText_MAKTX,
      mat.Language_SPRAS,
      vbap.Plant_WERKS,
      vbap.StorageLocation_LGORT
    FROM SDDocumentFlow AS SO
    INNER JOIN SalesOrders AS vbap
      ON SO.Client_MANDT = vbap.Client_MANDT
        AND SO.SalesOrder_VBELV = vbap.SalesDocument_VBELN
        AND SAFE_CAST(SO.SalesItem_POSNV AS INT64) = SAFE_CAST(vbap.Item_POSNR AS INT64)
    INNER JOIN MaterialsMD AS mat
      ON SO.Client_MANDT = mat.Client_MANDT
        AND vbap.MaterialNumber_MATNR = mat.MaterialNumber_MATNR
  ),

  SalesFulfillment_perOrder AS (
    SELECT
      Client_MANDT,
      MaterialNumber_MATNR,
      SalesUnit_VRKME,
      DeliveredUoM_MEINS,
      Plant_WERKS,
      StorageLocation_LGORT,
      Language_SPRAS,
      SUM(SalesQty) AS SalesQty,
      SUM(DeliveredQty_RFMNG) AS DeliveredQty,
      (SUM(SalesQty) - SUM(DeliveredQty_RFMNG)) AS PendingDelivery
    FROM SalesStatus_Items
    GROUP BY
      Client_MANDT, MaterialNumber_MATNR, SalesUnit_VRKME, DeliveredUoM_MEINS,
      Plant_WERKS, StorageLocation_LGORT, Language_SPRAS
  ),

  stock AS (
    SELECT
      Client_MANDT,
      MaterialNumber_MATNR,
      MaterialText_MAKTX,
      Plant_WERKS,
      Plant_Name,
      BaseUnitOfMeasure_MEINS,
      ProductHierarchy_PRDHA,
      Plant_Region,
      Plant_Country,
      StorageLocation_LGORT,
      Language_SPRAS,
      SUM(ValuatedUnrestrictedUseStock) AS UnrestrictedStock
    FROM ${ctx.ref('Stock_NonValuated')}
    GROUP BY
      Client_MANDT, MaterialNumber_MATNR, MaterialText_MAKTX,
      Plant_WERKS, Plant_Name, BaseUnitOfMeasure_MEINS, ProductHierarchy_PRDHA,
      Plant_Region, Plant_Country, StorageLocation_LGORT, Language_SPRAS
  ),

  sales AS (
    SELECT
      Client_MANDT,
      MaterialNumber_MATNR,
      SalesUnit_VRKME,
      DeliveredUoM_MEINS,
      Plant_WERKS,
      StorageLocation_LGORT,
      Language_SPRAS,
      SUM(SalesQty) AS SalesQty,
      SUM(DeliveredQty) AS DeliveredQty,
      SUM(PendingDelivery) AS PendingDelivery
    FROM SalesFulfillment_perOrder
    GROUP BY
      Client_MANDT, MaterialNumber_MATNR, SalesUnit_VRKME, DeliveredUoM_MEINS,
      Plant_WERKS, StorageLocation_LGORT, Language_SPRAS
  )

SELECT
  stock.*,
  sales.SalesQty,
  sales.DeliveredQty,
  sales.DeliveredUoM_MEINS,
  sales.PendingDelivery
FROM sales
LEFT OUTER JOIN stock
  ON stock.Client_MANDT = sales.Client_MANDT
    AND stock.MaterialNumber_MATNR = sales.MaterialNumber_MATNR
    AND stock.Plant_WERKS = sales.Plant_WERKS
    AND stock.StorageLocation_LGORT = sales.StorageLocation_LGORT
    AND stock.Language_SPRAS = sales.Language_SPRAS
    AND stock.BaseUnitOfMeasure_MEINS = sales.DeliveredUoM_MEINS
WHERE stock.Language_SPRAS IN UNNEST(${JSON.stringify(languages)})
`
);
