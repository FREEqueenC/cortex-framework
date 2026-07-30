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
    "sales_document_vbeln",
    "sales_document_item_posnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  vbap.mandt AS client_mandt,
  vbap.vbeln AS sales_document_vbeln,
  vbap.posnr AS sales_document_item_posnr,
  vbap.rfsta AS reference_status_rfsta,
  vbap.rfgsa AS overall_status_of_reference_rfgsa,
  vbap.besta AS confirmation_status_of_document_item_besta,
  vbap.lfsta AS delivery_status_lfsta,
  vbap.lfgsa AS overall_delivery_status_of_the_item_lfgsa,
  vbap.wbsta AS goods_movement_status_wbsta,
  vbap.fksaa AS billing_status_for_order_fksaa,
  vbap.absta AS rejection_status_for_sd_item_absta,
  vbap.gbsta AS overall_processing_status_of_the_sd_document_item_gbsta,
  vbap.uvall AS general_incompletion_status_of_item_uvall,
  vbap.uvvlk AS incompletion_status_of_the_item_with_regard_to_delivery_uvvlk,
  vbap.uvfak AS item_incompletion_status_with_respect_to_billing_uvfak,
  vbap.uvprs AS pricing_for_item_is_incomplete_uvprs,
  vbap.uvp01 AS customer_reserves1_item_status_uvp01,
  vbap.uvp02 AS customer_reserves2_item_status_uvp02,
  vbap.uvp03 AS item_reserves3_item_status_uvp03,
  vbap.uvp04 AS item_reserves4_item_status_uvp04,
  vbap.uvp05 AS customer_reserves5_item_status_uvp05,
  vbap.cmppi AS status_of_credit_check_against_financial_document_cmppi,
  vbap.cmppj AS status_of_credit_check_against_export_credit_insurance_cmppj,
  vbap.dcsta AS delay_status_dcsta,
  vbap.fssta AS billing_block_status_for_items_fssta,
  vbap.lssta AS delivery_block_status_for_item_lssta,
  vbap.manek AS manual_completion_of_contract_manek,
  vbap.ifrs15_relevance AS ifrs15_relevance,
  IFNULL(vbap.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbap")} AS vbap
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbap"])
])}
`,
);
