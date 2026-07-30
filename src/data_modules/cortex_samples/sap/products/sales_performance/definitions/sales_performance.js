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
const materializationType = tableConfig.materializationType || "incremental";
const date = require("includes/date.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");
const incremental = require("includes/incremental.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "sales_document_number_vbeln",
    "sales_document_item_number_posnr"
  ]
);

const filters = tableConfig.filters || {};
const targetLanguage = filters.language ?? "E";
const targetNation = filters.address_version_nation ?? "";
const safeLanguage = String(targetLanguage).replace(/'/g, "''");
const safeNation = String(targetNation).replace(/'/g, "''");

publish("sales_performance", publishConfig).query(
  (ctx) => `
WITH date_dimension as (
  ${date.getDateDimension()}
),
delivered_quantity AS (
  SELECT
    client_mandt,
    internal_reference_document_number_vgbel AS sales_document_id,
    internal_reference_document_item_vgpos AS item_id,
    SUM(actual_quantity_delivered_in_sales_units_lfimg) AS total_delivered_quantity
  FROM ${ctx.ref(moduleConfig.sources.sapDeliveryDocuments.datasetId, "delivery_document_items")}
  GROUP BY client_mandt, internal_reference_document_number_vgbel, internal_reference_document_item_vgpos
)
SELECT
  header.client_mandt AS client_mandt,
  header.document_number_vbeln AS sales_document_number_vbeln,
  item.item_number_posnr AS sales_document_item_number_posnr,
  COALESCE(salesorg.language_key_spras, '${safeLanguage}') AS language_key_spras,
  header.sales_organization_vkorg AS sales_organization_vkorg,
  salesorg.name_vtext AS sales_organization_name_vtext,
  header.division_spart AS division_spart,
  division.name_vtext AS division_name_vtext,
  header.sold_to_party_kunnr AS sold_to_party_kunnr,
  customer.name1_name1 AS customer_name_name1,
  item.material_number_matnr AS material_number_matnr,
  product.material_text_maktx AS material_text_maktx,
  item.net_value_of_the_sales_document_item_in_document_currency_netwr AS net_value_in_document_currency_netwr,
  header.document_currency_waerk AS document_currency_waerk,
  header.requested_delivery_date_vdatu AS requested_delivery_date_vdatu,
  header.delivery_block_lifsk AS delivery_block_lifsk,
  item_status.delivery_status_lfsta AS item_delivery_status_lfsta,
  item_status.overall_delivery_status_of_the_item_lfgsa AS overall_item_delivery_status_lfgsa,
  header_status.delivery_status_lfstk AS header_delivery_status_lfstk,
  header_status.overall_delivery_status_lfgsk AS overall_header_delivery_status_lfgsk,
  dimensional_document_date.cal_year AS year_of_sales_document,
  dimensional_document_date.cal_month AS month_of_sales_document,
  dimensional_document_date.cal_quarter AS quarter_of_sales_document,
  dimensional_delivery_date.cal_year AS year_of_requested_delivery,
  dimensional_delivery_date.cal_month AS month_of_requested_delivery,
  dimensional_delivery_date.cal_quarter AS quarter_of_requested_delivery,
  CASE 
    WHEN CURRENT_DATE() > header.requested_delivery_date_vdatu 
      AND (delivered_quantity.total_delivered_quantity IS NULL 
      OR delivered_quantity.total_delivered_quantity < item.cumulative_order_quantity_kwmeng) 
    THEN TRUE 
    ELSE FALSE 
  END AS is_delivery_overdue,
  GREATEST(
    IFNULL(header.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(item.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(header_status.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(item_status.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(customer.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(product.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(salesorg.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')), 
    IFNULL(division.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapSalesDocuments.datasetId, "sales_document_headers")} AS header
JOIN ${ctx.ref(moduleConfig.sources.sapSalesDocuments.datasetId, "sales_document_items")} AS item
  ON header.client_mandt = item.client_mandt
  AND header.document_number_vbeln = item.document_number_vbeln
JOIN ${ctx.ref(moduleConfig.sources.sapSalesDocuments.datasetId, "sales_document_header_statuses")} AS header_status
  ON header.client_mandt = header_status.client_mandt
  AND header.document_number_vbeln = header_status.sales_document_vbeln
JOIN ${ctx.ref(moduleConfig.sources.sapSalesDocuments.datasetId, "sales_document_item_statuses")} AS item_status
  ON item.client_mandt = item_status.client_mandt
  AND item.document_number_vbeln = item_status.sales_document_vbeln
  AND item.item_number_posnr = item_status.sales_document_item_posnr
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapCustomers.datasetId, "customers")} AS customer
  ON header.client_mandt = customer.client_mandt
  AND header.sold_to_party_kunnr = customer.customer_number_kunnr
  AND customer.language_key_spras = '${safeLanguage}'
  AND COALESCE(customer.version_id_for_international_addresses_nation, '') = '${safeNation}'
  AND customer.valid_to_date_date_to = CAST('9999-12-31' AS DATE)
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMaterials.datasetId, "materials")} AS product
  ON item.client_mandt = product.client_mandt
  AND item.material_number_matnr = product.material_number_matnr
  AND product.language_key_spras = '${safeLanguage}'
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapSalesOrganizationalStructure.datasetId, "sales_organizations")} AS salesorg
  ON header.client_mandt = salesorg.client_mandt
  AND header.sales_organization_vkorg = salesorg.sales_organization_vkorg
  AND salesorg.language_key_spras = '${safeLanguage}'
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapSalesOrganizationalStructure.datasetId, "divisions")} AS division
  ON header.client_mandt = division.client_mandt
  AND header.division_spart = division.division_spart
  AND division.language_key_spras = '${safeLanguage}'
LEFT JOIN delivered_quantity AS delivered_quantity
  ON item.client_mandt = delivered_quantity.client_mandt
  AND item.document_number_vbeln = delivered_quantity.sales_document_id
  AND item.item_number_posnr = delivered_quantity.item_id
LEFT JOIN date_dimension AS dimensional_document_date
  ON header.document_date_audat = dimensional_document_date.date
LEFT JOIN date_dimension AS dimensional_delivery_date
  ON header.requested_delivery_date_vdatu = dimensional_delivery_date.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, [
    "header.source_last_updated_at",
    "item.source_last_updated_at",
    "header_status.source_last_updated_at",
    "item_status.source_last_updated_at",
    "customer.source_last_updated_at",
    "product.source_last_updated_at",
    "salesorg.source_last_updated_at",
    "division.source_last_updated_at"
  ])
])}
`
);  