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

publish("storage_locations_md", { ...publishConfig, name: "StorageLocationsMD" }).query(
  (ctx) => `
SELECT
  t001l.MANDT AS Client_MANDT,
  t001l.WERKS AS Plant_WERKS,
  t001l.LGORT AS StorageLocation_LGORT,
  --   t001l.SPART AS Division_SPART,
  --   t001l.XLONG AS NegativeStocksAllowed_XLONG,
  --   t001l.XBUFX AS FreezingBookInventoryBal_XBUFX,
  --   t001l.DISKZ AS StorageLocationMRPIndicator_DISKZ,
  --   t001l.XBLGO AS StorageLocationAuthGoodsMovement_XBLGO,
  --   t001l.XRESS AS StorageLocationAllocatedResource_XRESS,
  --   t001l.XHUPF AS HandlingUnitRequirement_XHUPF,
  --   t001l.PARLG AS PartnerStorageLocation_PARLG,
  --   t001l.VKORG AS SalesOrganization_VKORG,
  --   t001l.VTWEG AS DistributionChannel_VTWEG,
  --   t001l.VSTEL AS ShippingPoint_VSTEL,
  --   t001l.LIFNR AS VendorAccountNumber_LIFNR,
  --   t001l.KUNNR AS CustomerNumber_KUNNR,
  --   t001l.MESBS AS BusinessSystemMES_MESBS,
  --   t001l.MESST AS InventoryTypeManagement_MESST,
  --   t001l.OIH_LICNO AS LicenseNumberUntaxedStock_OIH_LICNO,
  --   t001l.OIG_ITRFL AS TDinTransitFlag_OIG_ITRFL,
  --   t001l.OIB_TNKASSIGN AS SiloManagementTankAssignmentIndicator_OIB_TNKASSIGN,
  t001l.LGOBE AS StorageLocationText_LGOBE
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001l')} AS t001l
`
);
