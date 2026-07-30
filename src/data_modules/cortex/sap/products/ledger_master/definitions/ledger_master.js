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
    "ledger_rldnr",
    "language_key_langu"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t881.mandt AS client_mandt,
  t881.rldnr AS ledger_rldnr,
  t881t.langu AS language_key_langu,
  t881t.name AS ledger_name_name,
  t881.gcurr AS ledger_currency_gcurr,
  t881.class AS ledger_class_class,
  t881.typ AS ledger_type_typ,
  t881.trcur AS store_transaction_currency_trcur,
  t881.lccur AS store_second_currency_lccur,
  t881.rccur AS store_third_currency_rccur,
  t881.occur AS manage_fourth_currency_occur,
  t881.quant AS store_quantities_quant,
  t881.atqnt AS store_additional_quantity_atqnt,
  t881.tab AS totals_table_tab,
  t881.rcopy AS maintenance_by_copying_allowed_rcopy,
  t881.shkz AS debit_credit_shkz,
  t881.glsip AS write_line_items_glsip,
  t881.vortrag AS set_up_balance_cf_vortrag,
  t881.dldnr AS average_bal_ledger_dldnr,
  t881.xdldnr AS store_average_xdldnr,
  t881.curt1 AS local_currency_type_curt1,
  t881.curt2 AS global_currency_type_curt2,
  t881.curt3 AS currency_type_four_curt3,
  t881.v2post AS delay_update_v2post,
  t881.lctyp AS consolidation_type_lctyp,
  t881.fix AS standard_ledger_fix,
  t881.post AS ledger_posting_allowed_post,
  t881.rollup AS rollup_allowed_rollup,
  t881.depld AS additional_ledger_depld,
  t881.appl AS application_appl,
  t881.subappl AS subapplication_subappl,
  t881.komp AS component_komp,
  t881.gzledger AS productive_gzledger,
  t881.exit AS exit_number_exit,
  t881.kldnr AS export_ledger_kldnr,
  t881.logsys AS logical_system_logsys,
  t881.valutyp AS valuation_valutyp,
  t881.gcompress AS summarize_gcompress,
  t881.splitmethd AS splitting_method_splitmethd,
  t881.date_det_poper AS date_of_update_date_det_poper,
  t881.glflex AS gl_type_glflex,
  t881.xleading AS leading_ledger_xleading,
  t881.orient_ledger AS reference_ledger_orient_ledger,
  t881.avg_rollup AS average_ledger_avg_rollup,
  t881.xcash_ledger AS cash_ledger_xcash_ledger,
  GREATEST(
    IFNULL(t881.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t881t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t881")} AS t881
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t881t")} AS t881t
  ON t881.mandt = t881t.mandt
  AND t881.rldnr = t881t.rldnr
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t881", "t881t"])
])}
`
);
