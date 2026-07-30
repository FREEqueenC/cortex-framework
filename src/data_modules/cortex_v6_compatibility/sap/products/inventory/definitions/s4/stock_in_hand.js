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
  MATBF AS ArticleNumber_MATNR,
  WERKS AS Site_WERKS,
  LGORT_SID AS StorageLocation_LGORT,
  CAST(CHARG_SID AS STRING) AS BatchNumber_CHARG,
  SOBKZ AS SpecialStockIndicator_SOBKZ,
  MAT_KDAUF AS SDDocumentNumber_VBELN,
  MAT_KDPOS AS SDDocumentItemNumber_POSNR,
  LIFNR_SID AS VendorAccountNumber_LIFNR,
  KUNNR_SID AS CustomerNumber_KUNNR,
  CAST(SUM(
    CASE SHKZG
      WHEN 'S' THEN MENGE
      WHEN 'H' THEN -MENGE
      ELSE 0
    END
  ) AS STRING) AS Qty,
  CASE BSTAUS_SG
    WHEN 'A' THEN 'A-Unrestricted use'
    WHEN 'B' THEN 'B-Quality inspection'
    WHEN 'C' THEN 'C-Blocked stock returns'
    WHEN 'D' THEN 'D-Blocked Stock'
    WHEN 'E' THEN 'E-Stock of All Restricted Batches'
    WHEN 'F' THEN 'F-Stock in transfer'
    WHEN 'K' THEN 'A-Unrestricted use'
    WHEN 'L' THEN 'B-Quality inspection'
    WHEN 'M' THEN 'E-Stock of All Restricted Batches'
    WHEN 'Q' THEN 'A-Unrestricted use'
    WHEN 'R' THEN 'B-Quality inspection'
    WHEN 'S' THEN 'E-Stock of All Restricted Batches'
  END AS StockType
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'matdoc')}
WHERE
  BSTAUS_SG IN ('A', 'B', 'C', 'D', 'E', 'F', 'K', 'L', 'M', 'Q', 'R', 'S')
GROUP BY
  Client_MANDT,
  ArticleNumber_MATNR,
  Site_WERKS,
  StorageLocation_LGORT,
  BatchNumber_CHARG,
  SpecialStockIndicator_SOBKZ,
  SDDocumentNumber_VBELN,
  SDDocumentItemNumber_POSNR,
  VendorAccountNumber_LIFNR,
  CustomerNumber_KUNNR,
  StockType
HAVING SUM(
  CASE SHKZG
    WHEN 'S' THEN MENGE
    WHEN 'H' THEN -MENGE
    ELSE 0
  END
) != 0
`
);
