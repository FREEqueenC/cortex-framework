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
    "material_matnr",
    "plant_werks",
    "batch_charg",
    "special_stock_indicator_sobkz",
    "vendor_lifnr",
    "sales_document_vbeln",
    "sales_document_item_posnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  msfd.mandt AS client_mandt,
  msfd.matnr AS material_matnr,
  msfd.werks AS plant_werks,
  msfd.charg AS batch_charg,
  msfd.sobkz AS special_stock_indicator_sobkz,
  msfd.lifnr AS vendor_lifnr,
  msfd.vbeln AS sales_document_vbeln,
  msfd.posnr AS sales_document_item_posnr,
  msfd.lfgja AS fiscal_year_current_period_lfgja,
  msfd.lfmon AS current_period_lfmon,
  msfd.fdspr AS physical_inventory_blocking_indicator_fdspr,
  msfd.fdlab AS unrestricted_stock_fdlab,
  msfd.fdins AS stock_in_quality_inspection_fdins,
  msfd.fdvla AS unrestricted_stock_previous_period_fdvla,
  msfd.fdvin AS stock_in_quality_inspection_previous_period_fdvin,
  msfd.fdill AS unrestricted_stock_current_year_fdill,
  msfd.fdilq AS stock_in_quality_inspection_current_year_fdilq,
  msfd.fdvll AS unrestricted_stock_previous_year_fdvll,
  msfd.fdvlq AS stock_in_quality_inspection_previous_year_fdvlq,
  msfd.fdfll AS unrestricted_stock_following_year_fdfll,
  msfd.fdflq AS stock_in_quality_inspection_following_year_fdflq,
  msfd.fddll AS date_of_last_physical_inventory_count_fddll,
  msfd.fdein AS restricted_use_stock_fdein,
  msfd.fdvei AS restricted_use_stock_previous_period_fdvei,
  msfd.ersda AS created_on_ersda,
  msfd.fdjin AS fiscal_year_current_physical_inventory_indicator_fdjin,
  msfd.fdrue AS msfd_fdrue,
  IFNULL(msfd.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "msfd")} AS msfd
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["msfd"])
])}
`
);
