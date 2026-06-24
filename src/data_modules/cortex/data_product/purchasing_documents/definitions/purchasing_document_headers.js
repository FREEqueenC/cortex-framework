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
const date = require("includes/cortex/date.js");
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "purchasing_document_number_ebeln"
  ]
);

publish("purchasing_document_headers", publishConfig).query(
  (ctx) => `
  WITH date_dimension as (
    ${date.getDateDimension()}
  )
  SELECT
    ekko.mandt as client_mandt,
    ekko.ebeln as purchasing_document_number_ebeln,
    ekko.loekz as deletion_flag_loekz,
    ekko.bukrs as company_code_bukrs,
    ekko.bstyp as document_category_bstyp,
    ekko.bsart as document_type_bsart,
    ekko.bsakz as control_flag_bsakz,
    ekko.loekz as deletion_flag_hdr_loekz,
    ekko.statu as status_statu,
    ekko.aedat as created_on_aedat,
    ekko.ernam as created_by_ernam,
    ekko.pincr as item_number_interval_pincr,
    ekko.lponr as last_item_number_lponr,
    ekko.lifnr as vendor_account_number_lifnr,
    ekko.spras as language_spras,
    ekko.zterm as terms_payment_key_zterm,
    ekko.zbd1t as discount_days1_zbd1_t,
    ekko.zbd2t as discount_days2_zbd2_t,
    ekko.zbd3t as discount_days3_zbd3_t,
    ekko.zbd1p as cash_discount_percentage1_zbd1_p,
    ekko.zbd2p as cash_discount_percentage2_zbd2_p,
    ekko.ekorg as purchasing_organization_ekorg,
    ekko.ekgrp as purchasing_group_ekgrp,
    ekko.waers as currency_key_waers,
    ekko.wkurs as exchange_rate_wkurs,
    ekko.kufix as flag_fixing_exchange_rate_kufix,
    ekko.bedat as purchasing_document_date_bedat,
    ekko.kdatb as start_validity_period_kdatb,
    ekko.kdate as end_validity_period_kdate,
    ekko.bwbdt as closing_datefor_applications_bwbdt,
    ekko.angdt as deadline_angdt,
    ekko.bnddt as binding_periodfor_quotation_bnddt,
    ekko.gwldt as warranty_date_gwldt,
    ekko.ausnr as bid_invitation_number_ausnr,
    ekko.angnr as quotation_number_angnr,
    ekko.ihran as quotation_submission_date_ihran,
    ekko.ihrez as your_reference_ihrez,
    ekko.verkf as vendor_salesperson_verkf,
    ekko.telf1 as vendor_telephone_telf1,
    ekko.llief as supplying_vendor_llief,
    ekko.kunnr as customer_kunnr,
    ekko.konnr as principal_purchase_agreement_konnr,
    ekko.autlf as complete_delivery_stipulated_autlf,
    ekko.weakt as goods_receipt_msg_flag_weakt,
    ekko.reswk as supply_transport_orders_reswk,
    ekko.ktwrt as area_per_distribution_value_ktwrt,
    ekko.submi as collective_number_submi,
    ekko.knumv as number_of_the_document_condition_knumv,
    ekko.kalsm as procedure_kalsm,
    ekko.stafo as update_group_statistics_stafo,
    ekko.lifre as different_invoicing_party_lifre,
    ekko.exnum as foreign_trade_document_exnum,
    ekko.unsez as our_reference_unsez,
    ekko.logsy as logical_system_logsy,
    ekko.upinc as item_number_interval_upinc,
    ekko.stako as time_dependent_conditions_stako,
    ekko.frggr as release_group_frggr,
    ekko.frgsx as release_strategy_frgsx,
    ekko.frgke as purchasing_document_release_frgke,
    ekko.frgzu as release_status_frgzu,
    ekko.frgrl as release_incomplete_frgrl,
    ekko.lands as country_for_tax_return_lands,
    ekko.lphis as scheduling_agreement_lphis,
    ekko.adrnr as address_adrnr,
    ekko.stceg_l as country_sales_tax_id_number_stceg_l,
    ekko.stceg as vat_registration_number_stceg,
    ekko.absgr as reason_for_cancellation_absgr,
    ekko.addnr as additional_document_addnr,
    ekko.kornr as correction_misc_provisions_kornr,
    ekko.memory as incomplete_flag_memory,
    ekko.procstat as processing_state_procstat,
    ekko.rlwrt as value_at_release_rlwrt,
    ekko.revno as version_number_in_purchasing_revno,
    ekko.scmproc as scm_process_scmproc,
    ekko.reason_code as goods_receipt_reason_reason_code,
    ekko.memorytype as category_incompleteness_memorytype,
    ekko.rettp as retention_flag_rettp,
    ekko.msr_id as process_identification_number_msr_id,
    ekko.hierarchy_exists as parta_contract_hierarchy_hierarchy_exists,
    ekko.threshold_exists as exchange_threshold_value_threshold_exists,
    ekko.legal_contract as legal_contract_number_legal_contract,
    ekko.description as contract_name_description,
    ekko.release_date as release_date_contract_release_date,
    ekko.handoverloc as physical_handover_handoverloc,
    ekko.force_id as internal_key_for_force_element_force_id,
    ekko.force_cnt as internal_counter_force_cnt,
    ekko.reloc_id as relocation_id_reloc_id,
    ekko.reloc_seq_id as relocation_step_id_reloc_seq_id,
    ekko.source_logsys as logical_system_source_logsys,
    ekko.vzskz as interest_calculation_flag_vzskz,
    ekko.pohf_type as seasonal_procesing_document_pohf_type,
    ekko.eq_eindt as same_delivery_date_eq_eindt,
    ekko.eq_werks as same_receiving_plant_eq_werks,
    ekko.fixpo as firm_deal_flag_fixpo,
    ekko.ekgrp_allow as take_account_purch_group_ekgrp_allow,
    ekko.werks_allow as take_account_plants_werks_allow,
    ekko.contract_allow as take_account_contracts_contract_allow,
    ekko.pstyp_allow as take_account_item_categories_pstyp_allow,
    ekko.fixpo_allow as take_account_fixed_date_fixpo_allow,
    ekko.key_id_allow as consider_budget_key_id_allow,
    ekko.aurel_allow as take_account_alloc_table_relevance_aurel_allow,
    ekko.delper_allow as take_account_dlvy_period_delper_allow,
    ekko.eindt_allow as take_account_delivery_date_eindt_allow,
    ekko.ltsnr_allow as include_vendor_subrange_ltsnr_allow,
    ekko.otb_level as otb_check_level_otb_level,
    ekko.otb_cond_type as otb_condition_type_otb_cond_type,
    ekko.key_id as unique_number_budget_key_id,
    ekko.otb_value as required_budget_otb_value,
    ekko.otb_curr as otb_currency_otb_curr,
    ekko.otb_res_value as reserved_budget_for_otb_otb_res_value,
    ekko.otb_spec_value as special_release_budget_otb_spec_value,
    ekko.budg_type as budget_type_budg_type,
    ekko.otb_status as otb_check_status_otb_status,
    ekko.otb_reason as reason_flag_for_otb_check_status_otb_reason,
    ekko.check_type as type_otb_check_check_type,
    ekko.con_otb_req as otb_relevant_contract_con_otb_req,
    ekko.con_prebook_lev as otb_flag_level_for_contracts_con_prebook_lev,
    ekko.con_distr_lev as distribution_using_target_value_or_item_data_con_distr_lev,
    dimensional_date_aedat.cal_year as year_of_change_date_aedat,
    dimensional_date_aedat.cal_month as month_of_change_date_aedat,
    dimensional_date_aedat.cal_quarter as quarter_of_change_date_aedat,
    dimensional_date_aedat.cal_week as week_of_change_date_aedat,
    dimensional_date_bedat.cal_year as year_of_purchasing_document_date_bedat,
    dimensional_date_bedat.cal_month as month_of_purchasing_document_date_bedat,
    dimensional_date_bedat.cal_quarter as quarter_of_purchasing_document_date_bedat,
    dimensional_date_bedat.cal_week as week_of_purchasing_document_date_bedat,
    IFNULL(
      ekko.recordstamp,
      TIMESTAMP('1900-01-01 00:00:00+00')
    ) as source_last_updated_at,
    CURRENT_TIMESTAMP() as bq_loaded_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ekko')} as ekko
  LEFT JOIN date_dimension as dimensional_date_aedat
    ON ekko.aedat = dimensional_date_aedat.date
  LEFT JOIN date_dimension as dimensional_date_bedat
    ON ekko.bedat = dimensional_date_bedat.date
  ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["ekko"])
  ])}
`,
);
