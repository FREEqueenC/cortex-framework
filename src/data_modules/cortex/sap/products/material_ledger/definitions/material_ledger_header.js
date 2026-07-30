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
    "valuation_header_kalnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  ckmlhd.mandt AS client_mandt,
  ckmlhd.kalnr AS valuation_header_kalnr,
  ckmlhd.matnr AS material_number_matnr,
  ckmlhd.bwkey AS valuation_area_bwkey,
  ckmlhd.bwtar AS valuation_type_bwtar,
  ckmlhd.mlast AS price_determination_control_mlast,
  ckmlhd.xabrech AS movement_data_exists_xabrech,
  ckmlhd.abrechdat AS last_price_determination_date_abrechdat,
  ckmlhd.abrechuhr AS last_price_determination_time_abrechuhr,
  ckmlhd.kzbws AS special_stock_valuation_kzbws,
  ckmlhd.xobew AS vendor_stock_valuation_xobew,
  ckmlhd.sobkz AS special_stock_indicator_sobkz,
  ckmlhd.vbeln AS sales_document_vbeln,
  ckmlhd.posnr AS sales_document_item_posnr,
  ckmlhd.pspnr AS wbs_element_pspnr,
  ckmlhd.lifnr AS vendor_lifnr,
  IFNULL(ckmlhd.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ckmlhd")} AS ckmlhd
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ckmlhd"])
])}
`
);
