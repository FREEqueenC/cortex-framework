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
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "language_key_spras",
    "movement_type_bwart",
    "special_stock_sobkz",
    "movement_indicator_kzbew",
    "receipt_indicator_kzzug",
    "consumption_related_movement_type_kzvbr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
    (ctx) => `
SELECT
  t156.mandt as client_mandt,
  t156t.spras as language_key_spras,
  t156.bwart as movement_type_bwart,
  t156t.sobkz as special_stock_sobkz,
  t156t.kzbew as movement_indicator_kzbew,
  t156t.kzzug as receipt_indicator_kzzug,
  t156t.kzvbr as consumption_related_movement_type_kzvbr,
  t156t.btext as movement_type_text_btext,
  t156.bustr as posting_string_ref_bustr,
  t156.chneu as create_new_batch_chneu,
  t156.kzbwa as movement_type_category_kzbwa,
  t156.kzcla as batch_classification_kzcla,
  t156.kzdir as direction_indicator_kzdir,
  t156.kzdru as print_item_kzdru,
  t156.kzgru as control_reason_kzgru,
  t156.kzkon as account_control_kzkon,
  t156.kzmhd as check_shelf_life_expiry_date_kzmhd,
  t156.kzstr as statistically_relev_kzstr,
  t156.kzvbu as consumption_posting_type_kzvbu,
  t156.kzwes as goods_receipt_blocked_stock_kzwes,
  t156.kzzde as maintain_batch_status_data_kzzde,
  t156.qssbw as qa_inspection_test_qssbw,
  t156.rstyp as account_assignment_of_reservation_rstyp,
  t156.rules as stock_determination_rule_rules,
  t156.selpa as selection_parameter_selpa,
  t156.shkzg as debit_credit_indicator_shkzg,
  t156.xinvb as generate_physical_inventory_document_xinvb,
  t156.xkcfc as extended_classification_xkcfc,
  t156.xkoko as cost_element_account_xkoko,
  t156.xlaut as storage_location_creation_automatic_xlaut,
  t156.xnebe as automatic_purchase_order_xnebe,
  t156.xoarc as storage_upon_goods_movement_active_indicator_xoarc,
  t156.xpbed as independent_requirements_reduction_xpbed,
  t156.xstbw as reversal_movement_type_indicator_xstbw,
  t156.xwipb as movement_type_allows_wip_batches_xwipb,
  t156.xwsbr as reversal_goods_receipt_despite_invoice_receipt_xwsbr,
  GREATEST(
    IFNULL(t156.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t156t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t156")} AS t156
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t156t")} AS t156t
  ON t156.mandt = t156t.mandt
  AND t156.bwart = t156t.bwart
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t156", "t156t"])
])}
`
);
