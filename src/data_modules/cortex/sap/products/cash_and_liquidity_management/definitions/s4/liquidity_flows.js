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

const currency = require("includes/currency.js");
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
    "flow_id_flow_id",
    "time_stamp_valid_from",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  fqm_flow.mandt AS client_mandt,
  fqm_flow.flow_id AS flow_id_flow_id,
  fqm_flow.valid_from AS time_stamp_valid_from,
  fqm_flow.valid_to AS time_stamp_valid_to,
  fqm_flow.software_version AS software_version_software_version,
  fqm_flow.flg_actual AS indicator_flg_actual,
  fqm_flow.transaction_id AS transaction_id_transaction_id,
  fqm_flow.parent_transaction_id AS parent_transaction_id_parent_transaction_id,
  fqm_flow.parent_flow_id AS parent_flow_id_parent_flow_id,
  fqm_flow.root_id AS flow_id_root_id,
  fqm_flow.deleted AS deleted_deleted,
  fqm_flow.process_status AS status_process_status,
  fqm_flow.cleared AS cleared_cleared,
  fqm_flow.clearing_flow_id AS flow_id_clearing_flow_id,
  fqm_flow.create_user AS user_name_create_user,
  fqm_flow.last_update_user AS user_name_last_update_user,
  fqm_flow.create_timestamp AS time_stamp_create_timestamp,
  fqm_flow.last_update_timestamp AS time_stamp_last_update_timestamp,
  fqm_flow.origin_system AS logical_system_origin_system,
  fqm_flow.origin_application AS source_application_origin_application,
  fqm_flow.origin_document_id AS source_document_id_origin_document_id,
  fqm_flow.origin_transaction_id AS source_transaction_id_origin_transaction_id,
  fqm_flow.origin_trans_qualifier AS source_transaction_qualifier_origin_trans_qualifier,
  fqm_flow.origin_flow_id AS source_flow_id_origin_flow_id,
  fqm_flow.origin_system_rl AS logical_system_origin_system_rl,
  fqm_flow.origin_application_rl AS source_application_origin_application_rl,
  fqm_flow.origin_document_id_rl AS source_document_id_origin_document_id_rl,
  fqm_flow.origin_transaction_id_rl AS source_transaction_id_origin_transaction_id_rl,
  fqm_flow.origin_trans_qualifier_rl AS source_transaction_qualifier_origin_trans_qualifier_rl,
  fqm_flow.origin_flow_id_rl AS source_flow_id_origin_flow_id_rl,
  fqm_flow.certainty_level AS certainty_level_certainty_level,
  fqm_flow.owner AS transaction_owner_owner,
  fqm_flow.transaction_date AS transaction_date_transaction_date,
  fqm_flow.transaction_category AS transaction_category_transaction_category,
  fqm_flow.flow_category AS flow_category_flow_category,
  fqm_flow.flow_type AS flow_type_flow_type,
  fqm_flow.rel_status AS release_status_rel_status,
  fqm_flow.payment_date AS payment_date_payment_date,
  fqm_flow.payment_currency AS currency_payment_currency,
  fqm_flow.document_date AS document_date_document_date,
  fqm_flow.baseline_date AS baseline_date_baseline_date,
  fqm_flow.days_due AS days_until_due_date_days_due,
  fqm_flow.cash_discount_days1 AS days_for_cash_discount_term_1_cash_discount_days1,
  fqm_flow.cash_discount_percent1 AS percentage_for_1st_term_cash_discount_percent1,
  fqm_flow.cash_discount_days2 AS days_for_cash_discount_term_2_cash_discount_days2,
  fqm_flow.cash_discount_percent2 AS percentage_for_2nd_term_cash_discount_percent2,
  fqm_flow.payment_method AS payment_method_payment_method,
  fqm_flow.payment_block AS payment_block_payment_block,
  fqm_flow.payment_mode AS payment_mode_payment_mode,
  fqm_flow.fund AS fund_fund,
  fqm_flow.grant_nbr AS grant_grant_nbr,
  fqm_flow.fi_document_number AS document_number_fi_document_number,
  fqm_flow.fi_document_line_item AS line_item_fi_document_line_item,
  fqm_flow.fi_fiscal_year AS fiscal_year_fi_fiscal_year,
  fqm_flow.fi_fiscal_period AS posting_period_fi_fiscal_period,
  fqm_flow.fi_credit_debit_indicator AS debit_credit_ind_fi_credit_debit_indicator,
  fqm_flow.fi_invoice_reference AS invoice_reference_fi_invoice_reference,
  fqm_flow.fi_invoice_fiscal_year_ref AS fiscal_year_fi_invoice_fiscal_year_ref,
  fqm_flow.fi_invoice_item_ref AS item_fi_invoice_item_ref,
  fqm_flow.fi_clearing_document AS clearing_document_fi_clearing_document,
  fqm_flow.fi_clearing_item AS clearing_item_fi_clearing_item,
  fqm_flow.fi_clearing_type AS type_of_clearing_in_table_ausz_clr_fi_clearing_type,
  fqm_flow.fi_post_date AS posting_date_fi_post_date,
  fqm_flow.fi_baseline_date AS baseline_payment_dte_fi_baseline_date,
  fqm_flow.fi_document_type AS document_type_fi_document_type,
  fqm_flow.fi_account_type AS account_type_fi_account_type,
  fqm_flow.fi_account AS g_l_account_fi_account,
  fqm_flow.fi_value_date AS value_date_fi_value_date,
  fqm_flow.fi_due_date AS net_due_date_fi_due_date,
  fqm_flow.fi_clearing_date AS clearing_date_fi_clearing_date,
  fqm_flow.fi_purchse_document_number AS purchasing_document_fi_purchse_document_number,
  fqm_flow.fi_purchse_line_item AS item_fi_purchse_line_item,
  fqm_flow.fi_sequential_number AS seq_no_of_account_assgt_fi_sequential_number,
  fqm_flow.fi_reverse_document_number AS reversed_with_fi_reverse_document_number,
  fqm_flow.fi_item_text AS text_fi_item_text,
  fqm_flow.fi_entry_date AS entry_date_fi_entry_date,
  fqm_flow.fi_entry_time AS time_of_entry_fi_entry_time,
  fqm_flow.fi_payment_term AS days_net_fi_payment_term,
  fqm_flow.mm_order_type AS order_type_mm_order_type,
  fqm_flow.mm_document_category AS purch_doc_category_mm_document_category,
  fqm_flow.mm_document_item_category AS item_category_mm_document_item_category,
  fqm_flow.mm_final_inv_indicator AS final_invoice_mm_final_inv_indicator,
  ${currency.amountWithDecimalShift("fqm_flow.mm_invoice_amount", "currency_decimal_currency")} AS invoice_value_tc_mm_invoice_amount,
  ${currency.amountWithDecimalShift("fqm_flow.mm_invoice_base_amount", "currency_decimal_base_currency")} AS invoice_value_lc_mm_invoice_base_amount,
  ${currency.amountWithDecimalShift("fqm_flow.lp_disc_amount1", "currency_decimal_currency")} AS discount_amount1_lp_disc_amount1,
  ${currency.amountWithDecimalShift("fqm_flow.lp_disc_amount2", "currency_decimal_currency")} AS discount_amount2_lp_disc_amount2,
  fqm_flow.lp_planed_payment_date1 AS planned_payment_date1_lp_planed_payment_date1,
  fqm_flow.lp_planed_payment_date2 AS planned_payment_date2_lp_planed_payment_date2,
  ${currency.amountWithDecimalShift("fqm_flow.base_amount", "currency_decimal_base_currency")} AS amount_base_amount,
  fqm_flow.base_currency AS currency_base_currency,
  ${currency.amountWithDecimalShift("fqm_flow.amount", "currency_decimal_currency")} AS amount_amount,
  fqm_flow.currency AS currency_currency,
  fqm_flow.quantity AS quantity_quantity,
  fqm_flow.unit_of_measure AS unit_unit_of_measure,
  fqm_flow.trm_product_type AS product_type_trm_product_type,
  fqm_flow.trm_transaction_type AS transaction_type_trm_transaction_type,
  fqm_flow.trm_activity_category AS activity_category_trm_activity_category,
  fqm_flow.trm_security_id AS sec_class_id_number_trm_security_id,
  fqm_flow.trm_security_account AS securities_account_trm_security_account,
  fqm_flow.trm_portfolio AS portfolio_trm_portfolio,
  fqm_flow.house_bank AS house_bank_house_bank,
  fqm_flow.house_bank_account AS account_id_house_bank_account,
  fqm_flow.bank_account_id AS technical_id_bank_account_id,
  fqm_flow.company_code AS company_code_company_code,
  fqm_flow.customer_number AS customer_customer_number,
  fqm_flow.vendor_number AS vendor_vendor_number,
  fqm_flow.partner AS business_partner_partner,
  fqm_flow.material AS material_material,
  fqm_flow.business_area AS business_area_business_area,
  fqm_flow.profit_center AS profit_center_profit_center,
  fqm_flow.project AS wbs_element_project,
  fqm_flow.cost_center AS cost_center_cost_center,
  fqm_flow.trading_partner AS trading_partner_no_trading_partner,
  fqm_flow.liquidity_item AS liquidity_item_liquidity_item,
  fqm_flow.segment AS segment_segment,
  fqm_flow.planning_level AS planning_level_planning_level,
  fqm_flow.planning_group AS planning_group_planning_group,
  fqm_flow.contract_number AS contract_number_contract_number,
  fqm_flow.contract_type AS contract_type_contract_type,
  fqm_flow.assigned_company_code AS company_code_assigned_company_code,
  fqm_flow.internal_reference AS internal_reference_internal_reference,
  fqm_flow.characteristics AS characteristics_characteristics,
  fqm_flow.assignment AS assignment_assignment,
  fqm_flow.cmm_interest_rate AS interest_rate_cmm_interest_rate,
  fqm_flow.cmm_calendar_type AS calendar_type_cmm_calendar_type,
  fqm_flow.cmm_state AS state_for_cmr_cmm_state,
  fqm_flow.cmm_exchange_rate_type AS exchange_rate_type_cmm_exchange_rate_type,
  fqm_flow.cmm_inverted_rate_type AS inverted_rate_entry_cmm_inverted_rate_type,
  fqm_flow.cmm_offset_account AS offsetting_account_cmm_offset_account,
  fqm_flow.cmm_offset_accid AS offsetting_bank_account_cmm_offset_accid,
  fqm_flow.cmm_transaction_type AS transaction_type_cmm_transaction_type,
  fqm_flow.cmm_statistics_indicator AS statistics_indicator_cmm_statistics_indicator,
  fqm_flow.cmm_payment_group AS id_number_cmm_payment_group,
  fqm_flow.cmm_reason AS cm_pairing_cmm_reason,
  fqm_flow.cmm_auth_rel AS authorization_and_release_flag_cmm_auth_rel,
  fqm_flow.cmm_bs_num_eb AS memo_record_number_cmm_bs_num_eb,
  fqm_flow.cmm_offset_bank_account_number AS account_number_cmm_offset_bank_account_number,
  fqm_flow.cmm_offset_housebank AS house_bank_cmm_offset_housebank,
  fqm_flow.cmm_offset_housebankaccount AS account_id_cmm_offset_housebankaccount,
  fqm_flow.cashrequest_id AS cash_request_id_cashrequest_id,
  fqm_flow.cashrequest_status AS cash_request_status_cashrequest_status,
  fqm_flow.instrument_category AS instrument_category_instrument_category,
  fqm_flow.following_currency AS following_currency_following_currency,
  ${currency.amountWithDecimalShift("fqm_flow.amount_in_folcur", "currency_decimal_following_currency")} AS amount_amount_in_folcur,
  fqm_flow.buy_sell_indicator AS buy_sell_buy_sell_indicator,
  fqm_flow.following_account AS technical_id_following_account,
  fqm_flow.flag_document AS checkbox_flag_document,
  fqm_flow.cq_assignment AS assignment_cq_assignment,
  fqm_flow.cq_internal_reference AS internal_reference_cq_internal_reference,
  fqm_flow.cq_characteristics AS characteristics_cq_characteristics,
  fqm_flow.following_companycode AS company_code_following_companycode,
  fqm_flow.following_bankdetail AS bank_details_id_following_bankdetail,
  fqm_flow.following_housebank AS house_bank_following_housebank,
  fqm_flow.following_housebankaccount AS account_id_following_housebankaccount,
  fqm_flow.mmk_term_from_date AS value_date_mmk_term_from_date,
  fqm_flow.mmk_term_to_date AS value_date_mmk_term_to_date,
  fqm_flow.mmk_invest_borrow AS invest_or_borrow_mmk_invest_borrow,
  fqm_flow.mmk_max_term_from_date AS value_date_mmk_max_term_from_date,
  fqm_flow.mmk_max_term_to_date AS value_date_mmk_max_term_to_date,
  fqm_flow.mmk_offset_flag AS flag_mmk_offset_flag,
  fqm_flow.cashrequest_subimitted_by AS submitted_by_cashrequest_subimitted_by,
  fqm_flow.term_from_date AS value_date_term_from_date,
  fqm_flow.term_to_date AS value_date_term_to_date,
  ${currency.amountWithDecimalShift("fqm_flow.amount_requested", "currency_decimal_currency_requested")} AS amount_amount_requested,
  fqm_flow.currency_requested AS currency_currency_requested,
  fqm_flow.invest_borrow AS invest_or_borrow_invest_borrow,
  fqm_flow.max_term_from_date AS value_date_max_term_from_date,
  fqm_flow.max_term_to_date AS value_date_max_term_to_date,
  fqm_flow.fca_bp AS business_partner_fca_bp,
  fqm_flow.fca_account_number AS contract_account_fca_account_number,
  fqm_flow.fca_doc_number AS document_number_fca_doc_number,
  fqm_flow.fca_docitem_number AS item_fca_docitem_number,
  fqm_flow.fca_clearing_reason AS clearing_reason_fca_clearing_reason,
  fqm_flow.fca_origin_key AS origin_fca_origin_key,
  fqm_flow.fca_bt_category AS bus_transac_type_fca_bt_category,
  ${currency.amountWithDecimalShift("fqm_flow.fca_tax_amt", "currency_decimal_currency")} AS amount_fca_tax_amt,
  fqm_flow.ltype AS link_type_ltype,
  fqm_flow.lnkid AS link_id_lnkid,
  IFNULL(fqm_flow.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "fqm_flow")} AS fqm_flow
LEFT JOIN currency_decimal AS currency_decimal_currency
  ON fqm_flow.currency = currency_decimal_currency.currkey
LEFT JOIN currency_decimal AS currency_decimal_base_currency
  ON fqm_flow.base_currency = currency_decimal_base_currency.currkey
LEFT JOIN currency_decimal AS currency_decimal_following_currency
  ON fqm_flow.following_currency = currency_decimal_following_currency.currkey
LEFT JOIN currency_decimal AS currency_decimal_currency_requested
  ON fqm_flow.currency_requested = currency_decimal_currency_requested.currkey
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, "fqm_flow"),
])}
`
);
