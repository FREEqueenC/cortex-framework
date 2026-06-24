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
    "condition_contract_num",
    "document_wbeln",
    "document_item_posnr",
    "document_type_business_volume_doc_type",
    "document_id_business_volume_doc_id",
    "document_id_business_volume_2_doc_id2",
    "document_id_business_volume_3_doc_id3",
    "document_item_business_volume_doc_item"

  ]
);

publish("condition_contract_settlement_detailed_statement", publishConfig).query(
  (ctx) => `
WITH
  date_dimension AS (
    ${date.getDateDimension()}
  ),
  currency_decimal AS (
    ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
  )
SELECT
  wb2_d_bvdetail.mandt AS client_mandt,
  wb2_d_bvdetail.num AS condition_contract_num,
  wb2_d_bvdetail.wbeln AS document_wbeln,
  wb2_d_bvdetail.posnr AS document_item_posnr,
  wb2_d_bvdetail.doc_type AS document_type_business_volume_doc_type,
  wb2_d_bvdetail.doc_id AS document_id_business_volume_doc_id,
  wb2_d_bvdetail.doc_id2 AS document_id_business_volume_2_doc_id2,
  wb2_d_bvdetail.doc_id3 AS document_id_business_volume_3_doc_id3,
  wb2_d_bvdetail.doc_item AS document_item_business_volume_doc_item,
  wb2_d_bvdetail.bv_date AS date_for_settlement_bv_date,
  wb2_d_bvdetail.menge AS quantity_menge,
  wb2_d_bvdetail.meina AS unit_of_measure_meina,
  wb2_d_bvdetail.waers AS currency_waers,
  wb2_d_bvdetail.ntgew AS net_weight_ntgew,
  wb2_d_bvdetail.brgew AS gross_weight_brgew,
  wb2_d_bvdetail.gewei AS weight_unit_gewei,
  wb2_d_bvdetail.volum AS volume_volum,
  wb2_d_bvdetail.voleh AS volume_unit_voleh,
  wb2_d_bvdetail.anzpu AS points_anzpu,
  wb2_d_bvdetail.punei AS points_unit_punei,
  wb2_d_bvdetail.settl_doc_type AS settlement_document_type_settl_doc_type,
  ${currency.amountWithDecimalShift("wb2_d_bvdetail.busvol_1", "currency_decimal")} AS business_volume_1_busvol_1,
  ${currency.amountWithDecimalShift("wb2_d_bvdetail.busvol_2", "currency_decimal")} AS business_volume_2_busvol_2,
  ${currency.amountWithDecimalShift("wb2_d_bvdetail.busvol_3", "currency_decimal")} AS business_volume_3_busvol_3,
  ${currency.amountWithDecimalShift("wb2_d_bvdetail.busvol_4", "currency_decimal")} AS business_volume_4_busvol_4,
  wb2_d_bvdetail.dummy1 AS dummy_function_in_length_1_dummy1,
  dimensional_date_bv_date.cal_year AS year_of_date_for_settlement_bv_date,
  dimensional_date_bv_date.cal_quarter AS quarter_of_date_for_settlement_bv_date,
  dimensional_date_bv_date.cal_month AS month_of_date_for_settlement_bv_date,
  dimensional_date_bv_date.cal_week AS week_of_date_for_settlement_bv_date,
  IFNULL(
    wb2_d_bvdetail.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wb2_d_bvdetail")} AS wb2_d_bvdetail
LEFT JOIN currency_decimal
  ON wb2_d_bvdetail.waers = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_bv_date
  ON wb2_d_bvdetail.bv_date = dimensional_date_bv_date.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wb2_d_bvdetail"])
])}
`
);
