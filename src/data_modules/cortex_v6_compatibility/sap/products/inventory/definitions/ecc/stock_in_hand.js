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

publish("stock_in_hand", { ...publishConfig, name: "StockInHand" }).query(
  (ctx) => `
SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  LGORT AS StorageLocation_LGORT,
  NULL AS BatchNumber_CHARG,
  NULL AS SpecialStockIndicator_SOBKZ,
  NULL AS SDDocumentNumber_VBELN,
  NULL AS SDDocumentItemNumber_POSNR,
  NULL AS VendorAccountNumber_LIFNR,
  NULL AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'LABST' THEN 'A-Unrestricted use'
    WHEN 'UMLME' THEN 'F-Stock in transfer'
    WHEN 'INSME' THEN 'B-Quality inspection'
    WHEN 'EINME' THEN 'E-Stock of All Restricted Batches'
    WHEN 'SPEME' THEN 'D-Blocked Stock'
    WHEN 'RETME' THEN 'C-Blocked stock returns'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mard')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (LABST, UMLME, INSME, EINME, SPEME, RETME))

UNION ALL

SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  LGORT AS StorageLocation_LGORT,
  CAST(CHARG AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  VBELN AS SDDocumentNumber_VBELN,
  POSNR AS SDDocumentItemNumber_POSNR,
  NULL AS VendorAccountNumber_LIFNR,
  NULL AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'KALAB' THEN 'A-Unrestricted use'
    WHEN 'KAINS' THEN 'B-Quality inspection'
    WHEN 'KASPE' THEN 'D-Blocked Stock'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mska')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (KALAB, KAINS, KASPE))

UNION ALL

SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  NULL AS StorageLocation_LGORT,
  CAST(CHARG AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  VBELN AS SDDocumentNumber_VBELN,
  POSNR AS SDDocumentItemNumber_POSNR,
  LIFNR AS VendorAccountNumber_LIFNR,
  NULL AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'FDLAB' THEN 'A-Unrestricted use'
    WHEN 'FDINS' THEN 'B-Quality inspection'
    WHEN 'FDEIN' THEN 'E-Stock of All Restricted Batches'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'msfd')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (FDLAB, FDINS, FDEIN))

UNION ALL

SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  NULL AS StorageLocation_LGORT,
  CAST(CHARG AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  NULL AS SDDocumentNumber_VBELN,
  NULL AS SDDocumentItemNumber_POSNR,
  LIFNR AS VendorAccountNumber_LIFNR,
  NULL AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'LBLAB' THEN 'A-Unrestricted use'
    WHEN 'LBINS' THEN 'B-Quality inspection'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mslb')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (LBLAB, LBINS))

UNION ALL

SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  NULL AS StorageLocation_LGORT,
  CAST(CHARG AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  NULL AS SDDocumentNumber_VBELN,
  NULL AS SDDocumentItemNumber_POSNR,
  NULL AS VendorAccountNumber_LIFNR,
  KUNNR AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'KULAB' THEN 'A-Unrestricted use'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'msku')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (KULAB))

UNION ALL

SELECT
  MANDT AS Client_MANDT,
  MATNR AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  LGORT AS StorageLocation_LGORT,
  CAST(CHARG AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  NULL AS SDDocumentNumber_VBELN,
  NULL AS SDDocumentItemNumber_POSNR,
  LIFNR AS VendorAccountNumber_LIFNR,
  NULL AS CustomerNumber_KUNNR,
  CAST(Qty AS STRING) AS Qty,
  CASE SourceStockColumn
    WHEN 'SLABS' THEN 'A-Unrestricted use'
    WHEN 'SINSM' THEN 'B-Quality inspection'
    WHEN 'SSPEM' THEN 'D-Blocked Stock'
  END AS StockType
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mkol')}
UNPIVOT EXCLUDE NULLS (Qty FOR SourceStockColumn IN (SLABS, SINSM, SSPEM))
`
);
