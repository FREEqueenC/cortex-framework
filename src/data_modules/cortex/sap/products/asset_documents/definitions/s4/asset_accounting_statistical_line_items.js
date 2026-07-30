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
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "fiscal_year_gjahr",
    "reference_procedure_awtyp",
    "reference_document_awref",
    "reference_org_unit_aworg",
    "logical_system_source_awsys",
    "sub_transaction_subta",
    "depreciation_area_afabe",
    "sla_line_item_type_slalittype",
    "debit_credit_indicator_drcrk"
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
  faat_doc_it.mandt AS client_mandt,
  faat_doc_it.bukrs AS company_code_bukrs,
  faat_doc_it.anln1 AS asset_number_anln1,
  faat_doc_it.anln2 AS asset_subnumber_anln2,
  faat_doc_it.gjahr AS fiscal_year_gjahr,
  faat_doc_it.awtyp AS reference_procedure_awtyp,
  faat_doc_it.awref AS reference_document_awref,
  faat_doc_it.aworg AS reference_org_unit_aworg,
  faat_doc_it.awsys AS logical_system_source_awsys,
  faat_doc_it.subta AS sub_transaction_subta,
  faat_doc_it.afabe AS depreciation_area_afabe,
  faat_doc_it.slalittype AS sla_line_item_type_slalittype,
  faat_doc_it.drcrk AS debit_credit_indicator_drcrk,
  faat_doc_it.awitem AS reference_document_line_item_awitem,
  faat_doc_it.ldgrp AS ledger_group_ldgrp,
  faat_doc_it.vorgn AS gl_transaction_type_vorgn,
  faat_doc_it.budat AS posting_date_budat,
  faat_doc_it.bzdat AS asset_value_date_bzdat,
  faat_doc_it.poper AS posting_period_poper,
  faat_doc_it.bwasl AS transaction_type_bwasl,
  faat_doc_it.movcat AS transaction_type_category_movcat,
  ${currency.amountWithDecimalShift("faat_doc_it.hsl", "curr_local")} AS amount_posted_in_company_code_currency_hsl,
  ${currency.amountWithDecimalShift("faat_doc_it.ksl", "curr_global")} AS amount_posted_in_global_currency_ksl,
  faat_doc_it.rhcur AS company_code_currency_rhcur,
  faat_doc_it.rkcur AS global_currency_rkcur,
  faat_doc_it.bldat AS document_date_bldat,
  faat_doc_it.cpudt AS entry_date_cpudt,
  faat_doc_it.cputm AS entry_time_cputm,
  faat_doc_it.usnam AS user_name_usnam,
  faat_doc_it.tcode AS transaction_code_tcode,
  faat_doc_it.sgtxt AS text_sgtxt,
  faat_doc_it.xblnr AS reference_document_number_xblnr,
  faat_doc_it.zuonr AS assignment_number_zuonr,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  dimensional_date_budat.cal_year AS year_of_posting_date_budat,
  dimensional_date_budat.cal_month AS month_of_posting_date_budat,
  dimensional_date_budat.cal_quarter AS quarter_of_posting_date_budat,
  dimensional_date_budat.cal_week AS week_of_posting_date_budat,
  IFNULL(
    faat_doc_it.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "faat_doc_it")} AS faat_doc_it
LEFT JOIN currency_decimal AS curr_local
  ON faat_doc_it.rhcur = curr_local.currkey
LEFT JOIN currency_decimal AS curr_global
  ON faat_doc_it.rkcur = curr_global.currkey
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON faat_doc_it.bldat = dimensional_date_bldat.date
LEFT JOIN date_dimension AS dimensional_date_budat
  ON faat_doc_it.budat = dimensional_date_budat.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["faat_doc_it"])
])}
`,
);
