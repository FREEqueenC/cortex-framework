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
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

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

publish("sales_document_item_statuses", publishConfig).query(
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
  lips.fksta AS billing_status_of_delivery_fksta,
  vbap.fksaa AS billing_status_for_order_fksaa,
  vbap.absta AS rejection_status_for_sd_item_absta,
  vbap.gbsta AS overall_processing_status_of_the_sd_document_item_gbsta,
  lips.kosta AS picking_status_putaway_status_kosta,
  lips.lvsta AS status_of_warehouse_management_activities_lvsta,
  vbap.uvall AS general_incompletion_status_of_item_uvall,
  vbap.uvvlk AS incompletion_status_of_the_item_with_regard_to_delivery_uvvlk,
  vbap.uvfak AS item_incompletion_status_with_respect_to_billing_uvfak,
  vbap.uvprs AS pricing_for_item_is_incomplete_uvprs,
  lips.fkivp AS intercompany_billing_status_fkivp,
  vbap.uvp01 AS customer_reserves1_item_status_uvp01,
  vbap.uvp02 AS customer_reserves2_item_status_uvp02,
  vbap.uvp03 AS item_reserves3_item_status_uvp03,
  vbap.uvp04 AS item_reserves4_item_status_uvp04,
  vbap.uvp05 AS customer_reserves5_item_status_uvp05,
  lips.pksta AS packing_status_of_item_pksta,
  lips.koqua AS confirmation_status_of_picking_putaway_koqua,
  vbap.cmppi AS status_of_credit_check_against_financial_document_cmppi,
  vbap.cmppj AS status_of_credit_check_against_export_credit_insurance_cmppj,
  lips.uvpik AS incomplete_status_of_item_for_picking_putaway_uvpik,
  lips.uvpak AS incomplete_status_of_item_for_packaging_uvpak,
  lips.uvwak AS incomplete_status_of_item_regarding_goods_issue_uvwak,
  vbap.dcsta AS delay_status_dcsta,
  lips.vlstp AS decentralized_whse_processing_vlstp,
  vbap.fssta AS billing_block_status_for_items_fssta,
  vbap.lssta AS delivery_block_status_for_item_lssta,
  lips.pdsta AS pod_status_on_item_level_pdsta,
  vbap.manek AS manual_completion_of_contract_manek,
  lips.hdall AS inbound_delivery_item_not_yet_complete_on_hold_hdall,
  vbap.ifrs15_relevance AS ifrs15_relevance,
  GREATEST(
    IFNULL(vbap.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(lips.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbap")} AS vbap
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "lips")} AS lips
  ON
    vbap.vbeln = lips.vgbel
    AND vbap.posnr = lips.vgpos
    AND vbap.mandt = lips.mandt
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbap", "lips"])
])}
`,
);
