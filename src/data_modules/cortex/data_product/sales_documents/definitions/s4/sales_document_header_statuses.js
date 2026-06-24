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
    "sales_document_vbeln"
  ]
);

publish("sales_document_header_statuses", publishConfig).query(
  (ctx) => `
SELECT
  vbak.mandt AS client_mandt,
  vbak.vbeln AS sales_document_vbeln,
  vbak.rfstk AS reference_document_header_status_rfstk,
  vbak.rfgsk AS overall_reference_status_all_items_rfgsk,
  vbak.bestk AS confirmation_status_bestk,
  vbak.lfstk AS delivery_status_lfstk,
  vbak.lfgsk AS overall_delivery_status_lfgsk,
  vbak.wbstk AS total_goods_movement_status_wbstk,
  vbak.fksak AS order_related_billing_status_all_items_fksak,
  vbak.abstk AS rejections_status_abstk,
  vbak.gbstk AS overall_processing_status_gbstk,
  vbak.uvals AS incompletion_status_all_items_uvals,
  vbak.uvvls AS delivery_incompletion_status_all_items_uvvls,
  vbak.uvfas AS billing_incompletion_status_all_items_uvfas,
  vbak.uvall AS incompletion_status_header_uvall,
  vbak.uvvlk AS delivery_incompletion_status_header_uvvlk,
  vbak.uvfak AS billing_incompletion_status_header_uvfak,
  vbak.uvprs AS pricing_incompletion_status_all_items_uvprs,
  vbak.vbtyp AS document_category_vbtyp,
  vbak.aedat AS changed_on_aedat,
  vbak.uvk01 AS customer_reserves1_header_status_uvk01,
  vbak.uvk02 AS customer_reserves2_header_status_uvk02,
  vbak.uvk03 AS customer_reserves3_header_status_uvk03,
  vbak.uvk04 AS customer_reserves4_header_status_uvk04,
  vbak.uvk05 AS customer_reserves5_header_status_uvk05,
  vbak.uvs01 AS customer_reserves1_sum_of_all_items_uvs01,
  vbak.uvs02 AS customer_reserves2_sum_of_all_items_uvs02,
  vbak.uvs03 AS customer_reserves3_sum_of_all_items_uvs03,
  vbak.uvs04 AS customer_reserves4_sum_of_all_items_uvs04,
  vbak.uvs05 AS customer_reserves5_sum_of_all_items_uvs05,
  vbak.cmpsc AS status_of_credit_check_against_maximum_document_value_cmpsc,
  vbak.cmpsd AS status_of_credit_check_against_terms_of_payment_cmpsd,
  vbak.cmpsi AS status_of_credit_check_against_financial_document_cmpsi,
  vbak.cmpsj AS status_of_credit_check_against_export_credit_insurance_cmpsj,
  vbak.cmpsk AS status_of_credit_check_against_payment_card_authorization_cmpsk,
  vbak.cmgst AS overall_status_of_credit_checks_cmgst,
  vbak.trsta AS transportation_planning_status_header_trsta,
  vbak.costa AS confirmation_status_for_ale_costa,
  vbak.dcstk AS delay_status_dcstk,
  vbak.fsstk AS billing_block_status_fsstk,
  vbak.lsstk AS overall_delivery_block_status_all_items_lsstk,
  vbak.spstg AS overall_block_status_header_spstg,
  vbak.fmstk AS status_funds_management_fmstk,
  vbak.manek AS manual_completion_of_contract_manek,
  vbak.cmps_cm AS status_of_credit_check_sap_credit_management_cmps_cm,
  vbak.cmps_te AS status_of_technical_error_sap_credit_management_cmps_te,
  IFNULL(
    vbak.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbak")} AS vbak
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbak"])
])}
`,
);
