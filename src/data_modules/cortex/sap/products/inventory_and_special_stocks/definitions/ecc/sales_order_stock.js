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
    "storage_location_lgort",
    "batch_charg",
    "special_stock_indicator_sobkz",
    "sales_document_vbeln",
    "sales_document_item_posnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mska.mandt AS client_mandt,
  mska.matnr AS material_matnr,
  mska.werks AS plant_werks,
  mska.lgort AS storage_location_lgort,
  mska.charg AS batch_charg,
  mska.sobkz AS special_stock_indicator_sobkz,
  mska.vbeln AS sales_document_vbeln,
  mska.posnr AS sales_document_item_posnr,
  mska.lfgja AS fiscal_year_current_period_lfgja,
  mska.lfmon AS current_period_lfmon,
  mska.kaspr AS physical_inventory_blocking_indicator_kaspr,
  mska.kalab AS unrestricted_stock_kalab,
  mska.kains AS stock_in_quality_inspection_kains,
  mska.kaspe AS blocked_stock_kaspe,
  mska.kavla AS unrestricted_stock_previous_period_kavla,
  mska.kavin AS stock_in_quality_inspection_previous_period_kavin,
  mska.kavsp AS blocked_stock_previous_period_kavsp,
  mska.kaill AS unrestricted_stock_current_year_kaill,
  mska.kailq AS stock_in_quality_inspection_current_year_kailq,
  mska.kails AS blocked_stock_current_year_kails,
  mska.kavll AS unrestricted_stock_previous_year_kavll,
  mska.kavlq AS stock_in_quality_inspection_previous_year_kavlq,
  mska.kavls AS blocked_stock_previous_year_kavls,
  mska.kafll AS unrestricted_stock_following_year_kafll,
  mska.kaflq AS stock_in_quality_inspection_following_year_kaflq,
  mska.kafls AS blocked_stock_following_year_kafls,
  mska.kadll AS date_of_last_physical_inventory_count_kadll,
  mska.kaein AS restricted_use_stock_kaein,
  mska.kavei AS restricted_use_stock_previous_period_kavei,
  mska.ersda AS created_on_ersda,
  mska.kajin AS fiscal_year_current_physical_inventory_indicator_kajin,
  mska.karue AS mska_karue,
  mska.sgt_scat AS stock_segment_sgt_scat,
  mska.fsh_season_year AS season_year_fsh_season_year,
  mska.fsh_season AS season_fsh_season,
  mska.fsh_collection AS collection_fsh_collection,
  mska.fsh_theme AS theme_fsh_theme,
  mska.fsh_salloc_qty AS allocated_stock_quantity_fsh_salloc_qty,
  IFNULL(mska.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mska")} AS mska
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mska"])
])}
`
);
