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
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");
const incremental = require("includes/incremental.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "purchasing_document_number_ebeln",
    "item_number_of_purchasing_document_ebelp"
  ]
);

const filters = tableConfig.filters || {};
const targetLanguage = filters.language ?? "E";
const targetNation = filters.address_version_nation ?? "";
const safeLanguage = String(targetLanguage).replace(/'/g, "''");
const safeNation = String(targetNation).replace(/'/g, "''");

publish("supplier_spend_analysis", publishConfig).query(
  (ctx) => `
WITH purchasing_items AS (
  SELECT
    client_mandt,
    purchasing_document_number_ebeln,
    item_number_of_purchasing_document_ebelp,
    material_number_matnr,
    plant_werks,
    po_quantity_menge,
    net_order_value_in_po_currency_netwr,
    gross_order_value_in_po_currency_brtwr,
    delivery_completed_flag_elikz,
    source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapPurchasingDocuments.datasetId,'purchasing_document_items')}
),

purchasing_headers AS (
  SELECT
    client_mandt,
    purchasing_document_number_ebeln,
    vendor_account_number_lifnr,
    purchasing_organization_ekorg,
    purchasing_document_date_bedat as order_date_bedat,
    currency_key_waers,
    source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapPurchasingDocuments.datasetId,'purchasing_document_headers')}
),

vendor_data AS (
  SELECT
    client_mandt,
    account_number_of_vendor_or_creditor_lifnr as vendor_account_number_lifnr,
    name1_name1 as vendor_name_name1,
    country_key_land1,
    central_deletion_flag_for_master_record_loevm,
    source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapVendors.datasetId,'vendors')}
  WHERE
    COALESCE(version_id_for_international_addresses_nation, '') = '${safeNation}'
    AND valid_to_date_date_to = CAST('9999-12-31' AS DATE)
),

material_data AS (
  SELECT
    client_mandt,
    material_number_matnr,
    material_text_maktx,
    material_type_mtart,
    material_group_matkl,
    source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapMaterials.datasetId,'materials')}
  WHERE
    language_key_spras = '${safeLanguage}'
),

purchasing_orgs AS (
  SELECT
    client_mandt,
    purchasing_organization_ekorg,
    purchasing_organization_text_ekotx,
    source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapPurchasingOrganizationalStructure.datasetId,'purchasing_organizations')}
),

open_quantities AS (
  SELECT
    client_mandt,
    purchasing_document_number_ebeln,
    item_number_of_purchasing_document_ebelp,
    SUM(open_quantity_amount) as open_po_net_amount,
    MAX(source_last_updated_at) as source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapPurchasingDocuments.datasetId,'purchasing_document_schedule_lines')}
  GROUP BY
    client_mandt,
    purchasing_document_number_ebeln,
    item_number_of_purchasing_document_ebelp
)

SELECT
  i.client_mandt,
  i.purchasing_document_number_ebeln,
  i.item_number_of_purchasing_document_ebelp,
  h.vendor_account_number_lifnr,
  v.vendor_name_name1,
  v.country_key_land1,
  i.material_number_matnr,
  m.material_text_maktx,
  m.material_type_mtart,
  m.material_group_matkl,
  h.purchasing_organization_ekorg,
  o.purchasing_organization_text_ekotx,

  -- Baseline financial & temporal fields
  h.order_date_bedat AS purchasing_document_date_bedat,
  i.po_quantity_menge AS purchasing_document_quantity_menge,
  i.net_order_value_in_po_currency_netwr AS purchasing_document_net_value_in_document_currency_netwr,
  i.gross_order_value_in_po_currency_brtwr AS purchasing_document_gross_value_in_document_currency_brtwr,
  i.net_order_value_in_po_currency_netwr as spend_in_document_currency,

  -- Active vendor indicator (True if not deleted)
  CASE
    WHEN v.central_deletion_flag_for_master_record_loevm = 'X' THEN false
    ELSE true
  END as active_vendor_indicator,

  -- Delivery and overdues tracking
  i.delivery_completed_flag_elikz,
  COALESCE(oq.open_po_net_amount, 0) as open_purchasing_document_net_amount,

  CASE
    WHEN i.delivery_completed_flag_elikz != 'X' AND h.order_date_bedat < DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) THEN true
    ELSE false
  END as is_overdue,

  -- Efficiency & Performance metrics
  SAFE_DIVIDE(i.net_order_value_in_po_currency_netwr, i.po_quantity_menge) as average_spend_per_unit,
  (i.gross_order_value_in_po_currency_brtwr - i.net_order_value_in_po_currency_netwr) as gross_net_variance,
  COUNT(i.item_number_of_purchasing_document_ebelp) OVER(PARTITION BY i.client_mandt, i.purchasing_document_number_ebeln) as line_item_count,
  GREATEST(
    IFNULL(i.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')),
    IFNULL(h.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')),
    IFNULL(v.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')),
    IFNULL(m.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')),
    IFNULL(o.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00')),
    IFNULL(oq.source_last_updated_at, TIMESTAMP('1900-01-01 00:00:00'))
  ) as source_last_updated_at,
  CURRENT_TIMESTAMP() as bq_loaded_at

FROM
  purchasing_items i
LEFT JOIN
  purchasing_headers h
  ON i.client_mandt = h.client_mandt
  AND i.purchasing_document_number_ebeln = h.purchasing_document_number_ebeln
LEFT JOIN
  vendor_data v
  ON h.client_mandt = v.client_mandt
  AND h.vendor_account_number_lifnr = v.vendor_account_number_lifnr
LEFT JOIN
  material_data m
  ON i.client_mandt = m.client_mandt
  AND i.material_number_matnr = m.material_number_matnr
LEFT JOIN
  purchasing_orgs o
  ON h.client_mandt = o.client_mandt
  AND h.purchasing_organization_ekorg = o.purchasing_organization_ekorg
LEFT JOIN
  open_quantities oq
  ON i.client_mandt = oq.client_mandt
  AND i.purchasing_document_number_ebeln = oq.purchasing_document_number_ebeln
  AND i.item_number_of_purchasing_document_ebelp = oq.item_number_of_purchasing_document_ebelp
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, [
    "i.source_last_updated_at",
    "h.source_last_updated_at",
    "v.source_last_updated_at",
    "m.source_last_updated_at",
    "o.source_last_updated_at",
    "oq.source_last_updated_at"
  ], "source_last_updated_at")
])}
`
);