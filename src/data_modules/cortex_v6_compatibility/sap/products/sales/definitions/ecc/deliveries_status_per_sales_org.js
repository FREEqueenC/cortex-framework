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

publish("deliveries_status_per_sales_org", { ...publishConfig, name: "DeliveriesStatus_PerSalesOrg" }).query(
  (ctx) => `
WITH
  SalesOrganizations AS (
    ${master_data.getSalesOrganizationsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  )

SELECT
  del.Client_MANDT,
  del.Delivery_VBELN,
  del.SalesDistrict_BZIRK,
  del.ShippingPointreceivingPoint_VSTEL,
  del.SalesOrganization_VKORG,
  del.DeliveryType_LFART,
  del.CompleteDeliveryDefinedForEachSalesOrder_AUTLF,
  del.ActualQuantityDeliveredInStockkeepingUnits_LGMNG,
  del.BaseUnitOfMeasure_MEINS,
  del.LoadingDate_LDDAT,
  del.TransportationPlanningDate_TDDAT,
  del.DeliveryDate_LFDAT,
  del.UnloadingPoint_ABLAD,
  del.Incoterms__part1___INCO1,
  del.Incoterms__part2___INCO2,
  del.ExportIndicator_EXPKZ,
  del.Route_ROUTE,
  del.BillingBlockInSdDocument_FAKSK,
  del.DeliveryBlock_documentHeader_LIFSK,
  del.SdDocumentCategory_VBTYP,
  del.CustomerFactoryCalendar_KNFAK,
  del.ShippingConditions_VSBED,
  del.ShipToParty_KUNNR,
  del.SoldToParty_KUNAG,
  del.CustomerGroup_KDGRP,
  del.TotalWeight_BTGEW,
  del.NetWeight_NTGEW,
  del.WeightUnit_GEWEI,
  del.VolumeUnit_VOLEH,
  del.TotalNumberOfPackagesInDelivery_ANZPK,
  del.PickedItemsLocation_BEROT,
  del.TimeOfDelivery_LFUHR,
  del.LoadingPoint_LSTEL,
  del.SdDocumentCurrency_WAERK,
  del.ShippingProcessingTimeForTheEntireDocument_VBEAK,
  del.DateOfLastChange_AEDAT,
  del.DocumentDateInDocument_BLDAT,
  del.ReferenceDocumentNumber_XBLNR,
  del.Date__proofOfDelivery___PODAT,
  del.DeliveryItem_POSNR,
  del.MaterialNumber_MATNR,
  del.MaterialGroup_MATKL,
  del.Plant_WERKS,
  del.StorageLocation_LGORT,
  SalesOrganizations.SalesOrgCurrency_WAERS,
  SalesOrganizations.SalesOrgName_VTEXT,
  SalesOrganizations.Country_LAND1,
  SalesOrganizations.Language_SPRAS,
  SD.DeliveryStatus_LFSTA AS Delivery_Status,
  del.is_return,
  (
    CASE SD.DeliveryStatus_LFSTA
      WHEN 'A' THEN 'Not Yet Processed'
      WHEN 'B' THEN 'Partially Processed'
      WHEN 'C' THEN 'Completely Processed'
    END
  ) AS Delivery_StatusItm
FROM ${ctx.ref('Deliveries')} AS del
LEFT OUTER JOIN ${ctx.ref('SDStatus_Items')} AS SD
  ON del.Delivery_VBELN = SD.SDDocumentNumber_VBELN
    AND del.DeliveryItem_POSNR = SD.ItemNumberOfTheSdDocument_POSNR
    AND del.Client_MANDT = SD.Client_MANDT
LEFT OUTER JOIN SalesOrganizations AS SalesOrganizations
  ON del.Client_MANDT = SalesOrganizations.Client_MANDT
    AND del.SalesOrganization_VKORG = SalesOrganizations.SalesOrg_VKORG
`
);
