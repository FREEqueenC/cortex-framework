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
const currency = require("includes/currency.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "ledger_lednr",
    "object_number_objnr",
    "commitment_item_posit",
    "object_indicator_trgkz",
    "value_type_wrttp",
    "fiscal_year_gjahr",
    "fund_geber",
    "version_versn",
    "budget_type_vorga",
    "transaction_currency_twaer",
    "budget_subtype_subvo",
    "year_of_cash_effectivity_gnjhr",
    "functional_area_farea"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  bpja.mandt AS client_mandt,
  bpja.lednr AS ledger_lednr,
  bpja.objnr AS object_number_objnr,
  bpja.posit AS commitment_item_posit,
  bpja.trgkz AS object_indicator_trgkz,
  bpja.wrttp AS value_type_wrttp,
  bpja.gjahr AS fiscal_year_gjahr,
  bpja.geber AS fund_geber,
  bpja.versn AS version_versn,
  bpja.vorga AS budget_type_vorga,
  bpja.twaer AS transaction_currency_twaer,
  bpja.subvo AS budget_subtype_subvo,
  bpja.gnjhr AS year_of_cash_effectivity_gnjhr,
  bpja.farea AS functional_area_farea,
  ${currency.amountWithDecimalShift("bpja.wtjhr", "currency_decimal_twaer")} AS annual_value_transaction_currency_wtjhr,
  bpja.wljhr AS annual_value_local_currency_wljhr,
  ${currency.amountWithDecimalShift("bpja.wtjhv", "currency_decimal_twaer")} AS distributed_annual_value_transaction_currency_wtjhv,
  bpja.wljhv AS distributed_annual_value_local_currency_wljhv,
  ${currency.amountWithDecimalShift("bpge.wtges", "currency_decimal_twaer")} AS total_value_transaction_currency_wtges,
  bpge.wlges AS total_value_local_currency_wlges,
  ${currency.amountWithDecimalShift("bpge.wtgev", "currency_decimal_twaer")} AS total_distributed_value_transaction_currency_wtgev,
  bpge.wlgev AS total_distributed_value_local_currency_wlgev,
  COALESCE(bpja.kalnr, bpge.kalnr) AS cost_estimate_number_kalnr,
  COALESCE(bpja.klvar, bpge.klvar) AS costing_variant_klvar,
  bpja.spred AS distribution_key_spred,
  COALESCE(bpja.beltp, bpge.beltp) AS debit_type_beltp,
  GREATEST(
    IFNULL(bpja.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(bpge.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "bpja")} AS bpja
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "bpge")} AS bpge
  ON bpja.mandt = bpge.mandt
  AND bpja.lednr = bpge.lednr
  AND bpja.objnr = bpge.objnr
  AND bpja.posit = bpge.posit
  AND bpja.trgkz = bpge.trgkz
  AND bpja.wrttp = bpge.wrttp
  AND bpja.geber = bpge.geber
  AND bpja.versn = bpge.versn
  AND bpja.vorga = bpge.vorga
  AND bpja.twaer = bpge.twaer
  AND bpja.subvo = bpge.subvo
  AND bpja.farea = bpge.farea
LEFT JOIN currency_decimal AS currency_decimal_twaer
  ON bpja.twaer = currency_decimal_twaer.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["bpja", "bpge"])
])}
`
);
