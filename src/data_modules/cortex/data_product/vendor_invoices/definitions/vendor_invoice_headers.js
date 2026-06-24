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
const currency = require("includes/cortex/currency.js");
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
    "invoice_document_number_belnr",
    "fiscal_year_gjahr"
  ]
);

publish("vendor_invoice_headers", publishConfig).query(
  (ctx) => `
  WITH date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
  SELECT
    rbkp.mandt AS client_mandt,
    rbkp.gjahr AS fiscal_year_gjahr,
    rbkp.belnr AS invoice_document_number_belnr,
    rbkp.blart AS document_type_blart,
    rbkp.bldat AS document_date_bldat,
    rbkp.budat AS posting_date_budat,
    rbkp.usnam AS user_name_usnam,
    rbkp.tcode AS transaction_code_tcode,
    rbkp.cpudt AS entry_date_cpudt,
    rbkp.cputm AS entry_time_cputm,
    rbkp.vgart AS transaction_type_vgart,
    rbkp.xblnr AS reference_xblnr,
    rbkp.lifnr AS invoicing_party_lifnr,
    rbkp.waers AS currency_key_waers,
    rbkp.kursf AS exchange_rate_kursf,
    ${currency.amountWithDecimalShift("rbkp.rmwwr", "currency_decimal")} AS gross_invoice_amount_rmwwr,
    ${currency.amountWithDecimalShift("rbkp.beznk", "currency_decimal")} AS unplanned_delivery_costs_beznk,
    ${currency.amountWithDecimalShift("rbkp.wmwst1", "currency_decimal")} AS value_added_tax_wmwst1,
    rbkp.mwskz1 AS tax_code_mwskz1,
    rbkp.mwskz2 AS notinuse_mwskz2,
    rbkp.zterm AS terms_payment_key_zterm,
    rbkp.zbd1t AS discount_days1_zbd1t,
    rbkp.zbd1p AS cash_discount_percentage1_zbd1p,
    rbkp.zbd2t AS discount_days2_zbd2t,
    rbkp.zbd2p AS cash_discount_percentage2_zbd2p,
    rbkp.zbd3t AS discount_days_net_zbd3t,
    ${currency.amountWithDecimalShift("rbkp.wskto", "currency_decimal")} AS discount_amount_wskto,
    rbkp.xrech AS invoice_indicator_xrech,
    rbkp.bktxt AS document_header_text_bktxt,
    rbkp.saprl AS sap_release_saprl,
    rbkp.logsys AS logical_system_logsy,
    rbkp.xmwst AS calculate_tax_indicator_xmwst,
    rbkp.stblg AS reversed_by_document_stblg,
    rbkp.stjah AS reversal_fiscal_year_stjah,
    rbkp.mwskz_bnk AS tax_code_mwskz_bnk,
    rbkp.txjcd_bnk AS tax_jurisdiction_txjcd_bnk,
    rbkp.ivtyp AS invoice_verification_category_ivtyp,
    rbkp.xrbtx AS several_tax_codes_indicator_xrbtx,
    rbkp.repart AS invoice_verification_type_repart,
    rbkp.rbstat AS invoice_status_rbstat,
    rbkp.knumve AS document_condition_number_knumve,
    rbkp.knumvl AS supplier_condition_number_knumvl,
    rbkp.arkuen AS invoice_reduction_amount_arkuen,
    rbkp.arkuemw AS tax_amount_invoice_reduction_arkuemw,
    rbkp.makzn AS manually_accepted_net_amount_makzn,
    rbkp.makzmw AS manually_accepted_tax_amount_makzmw,
    rbkp.lieffn AS supplier_error_net_amount_lieffn,
    rbkp.lieffmw AS supplier_error_tax_amount_lieffmw,
    rbkp.xautakz AS automatically_accepted_indicator_xautakz,
    rbkp.esrnr AS isr_number_esrnr,
    rbkp.esrpz AS check_digit_esrpz,
    rbkp.esrre AS isr_qr_reference_esrre,
    ${currency.amountWithDecimalShift("rbkp.qsshb", "currency_decimal")} AS withholding_tax_base_amount_qsshb,
    ${currency.amountWithDecimalShift("rbkp.qsfbt", "currency_decimal")} AS withholding_tax_exempt_amount_qsfbt,
    rbkp.qsskz AS withholding_tax_code_qsskz,
    rbkp.diekz AS service_indicator_diekz,
    rbkp.landl AS supplying_country_landl,
    rbkp.lzbkz AS scb_indicator_lzbkz,
    rbkp.txkrs AS exchange_rate_for_taxes_txkrs,
    rbkp.ctxkrs AS tax_rate_local_currency_ctxkrs,
    rbkp.empfb AS payer_empfb,
    rbkp.bvtyp AS partner_bank_type_bvtyp,
    rbkp.hbkid AS house_bank_hbkid,
    rbkp.zuonr AS assignment_number_zuonr,
    rbkp.zlspr AS payment_block_key_zlspr,
    rbkp.zlsch AS payment_method_zlsch,
    rbkp.zfbdt AS baseline_payment_date_zfbdt,
    rbkp.kidno AS payment_reference_kidno,
    rbkp.rebzg AS invoice_reference_rebzg,
    rbkp.rebzj AS invoice_reference_fiscal_year_rebzj,
    rbkp.xinve AS investment_id_xinve,
    rbkp.egmld AS reporting_country_egmld,
    rbkp.xegdr AS eu_triangular_deal_indicator_xegdr,
    rbkp.vatdate AS tax_reporting_date_vatdate,
    rbkp.hkont AS general_ledger_account_hkont,
    rbkp.j_1bnftype AS nota_fiscal_type_j_1bnftype,
    rbkp.brnch AS branch_number_brnch,
    rbkp.erfpr AS entry_profile_erfpr,
    rbkp.secco AS section_code_secco,
    rbkp.name1 AS vendor_name1_name1,
    rbkp.name2 AS vendor_name2_name2,
    rbkp.name3 AS vendor_name3_name3,
    rbkp.name4 AS vendor_name4_name4,
    rbkp.pstlz AS postal_code_pstlz,
    rbkp.ort01 AS city_ort01,
    rbkp.land1 AS country_land1,
    rbkp.stras AS street_stras,
    rbkp.pfach AS po_box_pfach,
    rbkp.pstl2 AS po_box_postal_code_pstl2,
    rbkp.pskto AS post_office_bank_account_number_pskto,
    rbkp.bankn AS bank_account_number_bankn,
    rbkp.bankl AS bank_routing_number_bankl,
    rbkp.banks AS bank_country_banks,
    rbkp.stcd1 AS tax_number1_stcd1,
    rbkp.stcd2 AS tax_number2_stcd2,
    rbkp.stkzu AS liable_for_vat_indicator_stkzu,
    rbkp.stkza AS sales_equalization_tax_indicator_stkza,
    rbkp.regio AS region_regio,
    rbkp.bkont AS bank_control_key_bkont,
    rbkp.dtaws AS instruction_key_dtaws,
    rbkp.dtams AS dme_indicator_dtams,
    rbkp.spras AS language_key_spras,
    rbkp.xcpdk AS one_time_account_indicator_xcpdk,
    rbkp.empfg AS payment_recipient_empfg,
    rbkp.fityp AS tax_type_fityp,
    rbkp.stcdt AS tax_number_type_stcdt,
    rbkp.stkzn AS natural_person_indicator_stkzn,
    rbkp.stcd3 AS tax_number3_stcd3,
    rbkp.stcd4 AS tax_number4_stcd4,
    rbkp.bkref AS reference_details_bkref,
    rbkp.j_1kfrepre AS representative_name_j_1kfrepre,
    rbkp.j_1kftbus AS business_type_j_1kftbus,
    rbkp.j_1kftind AS industry_type_j_1kftind,
    rbkp.anred AS title_anred,
    rbkp.stceg AS vat_registration_number_stceg,
    rbkp.ername AS created_by_user_ername,
    rbkp.reindat AS invoice_receipt_date_reindat,
    rbkp.uzawe AS payment_method_supplement_uzawe,
    rbkp.fdlev AS planning_level_fdlev,
    rbkp.fdtag AS planning_date_fdtag,
    rbkp.zbfix AS payment_terms_fixed_indicator_zbfix,
    rbkp.frgkz AS release_indicator_frgkz,
    rbkp.erfnam AS entered_by_user_erfnam,
    rbkp.bupla AS business_place_bupla,
    rbkp.filkd AS branch_account_filkd,
    rbkp.lotkz AS lot_number_lotkz,
    rbkp.sgtxt AS document_text_sgtxt,
    rbkp.inv_tran AS transaction_inv_tran,
    rbkp.prepay_status AS prepayment_status_prepay_status,
    rbkp.prepay_awkey AS prepayment_invoice_number_prepay_awkey,
    rbkp.assign_status AS assignment_test_status_assign_status,
    rbkp.assign_next_date AS next_assignment_test_date_assign_next_date,
    rbkp.assign_end_date AS assignment_test_end_date_assign_end_date,
    rbkp.copy_by_belnr AS original_invoice_number_copy_by_belnr,
    rbkp.copy_by_year AS original_invoice_fiscal_year_copy_by_year,
    rbkp.copy_to_belnr AS copied_invoice_number_copy_to_belnr,
    rbkp.copy_to_year AS copied_invoice_fiscal_year_copy_to_year,
    rbkp.copy_user AS user_who_copied_invoice_copy_user,
    rbkp.kursx AS exchange_rate_kursx,
    rbkp.wwert AS translation_date_wwert,
    rbkp.xref3 AS reference_key3_xref3,
    rbkp.j_1tpbupl AS branch_code_j_1tpbupl,

    -- Calendar Dates Joined
    dimensional_date_budat.cal_year AS year_of_posting_date_budat,
    dimensional_date_budat.cal_month AS month_of_posting_date_budat,
    dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
    dimensional_date_budat.cal_week AS week_of_posting_date_budat,
    dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
    dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
    dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
    dimensional_date_bldat.cal_week AS week_of_document_date_bldat,

    IFNULL(
      rbkp.recordstamp,
      TIMESTAMP('1900-01-01 00:00:00+00')
    ) AS source_last_updated_at,
    CURRENT_TIMESTAMP() AS bq_loaded_at
  FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "rbkp")} AS rbkp
  LEFT JOIN currency_decimal
    ON rbkp.waers = currency_decimal.currkey
  LEFT JOIN date_dimension AS dimensional_date_budat
    ON rbkp.budat = dimensional_date_budat.date
  LEFT JOIN date_dimension AS dimensional_date_bldat
    ON rbkp.bldat = dimensional_date_bldat.date
  ${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["rbkp"])
  ])}
  `
);
