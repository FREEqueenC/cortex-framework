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
    "controlling_area_kokrs",
    "document_number_belnr",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  cobk.mandt AS client_mandt,
  cobk.kokrs AS controlling_area_kokrs,
  cobk.belnr AS document_number_belnr,
  cobk.gjahr AS fiscal_year_gjahr,
  cobk.versn AS version_versn,
  cobk.vrgng AS business_transaction_vrgng,
  cobk.timestmp AS time_created_timestmp,
  cobk.perab AS from_period_perab,
  cobk.perbi AS to_period_perbi,
  cobk.bldat AS document_date_bldat,
  cobk.budat AS posting_date_budat,
  cobk.cpudt AS created_on_cpudt,
  cobk.usnam AS user_name_usnam,
  cobk.bltxt AS document_header_text_bltxt,
  cobk.stflg AS reversal_document_stflg,
  cobk.stokz AS reversed_stokz,
  cobk.refbt AS reference_document_type_refbt,
  cobk.refbn AS reference_document_number_refbn,
  cobk.refbk AS reference_company_code_refbk,
  cobk.refgj AS reference_fiscal_year_refgj,
  cobk.blart AS document_type_blart,
  cobk.ldgrp AS ledger_group_ldgrp,
  cobk.orgvg AS original_business_transaction_orgvg,
  cobk.sumbz AS line_item_total_sumbz,
  cobk.delbz AS deleted_line_items_delbz,
  cobk.wsdat AS value_date_wsdat,
  cobk.kurst AS exchange_rate_type_kurst,
  cobk.varnr AS screen_variant_varnr,
  cobk.kwaer AS controlling_area_currency_kwaer,
  cobk.ctyp1 AS currency_type_1_ctyp1,
  cobk.ctyp2 AS currency_type_2_ctyp2,
  cobk.ctyp3 AS currency_type_3_ctyp3,
  cobk.ctyp4 AS currency_type_4_ctyp4,
  cobk.awtyp AS reference_procedure_awtyp,
  cobk.aworg AS reference_organizational_unit_aworg,
  cobk.logsystem AS logical_system_logsystem,
  cobk.cputm AS time_of_entry_cputm,
  cobk.alebz AS posting_rows_external_alebz,
  cobk.alebn AS ale_original_document_number_alebn,
  cobk.awsys AS logical_system_source_awsys,
  cobk.awref_rev AS reversal_reference_number_awref_rev,
  cobk.aworg_rev AS reversal_organization_aworg_rev,
  cobk.awkey AS object_key_awkey,
  cobk.valdt AS valuation_date_valdt,
  cobk.kokrs_sender AS controlling_area_in_sender_system_kokrs_sender,
  cobk.belnr_sender AS controlling_document_no_in_sender_system_belnr_sender,
  cobk.logsystem_sender AS logical_system_of_the_sender_logsystem_sender,
  cobk.reprocessing_status_code AS reprocessing_status_code,
  IFNULL(cobk.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cobk")} AS cobk
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["cobk"])
])}
`
);
