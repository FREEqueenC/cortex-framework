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
  vbup.mandt AS client_mandt,
  vbup.vbeln AS sales_document_vbeln,
  vbup.posnr AS sales_document_item_posnr,
  vbup.rfsta AS reference_status_rfsta,
  vbup.rfgsa AS overall_status_of_reference_rfgsa,
  vbup.besta AS confirmation_status_of_document_item_besta,
  vbup.lfsta AS delivery_status_lfsta,
  vbup.lfgsa AS overall_delivery_status_of_the_item_lfgsa,
  vbup.wbsta AS goods_movement_status_wbsta,
  vbup.fksta AS billing_status_of_delivery_fksta,
  vbup.fksaa AS billing_status_for_order_fksaa,
  vbup.absta AS rejection_status_for_sd_item_absta,
  vbup.gbsta AS overall_processing_status_of_the_sd_document_item_gbsta,
  vbup.kosta AS picking_status_putaway_status_kosta,
  vbup.lvsta AS status_of_warehouse_management_activities_lvsta,
  vbup.uvall AS general_incompletion_status_of_item_uvall,
  vbup.uvvlk AS incompletion_status_of_the_item_with_regard_to_delivery_uvvlk,
  vbup.uvfak AS item_incompletion_status_with_respect_to_billing_uvfak,
  vbup.uvprs AS pricing_for_item_is_incomplete_uvprs,
  vbup.fkivp AS intercompany_billing_status_fkivp,
  vbup.uvp01 AS customer_reserves1_item_status_uvp01,
  vbup.uvp02 AS customer_reserves2_item_status_uvp02,
  vbup.uvp03 AS item_reserves3_item_status_uvp03,
  vbup.uvp04 AS item_reserves4_item_status_uvp04,
  vbup.uvp05 AS customer_reserves5_item_status_uvp05,
  vbup.pksta AS packing_status_of_item_pksta,
  vbup.koqua AS confirmation_status_of_picking_putaway_koqua,
  vbup.cmppi AS status_of_credit_check_against_financial_document_cmppi,
  vbup.cmppj AS status_of_credit_check_against_export_credit_insurance_cmppj,
  vbup.uvpik AS incomplete_status_of_item_for_picking_putaway_uvpik,
  vbup.uvpak AS incomplete_status_of_item_for_packaging_uvpak,
  vbup.uvwak AS incomplete_status_of_item_regarding_goods_issue_uvwak,
  vbup.dcsta AS delay_status_dcsta,
  vbup.rrsta AS revenue_determination_status_rrsta,
  vbup.vlstp AS decentralized_whse_processing_vlstp,
  vbup.fssta AS billing_block_status_for_items_fssta,
  vbup.lssta AS delivery_block_status_for_item_lssta,
  vbup.pdsta AS pod_status_on_item_level_pdsta,
  vbup.manek AS manual_completion_of_contract_manek,
  vbup.hdall AS inbound_delivery_item_not_yet_complete_on_hold_hdall,
  IFNULL(
    vbup.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbup")} AS vbup
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbup"])
])}
`,
);
