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
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "company_code_bukrs",
    "transaction_rfha",
    "contract_number_ranlvd",
    "price_npv_type_okuart",
    "effective_from_databs"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  vtvbar.mandt AS client_mandt,
  vtvbar.rantyp AS contract_type_rantyp,
  vtvbar.bukrs AS company_code_bukrs,
  vtvbar.rfha AS transaction_rfha,
  vtvbar.ranlvd AS contract_number_ranlvd,
  vtvbar.okuart AS price_npv_type_okuart,
  vtvbar.databs AS effective_from_databs,
  ${currency.amountWithDecimalShift("vtvbar.barwert", "currency_decimal_wbarwert")} AS net_present_value_barwert,
  vtvbar.wbarwert AS currency_of_npv_wbarwert,
  ${currency.amountWithDecimalShift("vtvbar.intrinsic_value", "currency_decimal_wbarwert")} AS intrinsic_value_in_document_currency_intrinsic_value,
  ${currency.amountWithDecimalShift("vtvbar.time_value", "currency_decimal_wbarwert")} AS time_value_in_display_currency_time_value,
  ${currency.amountWithDecimalShift("vtvbar.clean_price", "currency_decimal_wbarwert")} AS clean_price_in_display_currency_clean_price,
  ${currency.amountWithDecimalShift("vtvbar.barwert_in", "currency_decimal_wbarwert")} AS npv_of_incoming_side_barwert_in,
  ${currency.amountWithDecimalShift("vtvbar.barwert_out", "currency_decimal_wbarwert")} AS npv_of_outgoing_side_barwert_out,
  ${currency.amountWithDecimalShift("vtvbar.barwert_rf", "currency_decimal_wbarwert")} AS risk_free_npv_barwert_rf,
  ${currency.amountWithDecimalShift("vtvbar.cva", "currency_decimal_wbarwert")} AS credit_value_adjustment_cva,
  ${currency.amountWithDecimalShift("vtvbar.dva", "currency_decimal_wbarwert")} AS debit_value_adjustment_dva,
  vtvbar.cva_type AS credit_and_debit_value_adjustment_type_cva_type,
  vtvbar.create_name AS entered_by_create_name,
  vtvbar.create_date AS first_entered_on_create_date,
  vtvbar.create_time AS time_of_creation_create_time,
  vtvbar.create_tcode AS transaction_code_create_tcode,
  vtvbar.change_name AS last_changed_by_change_name,
  vtvbar.change_date AS last_edited_on_change_date,
  vtvbar.change_time AS last_edited_at_change_time,
  vtvbar.change_tcode AS transaction_code_change_tcode,
  vtvbar.log_guid AS guid_of_log_log_guid,
  vtvbar.check_sum AS hash_value_160_bits_check_sum,
  IFNULL(
    vtvbar.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vtvbar")} AS vtvbar
LEFT JOIN currency_decimal AS currency_decimal_wbarwert
  ON vtvbar.wbarwert = currency_decimal_wbarwert.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vtvbar"])
])}
`
);
