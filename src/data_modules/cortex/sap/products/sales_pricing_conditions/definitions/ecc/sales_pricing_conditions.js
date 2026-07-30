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
  konv.mandt AS client_mandt,
  konv.knumv AS document_condition_number_knumv,
  konv.kposn AS item_kposn,
  konv.stunr AS step_number_stunr,
  konv.zaehk AS counter_zaehk,
  konv.kappl AS application_kappl,
  konv.kschl AS condition_type_kschl,
  konv.kdatu AS condition_pricing_date_kdatu,
  konv.krech AS calculation_type_krech,
  konv.kawrt AS condition_base_value_kawrt,
  konv.kbetr AS condition_rate_kbetr,
  konv.waers AS currency_waers,
  konv.kkurs AS cond_exchange_rate_kkurs,
  konv.kpein AS pricing_unit_kpein,
  konv.kmein AS condition_unit_kmein,
  konv.kumza AS numerator_for_convers_kumza,
  konv.kumne AS denom_for_conversion_kumne,
  konv.kntyp AS condition_category_kntyp,
  konv.kstat AS statistical_kstat,
  konv.knprs AS scale_type_knprs,
  konv.kruek AS accruals_kruek,
  konv.kreli AS invoice_list_cond_kreli,
  konv.kherk AS condition_origin_kherk,
  konv.kgrpe AS group_condition_kgrpe,
  konv.koupd AS condition_update_koupd,
  konv.kolnr AS access_kolnr,
  konv.knumh AS condition_record_no_knumh,
  konv.kopos AS sequent_no_of_cond_kopos,
  konv.kvsl1 AS account_key_kvsl1,
  konv.sakn1 AS gl_account_sakn1,
  konv.mwsk1 AS tax_code_mwsk1,
  konv.kvsl2 AS acct_key_accruals_kvsl2,
  konv.sakn2 AS provision_account_sakn2,
  konv.mwsk2 AS withholding_tax_code_mwsk2,
  konv.lifnr AS vendor_lifnr,
  konv.kunnr AS customer_kunnr,
  ${currency.amountWithDecimalShift("konv.kdiff", "currency_decimal")} AS cond_rounding_diff_kdiff,
  ${currency.amountWithDecimalShift("konv.kwert", "currency_decimal")} AS condition_value_kwert,
  konv.ksteu AS condition_control_ksteu,
  konv.kinak AS inactive_condition_kinak,
  konv.koaid AS condition_class_koaid,
  konv.zaeko AS header_cond_counter_zaeko,
  konv.kmxaw AS maximum_base_value_kmxaw,
  konv.kmxwr AS maximum_amount_kmxwr,
  konv.kfaktor AS condition_factor_kfaktor,
  konv.kdupl AS structure_condition_kdupl,
  konv.kfaktor1 AS condition_factor_1_kfaktor1,
  konv.kzbzg AS scale_basis_kzbzg,
  konv.kstbs AS scale_base_value_kstbs,
  konv.konms AS scale_unit_of_meas_konms,
  konv.konws AS scale_currency_konws,
  konv.kawrt_k AS condition_base_value_k_kawrt_k,
  konv.kwaeh AS condition_currency_kwaeh,
  ${currency.amountWithDecimalShift("konv.kwert_k", "currency_decimal")} AS condition_value_k_kwert_k,
  konv.kfkiv AS int_comp_bill_cond_kfkiv,
  konv.kvarc AS variant_condition_kvarc,
  konv.kmprs AS changed_manually_kmprs,
  konv.prsqu AS price_source_prsqu,
  konv.varcond AS variant_varcond,
  konv.stufe AS level_stufe,
  konv.wegxx AS path_wegxx,
  konv.ktrel AS rel_for_acct_assigt_ktrel,
  konv.mdflg AS matrix_maint_mdflg,
  konv.txjlv AS tax_jurisdiction_level_txjlv,
  konv.kbflag AS bit_encrypt_flags_kbflag,
  konv.kolnr3 AS access_3_kolnr3,
  konv.cpf_guid AS formula_id_in_document_cpf_guid,
  konv.kaqty AS adjusted_quantity_kaqty,
  dimensional_date_kdatu.cal_year AS year_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_quarter AS quarter_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_month AS month_of_condition_pricing_date_kdatu,
  dimensional_date_kdatu.cal_week AS week_of_condition_pricing_date_kdatu,
  IFNULL(
    konv.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "konv")} AS konv
LEFT JOIN currency_decimal
  ON konv.waers = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_kdatu
  ON konv.kdatu = dimensional_date_kdatu.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["konv"])
])}
`,
);
