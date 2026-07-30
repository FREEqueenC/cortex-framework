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

publish("sales_order_status", { ...publishConfig, name: "SalesOrderStatus" }).query(
  (ctx) => `
SELECT
  vbap.VBELN AS SalesDocument_VBELN,
  vbap.POSNR AS Item_POSNR,
  vbap.MATNR AS MaterialNumber_MATNR,
  vbak.AUART AS SalesDocumentType_AUART,
  vbak.AUGRU AS Reason_AUGRU,
  vbak.KVGR1 AS CustomerGroup1_KVGR1,
  vbak.KVGR2 AS CustomerGroup2_KVGR2,
  vbak.KVGR3 AS CustomerGroup3_KVGR3,
  vbak.KVGR4 AS CustomerGroup4_KVGR4,
  vbak.KVGR5 AS CustomerGroup5_KVGR5,
  vbak.LIFSK AS DeliveryBlock_LIFSK,
  vbap.VPWRK AS PlanningPlant_VPWRK,
  vbap.LGORT AS StorageLocation_LGORT,
  vbap.CHARG AS BatchNumber_CHARG,
  vbap.KWMENG AS CumulativeOrderQuantity_KWMENG,
  lips.VGBEL AS ReferenceDocument_VGBEL,
  lips.VGPOS AS ReferenceItem_VGPOS,
  lips.LFIMG AS ActualQuantityDelivered_LFIMG,
  lips.VGTYP AS DocumentCategory_VGTYP,
  vbap.SERAIL AS SerialNumberProfile_SERAIL,
  vbap.ANZSN AS NumberOfSerialNumbers_ANZSN,
  vbak.ABSTK AS HeaderRejectionStatus_ABSTK,
  vbak.LFGSK AS HeaderDeliveryStatus_LFGSK,
  lips.WBSTA AS GoodsMovementStatus_WBSTA,
  vbak.ERDAT AS CreationDate_ERDAT,
  vbak.ERZET AS CreationTime_ERZET,
  vbak.VDATU AS RequestedDeliveryDate_VDATU,
  vbak.AUTLF AS CompleteDeliveryFlag_AUTLF,
  lips.VBELN AS Delivery_VBELN,
  lips.POSNR AS DeliveryItem_POSNR,
  IF((vbap.KWMENG - lips.LFIMG) < 0, 0, (vbap.KWMENG - lips.LFIMG)) AS OPENQTY
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbap')} AS vbap
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'lips')} AS lips
  ON vbap.MANDT = lips.MANDT
    AND vbap.VBELN = lips.VGBEL
    AND vbap.POSNR = lips.VGPOS
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'vbak')} AS vbak
  ON vbap.MANDT = vbak.MANDT
    AND vbap.VBELN = vbak.VBELN
`
);
