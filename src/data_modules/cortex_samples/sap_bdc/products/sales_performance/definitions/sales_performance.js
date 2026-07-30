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
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "salesorder",
    "salesorderitem",
  ]
);

const filters = tableConfig.filters || {};
const delivery_status_complete = filters.delivery_status_complete || ['C'];

publish("sales_performance", publishConfig).query(
  (ctx) => `
WITH 
date_dimension AS (
  ${date.getDateDimension()}
)
SELECT
  header.SalesOrder AS sales_order,
  item.SalesOrderItem AS sales_order_item,
  header.SalesOrderType AS sales_order_type,
  header.SalesOrderDate AS sales_order_date,
  header.SalesOrganization AS sales_organization,
  header.OrganizationDivision AS organization_division,
  header.DistributionChannel AS distribution_channel,
  header.SoldToParty AS sold_to_party,
  customer.CustomerName AS customer_name,
  item.ProductGroup AS product_group,
  item.Product AS product,
  item.SalesOrderItemText AS sales_order_item_text,
  item.OrderQuantity AS order_quantity,
  item.OrderQuantityUnit AS order_quantity_unit,
  header.TotalNetAmount AS total_net_amount,
  item.NetAmount AS net_amount,
  item.TransactionCurrency AS transaction_currency,
  item.DeliveryStatus AS delivery_status,
  item.TotalDeliveryStatus AS total_delivery_status,
  header.RequestedDeliveryDate AS requested_delivery_date,
  header.DeliveryBlockReason AS delivery_block_reason,
  header.OverallTotalDeliveryStatus AS overall_total_delivery_status,
  CASE 
    WHEN CURRENT_DATE() > header.RequestedDeliveryDate 
      AND item.DeliveryStatus NOT IN (${sql_helper.formatFilterArray(delivery_status_complete)}) 
      THEN TRUE 
    ELSE FALSE 
  END AS is_delivery_overdue,
  dimensional_document_date.cal_year AS year_of_sales_document,
  dimensional_document_date.cal_month AS month_of_sales_document,
  dimensional_document_date.cal_quarter AS quarter_of_sales_document,
  dimensional_delivery_date.cal_year AS year_of_requested_delivery,
  dimensional_delivery_date.cal_month AS month_of_requested_delivery,
  dimensional_delivery_date.cal_quarter AS quarter_of_requested_delivery
FROM ${ctx.ref(moduleConfig.sources.sapBdcSalesOrder.projectId, moduleConfig.sources.sapBdcSalesOrder.datasetId, "salesorder")} AS header
JOIN ${ctx.ref(moduleConfig.sources.sapBdcSalesOrder.projectId, moduleConfig.sources.sapBdcSalesOrder.datasetId, "salesorderitem")} AS item
ON header.SalesOrder = item.SalesOrder
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapBdcCustomer.projectId, moduleConfig.sources.sapBdcCustomer.datasetId, "customer")} AS customer
ON header.SoldToParty = customer.Customer
LEFT JOIN date_dimension AS dimensional_document_date
ON header.SalesOrderDate = dimensional_document_date.date
LEFT JOIN date_dimension AS dimensional_delivery_date
ON header.RequestedDeliveryDate = dimensional_delivery_date.date
`
);
