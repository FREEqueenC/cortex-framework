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
const currency = require("includes/currency.js");
const date = require("includes/date.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "document_condition_number_knumv",
    "item_kposn",
    "step_number_stunr",
    "counter_zaehk"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH 
  date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  prcd_elements.client AS client_mandt,
  prcd_elements.knumv AS document_condition_number_knumv,
  prcd_elements.kposn AS item_kposn,
  prcd_elements.stunr AS step_number_stunr,
  prcd_elements.zaehk AS counter_zaehk,
  prcd_elements.kappl AS application_kappl,
  prcd_elements.kschl AS condition_type_kschl,
  prcd_elements.kdatu AS condition_pricing_date_kdatu,
  prcd_elements.krech AS calculation_type_krech,
  prcd_elements.kawrt AS condition_basis_kawrt,
  prcd_elements.kbetr AS amount_kbetr,
  prcd_elements.waers AS currency_waers,
  prcd_elements.kkurs AS cond_exchange_rate_kkurs,
  prcd_elements.kpein AS pricing_unit_kpein,
  prcd_elements.kmein AS condition_unit_kmein,
  prcd_elements.kumza AS numerator_kumza,
  prcd_elements.kumne AS denominator_kumne,
  prcd_elements.kntyp AS condition_category_kntyp,
  prcd_elements.kstat AS statistical_kstat,
  prcd_elements.knprs AS scale_type_knprs,
  prcd_elements.kruek AS accruals_kruek,
  prcd_elements.kreli AS invoice_list_cond_kreli,
  prcd_elements.kherk AS condition_origin_kherk,
  prcd_elements.kgrpe AS group_condition_kgrpe,
  prcd_elements.kolnr AS access_kolnr,
  prcd_elements.knumh AS condition_record_no_knumh,
  prcd_elements.kopos AS sequent_no_of_cond_kopos,
  prcd_elements.kvsl1 AS account_key_kvsl1,
  prcd_elements.sakn1 AS gl_account_sakn1,
  prcd_elements.mwsk1 AS tax_code_mwsk1,
  prcd_elements.kvsl2 AS acct_key_accruals_kvsl2,
  prcd_elements.sakn2 AS accruals_account_sakn2,
  prcd_elements.mwsk2 AS withholding_tax_code_mwsk2,
  prcd_elements.lifnr AS vendor_lifnr,
  ${currency.amountWithDecimalShift("prcd_elements.kdiff", "currency_decimal")} AS cond_rounding_diff_kdiff,
  ${currency.amountWithDecimalShift("prcd_elements.kwert", "currency_decimal")} AS value_kwert,
  prcd_elements.waerk AS document_currency_waerk,
  prcd_elements.ksteu AS condition_control_ksteu,
  prcd_elements.kinak AS inactive_condition_kinak,
  prcd_elements.koaid AS condition_class_koaid,
  prcd_elements.zaeko AS counter_zaeko,
  prcd_elements.kfaktor AS condition_factor_kfaktor,
  prcd_elements.kdupl AS structure_condition_kdupl,
  prcd_elements.kfaktor1 AS condition_factor_1_kfaktor1,
  prcd_elements.kzbzg AS scale_basis_kzbzg,
  prcd_elements.kstbs AS scale_base_value_kstbs,
  prcd_elements.konms AS scale_unit_of_meas_konms,
  prcd_elements.konws AS scale_currency_konws,
  prcd_elements.kwaeh AS condition_currency_kwaeh,
  ${currency.amountWithDecimalShift("prcd_elements.kwert_k", "currency_decimal")} AS value_k_kwert_k,
  prcd_elements.kfkiv AS intercompany_billing_kfkiv,
  prcd_elements.kmprs AS changed_manually_kmprs,
  prcd_elements.prsqu AS price_source_prsqu,
  prcd_elements.txjlv AS tax_jurisdiction_level_txjlv,
  prcd_elements.kbflag AS bit_encrypt_flags_kbflag,
  prcd_elements.koupd AS condition_update_koupd,
  prcd_elements.kmxaw AS maximum_basis_value_kmxaw,
  prcd_elements.kmxwr AS maximum_amount_kmxwr,
  prcd_elements.kawrt_k AS condition_basis_k_kawrt_k,
  prcd_elements.kunnr AS customer_kunnr,
  prcd_elements.kvarc AS used_for_variant_config_kvarc,
  prcd_elements.varcond AS variant_key_varcond,
  prcd_elements.ktrel AS rel_for_acct_assigt_ktrel,
  prcd_elements.mdflg AS matrix_maintenance_mdflg,
  prcd_elements.cpf_guid AS formula_id_in_document_cpf_guid,
  prcd_elements.kaqty AS adjusted_quantity_kaqty,
  prcd_elements.val_zero AS condition_processing_if_value_is_zero_val_zero,
  prcd_elements.is_acct_detn_relevant AS relevant_for_account_determination_is_acct_detn_relevant,
  prcd_elements.tax_country AS tax_country_tax_country,
  dimensional_date_kdatu.cal_year AS year_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_quarter AS quarter_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_month AS month_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_week AS week_of_condition_pricing_date_kdatu,
  IFNULL(
    prcd_elements.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "prcd_elements")} AS prcd_elements
LEFT JOIN currency_decimal
  ON prcd_elements.waerk = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_kdatu
  ON SAFE.PARSE_DATE('%Y%m%d', SUBSTR(prcd_elements.kdatu, 1, 8)) = dimensional_date_kdatu.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["prcd_elements"])
])}
`,
);
