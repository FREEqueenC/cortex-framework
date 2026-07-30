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
    "customer_kunnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  msku.mandt AS client_mandt,
  msku.matnr AS material_matnr,
  msku.werks AS plant_werks,
  msku.charg AS batch_charg,
  msku.sobkz AS special_stock_indicator_sobkz,
  msku.kunnr AS customer_kunnr,
  msku.lfgja AS fiscal_year_current_period_lfgja,
  msku.lfmon AS current_period_lfmon,
  msku.kuspr AS physical_inventory_blocking_indicator_kuspr,
  msku.kulab AS unrestricted_stock_kulab,
  msku.kuins AS stock_in_quality_inspection_kuins,
  msku.kuvla AS unrestricted_stock_previous_period_kuvla,
  msku.kuvin AS stock_in_quality_inspection_previous_period_kuvin,
  msku.kuill AS unrestricted_stock_current_year_kuill,
  msku.kuilq AS stock_in_quality_inspection_current_year_kuilq,
  msku.kuvll AS unrestricted_stock_previous_year_kuvll,
  msku.kuvlq AS stock_in_quality_inspection_previous_year_kuvlq,
  msku.kufll AS unrestricted_stock_following_year_kufll,
  msku.kuflq AS stock_in_quality_inspection_following_year_kuflq,
  msku.kudll AS date_of_last_physical_inventory_count_kudll,
  msku.kuein AS restricted_use_stock_kuein,
  msku.kuvei AS restricted_use_stock_previous_period_kuvei,
  msku.ersda AS created_on_ersda,
  msku.kujin AS fiscal_year_current_physical_inventory_indicator_kujin,
  msku.kurue AS msku_kurue,
  msku.kuuml AS stock_in_transfer_kuuml,
  msku.sgt_scat AS stock_segment_sgt_scat,
  msku.fsh_season_year AS season_year_fsh_season_year,
  msku.fsh_season AS season_fsh_season,
  msku.fsh_collection AS collection_fsh_collection,
  msku.fsh_theme AS theme_fsh_theme,
  msku.fsh_salloc_qty AS allocated_stock_quantity_fsh_salloc_qty,
  IFNULL(msku.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "msku")} AS msku
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["msku"])
])}
`
);
