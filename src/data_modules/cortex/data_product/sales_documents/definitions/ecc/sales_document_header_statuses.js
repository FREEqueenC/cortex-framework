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
  vbuk.mandt AS client_mandt,
  vbuk.vbeln AS sales_document_vbeln,
  vbuk.rfstk AS reference_document_header_status_rfstk,
  vbuk.rfgsk AS overall_reference_status_all_items_rfgsk,
  vbuk.bestk AS confirmation_status_bestk,
  vbuk.lfstk AS delivery_status_lfstk,
  vbuk.lfgsk AS overall_delivery_status_lfgsk,
  vbuk.wbstk AS total_goods_movement_status_wbstk,
  vbuk.fkstk AS billing_status_fkstk,
  vbuk.fksak AS order_related_billing_status_all_items_fksak,
  vbuk.buchk AS posting_status_of_billing_document_buchk,
  vbuk.abstk AS rejections_status_abstk,
  vbuk.gbstk AS overall_processing_status_gbstk,
  vbuk.kostk AS overall_picking_putaway_status_kostk,
  vbuk.lvstk AS overall_status_of_warehouse_management_activities_lvstk,
  vbuk.uvals AS incompletion_status_all_items_uvals,
  vbuk.uvvls AS delivery_incompletion_status_all_items_uvvls,
  vbuk.uvfas AS billing_incompletion_status_all_items_uvfas,
  vbuk.uvall AS incompletion_status_header_uvall,
  vbuk.uvvlk AS delivery_incompletion_status_header_uvvlk,
  vbuk.uvfak AS billing_incompletion_status_header_uvfak,
  vbuk.uvprs AS pricing_incompletion_status_all_items_uvprs,
  vbuk.vbtyp AS document_category_vbtyp,
  vbuk.vbobj AS sd_document_object_vbobj,
  vbuk.aedat AS changed_on_aedat,
  vbuk.fkivk AS billing_totals_status_for_intercompany_billing_fkivk,
  vbuk.relik AS invoice_list_status_of_billing_document_relik,
  vbuk.uvk01 AS customer_reserves1_header_status_uvk01,
  vbuk.uvk02 AS customer_reserves2_header_status_uvk02,
  vbuk.uvk03 AS customer_reserves3_header_status_uvk03,
  vbuk.uvk04 AS customer_reserves4_header_status_uvk04,
  vbuk.uvk05 AS customer_reserves5_header_status_uvk05,
  vbuk.uvs01 AS customer_reserves1_sum_of_all_items_uvs01,
  vbuk.uvs02 AS customer_reserves2_sum_of_all_items_uvs02,
  vbuk.uvs03 AS customer_reserves3_sum_of_all_items_uvs03,
  vbuk.uvs04 AS customer_reserves4_sum_of_all_items_uvs04,
  vbuk.uvs05 AS customer_reserves5_sum_of_all_items_uvs05,
  vbuk.pkstk AS overall_packing_status_of_all_items_pkstk,
  vbuk.cmpsa AS status_of_static_credit_limit_check_cmpsa,
  vbuk.cmpsb AS status_of_dynamic_credit_limit_check_in_the_credit_horizon_cmpsb,
  vbuk.cmpsc AS status_of_credit_check_against_maximum_document_value_cmpsc,
  vbuk.cmpsd AS status_of_credit_check_against_terms_of_payment_cmpsd,
  vbuk.cmpse AS status_of_credit_check_against_customer_review_date_cmpse,
  vbuk.cmpsf AS status_of_credit_check_against_open_items_due_cmpsf,
  vbuk.cmpsg AS status_of_credit_check_against_oldest_open_items_cmpsg,
  vbuk.cmpsh AS status_of_credit_check_against_highest_dunning_level_cmpsh,
  vbuk.cmpsi AS status_of_credit_check_against_financial_document_cmpsi,
  vbuk.cmpsj AS status_of_credit_check_against_export_credit_insurance_cmpsj,
  vbuk.cmpsk AS status_of_credit_check_against_payment_card_authorization_cmpsk,
  vbuk.cmpsl AS status_of_credit_check_of_reserves4_cmpsl,
  vbuk.cmps0 AS status_of_credit_check_for_customer_reserve1_cmps0,
  vbuk.cmps1 AS status_of_credit_check_for_customer_reserve2_cmps1,
  vbuk.cmps2 AS status_of_credit_check_for_customer_reserve2_cmps2,
  vbuk.cmgst AS overall_status_of_credit_checks_cmgst,
  vbuk.trsta AS transportation_planning_status_header_trsta,
  vbuk.koquk AS status_of_pick_confirmation_koquk,
  vbuk.costa AS confirmation_status_for_ale_costa,
  vbuk.saprl AS sap_release_saprl,
  vbuk.uvpas AS totals_incomplete_status_for_all_items_packaging_uvpas,
  vbuk.uvpis AS totals_incomplete_status_for_all_items_picking_uvpis,
  vbuk.uvwas AS total_incomplete_status_of_all_items_post_goods_movement_uvwas,
  vbuk.uvpak AS header_incomplete_status_for_packaging_uvpak,
  vbuk.uvpik AS header_incomplete_status_for_picking_putaway_uvpik,
  vbuk.uvwak AS post_header_incomplete_status_for_goods_movement_uvwak,
  vbuk.uvgek AS unused_uvgek,
  vbuk.cmpsm AS credit_check_data_is_obsolete_cmpsm,
  vbuk.dcstk AS delay_status_dcstk,
  vbuk.vestk AS handling_unit_placed_in_stock_vestk,
  vbuk.vlstk AS distribution_status_decentralized_warehouse_processing_vlstk,
  vbuk.rrsta AS revenue_determination_status_rrsta,
  vbuk.block AS indicator_document_preselected_for_archiving_block,
  vbuk.fsstk AS billing_block_status_fsstk,
  vbuk.lsstk AS overall_delivery_block_status_all_items_lsstk,
  vbuk.spstg AS overall_block_status_header_spstg,
  vbuk.pdstk AS pod_status_on_header_level_pdstk,
  vbuk.fmstk AS status_funds_management_fmstk,
  vbuk.manek AS manual_completion_of_contract_manek,
  vbuk.spe_tmpid AS temporary_inbound_delivery_spe_tmpid,
  vbuk.hdall AS inbound_delivery_header_not_yet_complete_on_hold_hdall,
  vbuk.hdals AS at_least_one_of_id_items_not_yet_complete_on_hold_hdals,
  vbuk.vbtyp_ext AS extension_of_sd_document_category_vbtyp_ext,
  IFNULL(
    vbuk.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbuk")} AS vbuk
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbuk"])
])}
`,
);
