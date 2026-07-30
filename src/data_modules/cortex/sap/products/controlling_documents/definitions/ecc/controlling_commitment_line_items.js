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
    "reference_document_category_refbt",
    "reference_document_number_refbn",
    "reference_item_rfpos",
    "account_assignment_number_rfknt",
    "deadline_item_rftrm",
    "reference_document_type_rfart",
    "vendor_lifnr",
    "ledger_lednr",
    "object_number_objnr",
    "controlling_subkey_hrkft",
    "reference_organizational_unit_rforg",
    "reference_procedure_rftyp",
    "logical_system_rfsys",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  cooi.mandt AS client_mandt,
  cooi.refbt AS reference_document_category_refbt,
  cooi.refbn AS reference_document_number_refbn,
  cooi.rfpos AS reference_item_rfpos,
  cooi.rfknt AS account_assignment_number_rfknt,
  cooi.rftrm AS deadline_item_rftrm,
  cooi.rfart AS reference_document_type_rfart,
  cooi.lifnr AS vendor_lifnr,
  cooi.lednr AS ledger_lednr,
  cooi.objnr AS object_number_objnr,
  cooi.hrkft AS controlling_subkey_hrkft,
  cooi.rforg AS reference_organizational_unit_rforg,
  cooi.rftyp AS reference_procedure_rftyp,
  cooi.rfsys AS logical_system_rfsys,
  cooi.vrgng AS business_transaction_vrgng,
  cooi.gjahr AS fiscal_year_gjahr,
  cooi.wrttp AS value_type_wrttp,
  cooi.versn AS version_versn,
  cooi.sakto AS cost_element_sakto,
  cooi.vbund AS trading_partner_number_vbund,
  cooi.pargb AS trading_partner_business_area_pargb,
  cooi.beknz AS debit_credit_indicator_beknz,
  cooi.twaer AS transaction_currency_twaer,
  cooi.uname AS user_name_uname,
  cooi.bldat AS document_date_bldat,
  cooi.budat AS debit_date_budat,
  cooi.perio AS period_perio,
  cooi.bukrs AS company_code_bukrs,
  cooi.kokrs AS controlling_area_kokrs,
  cooi.matnr AS material_matnr,
  cooi.matkl AS material_group_matkl,
  cooi.sgtxt AS name_sgtxt,
  cooi.gesmng AS planned_quantity_gesmng,
  cooi.meinh AS unit_of_measure_meinh,
  cooi.megbtr AS total_quantity_megbtr,
  cooi.mbgbtr AS total_quantity_mbgbtr,
  cooi.meinb AS posted_unit_of_measure_meinb,
  cooi.wkurs AS exchange_rate_wkurs,
  cooi.orgwth AS planned_local_currency_orgwth,
  cooi.whgbtr AS value_local_currency_whgbtr,
  cooi.orgwtk AS planned_controlling_area_currency_orgwtk,
  cooi.wkgbtr AS value_controlling_area_currency_wkgbtr,
  cooi.orgwtt AS planned_transaction_currency_orgwtt,
  cooi.wtgbtr AS value_transaction_currency_wtgbtr,
  cooi.orgwto AS planned_object_currency_orgwto,
  cooi.wogbtr AS value_in_object_currency_wogbtr,
  cooi.orgwtl AS planned_ledger_currency_orgwtl,
  cooi.wlgbtr AS value_ledger_currency_wlgbtr,
  cooi.loekz AS deletion_indicator_loekz,
  cooi.dabrz AS reference_date_dabrz,
  cooi.timestmp AS timestamp_gmt_timestmp,
  IFNULL(cooi.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cooi")} AS cooi
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["cooi"])
])}
`
);
