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
const materializationType = tableConfig.materializationType || "view";
const publish_config = require("includes/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "purchase_order",
    "purchase_order_item",
    "language"
  ]
);

publish("supplier_spend_analysis", publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),

purchasing_items AS (
  SELECT
    PurchaseOrder,
    PurchaseOrderItem,
    Material,
    Plant,
    OrderQuantity,
    NetAmount,
    IsCompletelyDelivered,
    MaterialGroup,
    MaterialType,
    PurchaseOrderItemText,
    PurchasingGroup
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcPurchaseOrder.projectId, moduleConfig.sources.sapBdcPurchaseOrder.datasetId, "purchaseorderitem")}
),

purchasing_headers AS (
  SELECT
    PurchaseOrder,
    Supplier,
    PurchasingOrganization,
    PurchaseOrderDate,
    DocumentCurrency,
    PurchaseOrderType,
    PurchaseOrderSubtype,
    PurchasingDocumentOrigin,
    Language
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcPurchaseOrder.projectId, moduleConfig.sources.sapBdcPurchaseOrder.datasetId, "purchaseorder")}
),

vendor_data AS (
  SELECT
    Supplier,
    SupplierName,
    Country,
    DeletionIndicator
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcSupplier.projectId, moduleConfig.sources.sapBdcSupplier.datasetId, "supplier")}
),

purchasing_orgs AS (
  SELECT
    PurchasingOrganization,
    PurchasingOrganizationName
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcPurchasingOrganization.projectId, moduleConfig.sources.sapBdcPurchasingOrganization.datasetId, "purchasingorganization")}
),

purchasing_groups AS (
  SELECT
    PurchasingGroup,
    PurchasingGroupName
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcProcurementConfigurationData.projectId, moduleConfig.sources.sapBdcProcurementConfigurationData.datasetId, "purchasinggroup")}
),

open_quantities AS (
  SELECT
    PurchaseOrder,
    PurchaseOrderItem,
    SUM(OpenPurchaseOrderNetAmount) as open_po_net_amount
  FROM
    ${ctx.ref(moduleConfig.sources.sapBdcPurchaseOrder.projectId, moduleConfig.sources.sapBdcPurchaseOrder.datasetId, "purchaseorderscheduleline")}
  GROUP BY
    PurchaseOrder,
    PurchaseOrderItem
)

SELECT
  i.PurchaseOrder AS purchase_order,
  i.PurchaseOrderItem AS purchase_order_item,
  h.Language AS language,
  h.PurchaseOrderType AS purchasing_order_type,
  h.PurchaseOrderSubtype AS purchase_order_subtype,
  h.PurchasingDocumentOrigin AS purchasing_document_origin,
  h.Supplier AS supplier,
  v.SupplierName AS supplier_name,
  v.Country AS country,
  i.Material AS material,
  i.PurchaseOrderItemText AS purchase_order_item_text,
  i.MaterialType AS material_type,
  i.MaterialGroup AS material_group,
  h.PurchasingOrganization AS purchasing_organization,
  o.PurchasingOrganizationName AS purchasing_organization_name,
  i.PurchasingGroup AS purchasing_group,
  pg.PurchasingGroupName AS purchasing_group_name,

  -- Baseline financial & temporal fields
  h.PurchaseOrderDate AS purchase_order_date,
  i.OrderQuantity AS order_quantity,
  i.NetAmount AS net_amount,
  h.DocumentCurrency AS document_currency, 

  -- Active vendor indicator (True if not deleted)
  CASE
    WHEN v.DeletionIndicator = true THEN false
    ELSE true
  END as active_vendor_indicator,

  -- Delivery and overdues tracking
  CASE
    WHEN i.IsCompletelyDelivered THEN 'X'
    ELSE ''
  END AS delivery_completed_flag,
  COALESCE(oq.open_po_net_amount, 0) as open_purchasing_document_net_amount,

  CASE
    WHEN COALESCE(i.IsCompletelyDelivered, false) = false AND h.PurchaseOrderDate < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN true
    ELSE false
  END as is_overdue,

  -- Efficiency & Performance metrics
  SAFE_DIVIDE(i.NetAmount, i.OrderQuantity) as average_spend_per_unit,
  COUNT(i.PurchaseOrderItem) OVER(PARTITION BY i.PurchaseOrder) as line_item_count,
  dimensional_purchase_order_date.cal_year AS year_of_purchase_order,
  dimensional_purchase_order_date.cal_month AS month_of_purchase_order,
  dimensional_purchase_order_date.cal_quarter AS quarter_of_purchase_order

FROM
  purchasing_items i
LEFT JOIN
  purchasing_headers h
  ON i.PurchaseOrder = h.PurchaseOrder
LEFT JOIN
  vendor_data v
  ON h.Supplier = v.Supplier
LEFT JOIN
  purchasing_orgs o
  ON h.PurchasingOrganization = o.PurchasingOrganization
LEFT JOIN
  purchasing_groups pg
  ON i.PurchasingGroup = pg.PurchasingGroup
LEFT JOIN
  open_quantities oq
  ON i.PurchaseOrder = oq.PurchaseOrder
  AND i.PurchaseOrderItem = oq.PurchaseOrderItem
LEFT JOIN
  date_dimension AS dimensional_purchase_order_date
  ON h.PurchaseOrderDate = dimensional_purchase_order_date.date
`
);
