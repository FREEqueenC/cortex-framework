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
    "purch_document_category_bstyp",
    "purchasing_document_type_bsart",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t161.mandt AS client_mandt,
  t161.bstyp AS purch_document_category_bstyp,
  t161.bsart AS purchasing_document_type_bsart,
  t161t.spras AS language_key_spras,
  t161t.batxt AS purchasing_document_type_description_batxt,
  t161.bsakz AS control_indicator_bsakz,
  t161.pincr AS item_number_interval_pincr,
  t161.numki AS number_range_int_asst_numki,
  t161.numke AS number_range_ext_asst_numke,
  t161.brefn AS field_selection_key_brefn,
  t161.refba AS reference_document_type_refba,
  t161.abvor AS stdrd_rel_order_quantity_abvor,
  t161.stafo AS update_group_stats_stafo,
  t161.upinc AS subitem_interval_upinc,
  t161.stako AS time_dep_conditions_stako,
  t161.pargr AS partnerdetermproced_pargr,
  t161.numka AS number_range_ale_numka,
  t161.hityp AS supplier_hierarchy_cat_hityp,
  t161.lphis AS rel_documentation_lphis,
  t161.gsfrg AS overall_release_of_requisitions_gsfrg,
  t161.variante AS layout_variante,
  t161.shenq AS shared_lock_only_shenq,
  t161.kzale AS ale_distr_contract_kzale,
  t161.abgebot AS global_perc_bid_abgebot,
  t161.kornr AS corr_misc_provis_kornr,
  t161.umlif AS supplier_data_umlif,
  t161.koett AS contract_with_delivery_schedule_koett,
  t161.ar_object AS document_type_ar_object,
  t161.koako AS contract_allowed_as_release_order_against_contract_koako,
  t161.oicsegi AS quantity_sched_permitted_oicsegi,
  t161.oirfqreq AS precedence_f_rfq_req_oirfqreq,
  t161.wvvkz AS further_processing_summar_docs_wvvkz,
  t161.xlokz AS cross_system_transit_xlokz,
  t161.cp_aktive AS activation_of_comm_plan_cp_aktive,
  t161.cptype AS comm_plan_category_cptype,
  t161.fls_rsto AS enh_store_return_fls_rsto,
  t161.msr_active AS adv_returns_active_msr_active,
  t161.rdp_profile AS rdp_profile,
  t161.numkc AS srm_contract_number_range_numkc,
  t161.qtn_fol_doc_draft_autom AS indicator_for_follow_on_docs_of_quot_qtn_fol_document_draft_autom,
  t161.qtn_fol_doc_active_autom AS indicator_for_follow_on_docs_of_quot_qtn_fol_document_active_autom,
  t161.qtn_fol_doc_manually AS indicator_for_follow_on_docs_of_quot_qtn_fol_document_manually,
  t161.rfq_process_type AS rfq_external_processing_rfq_process_type,
  t161.scnr_based_wfl AS flexible_workflow_scnr_based_wfl,
  t161.rfx_processing_cd AS rfq_awarding_type_rfx_processing_cd,
  t161.itmac AS trade_compliance_itmac,
  t161.sapmp_ceact AS fastdataentry_of_chars_is_active_sapmp_ceact,
  t161.sapmp_pdact AS inheritance_is_activated_sapmp_pdact,
  t161.sapmp_pprot AS inheritance_log_sapmp_pprot,
  t161.sapmp_puser AS inheritance_overwrite_user_values_sapmp_puser,
  t161.sapmp_pausw AS inheritance_of_char_selection_list_sapmp_pausw,
  t161.sapmp_atnam AS characteristic_name_sapmp_atnam,
  t161.sapmp_gauf AS global_local_group_may_be_undone_sapmp_gauf,
  t161.tolsl AS tolerance_key_tolsl,
  t161.fsh_vas_act AS vas_active_flag_fsh_vas_act,
  t161.fsh_vas_kalsm AS determination_procedure_fsh_vas_kalsm,
  t161.fsh_vas_del AS vas_deletion_criteria_fsh_vas_del,
  t161.fsh_vas_detdt AS vas_determination_date_fsh_vas_detdt,
  t161.fsh_excl_return AS excl_return_items_fsh_excl_return,
  t161.fsh_var_kalsm AS determination_procedure_fsh_var_kalsm,
  t161.fsh_dpr_detpro AS determination_procedure_fsh_dpr_detpro,
  t161.fsh_po_idoc AS generic_material_creation_fsh_po_idoc,
  t161.fsh_vas_corr AS vas_quantity_correlation_fsh_vas_corr,
  t161.fsh_auto_dc AS auto_distribution_fsh_auto_dc,
  t161.fsh_vm_act AS variants_optional_fsh_vm_act,
  t161.rfm_contract_cons AS contract_consumption_by_po_items_rfm_contract_cons,
  t161.rfm_contract_detr AS contract_determination_for_po_items_rfm_contract_detr,
  t161.mill_omkz AS use_reference_characteristics_mill_omkz,
  t161.sgt_cont_seg_ignore AS allow_blank_segment_in_purchase_contract_sgt_cont_seg_ignore,
  t161.wrf_enable_dateline AS enable_dateline_wrf_enable_dateline,
  GREATEST(
    IFNULL(t161.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t161t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t161")} AS t161
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t161t")} AS t161t
  ON
    t161.mandt = t161t.mandt
    AND t161.bstyp = t161t.bstyp
    AND t161.bsart = t161t.bsart
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t161", "t161t"])
])}
`
);
