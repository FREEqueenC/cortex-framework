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
    "document_number_belnr",
    "posting_row_buzei"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  bpvg.mandt AS client_mandt,
  bpvg.belnr AS document_number_belnr,
  bpvg.buzei AS posting_row_buzei,
  ${currency.amountWithDecimalShift("bpvg.wtges", "currency_decimal_twaer")} AS total_value_transaction_currency_wtges,
  bpvg.wlges AS total_value_local_currency_wlges,
  bpvg.kalnr AS cost_estimate_number_kalnr,
  bpvg.klvar AS costing_variant_klvar,
  bpvg.lednr AS ledger_lednr,
  bpvg.objnr AS object_number_objnr,
  bpvg.posit AS commitment_item_posit,
  bpvg.trgkz AS object_indicator_trgkz,
  bpvg.wrttp AS value_type_wrttp,
  bpvg.geber AS fund_geber,
  bpvg.versn AS version_versn,
  bpvg.vorga AS budget_type_vorga,
  bpvg.twaer AS transaction_currency_twaer,
  bpvg.pldat AS value_date_pldat,
  bpvg.kurst AS exchange_rate_type_kurst,
  bpvg.gjahr AS fiscal_year_gjahr,
  bpvg.cpudt AS created_on_cpudt,
  bpvg.usnam AS created_by_usnam,
  bpvg.sumbz AS line_item_total_sumbz,
  bpvg.bldat AS document_date_bldat,
  bpvg.sgtext AS text_sgtext,
  bpvg.namtext AS text_name_namtext,
  bpvg.delbz AS deleted_line_items_delbz,
  bpvg.sum_bpja AS line_item_total_bpja_sum_bpja,
  bpvg.del_bpja AS deleted_line_items_bpja_del_bpja,
  bpvg.sum_bpge AS line_item_total_bpge_sum_bpge,
  bpvg.del_bpge AS deleted_line_items_bpge_del_bpge,
  bpvg.sum_bppe AS line_item_total_bppe_sum_bppe,
  bpvg.del_bppe AS deleted_line_items_bppe_del_bppe,
  bpvg.fobel AS referenced_document_number_fobel,
  bpvg.verant AS person_responsible_verant,
  IFNULL(bpvg.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "bpvg")} AS bpvg
LEFT JOIN currency_decimal AS currency_decimal_twaer
  ON bpvg.twaer = currency_decimal_twaer.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["bpvg"])
])}
`
);
