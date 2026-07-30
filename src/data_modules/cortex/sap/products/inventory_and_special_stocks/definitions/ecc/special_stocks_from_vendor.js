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
    "vendor_lifnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mkol.mandt AS client_mandt,
  mkol.matnr AS material_matnr,
  mkol.werks AS plant_werks,
  mkol.lgort AS storage_location_lgort,
  mkol.charg AS batch_charg,
  mkol.sobkz AS special_stock_indicator_sobkz,
  mkol.lifnr AS vendor_lifnr,
  mkol.lvorm AS stock_deletion_flag_lvorm,
  mkol.ersda AS created_on_ersda,
  mkol.ernam AS created_by_ernam,
  mkol.aenam AS changed_by_aenam,
  mkol.laeda AS last_change_laeda,
  mkol.lfgja AS fiscal_year_current_period_lfgja,
  mkol.lfmon AS current_period_lfmon,
  mkol.spers AS physical_inventory_blocking_indicator_spers,
  mkol.slabs AS unrestricted_stock_slabs,
  mkol.sinsm AS stock_in_quality_inspection_sinsm,
  mkol.seinm AS restricted_use_stock_seinm,
  mkol.sspem AS blocked_stock_sspem,
  mkol.svmla AS unrestricted_stock_previous_period_svmla,
  mkol.svmin AS stock_in_quality_inspection_previous_period_svmin,
  mkol.svmei AS restricted_use_stock_previous_period_svmei,
  mkol.svmsp AS blocked_stock_previous_period_svmsp,
  mkol.kzisl AS unrestricted_stock_current_year_kzisl,
  mkol.kzisq AS stock_in_quality_inspection_current_year_kzisq,
  mkol.kzise AS restricted_use_stock_current_year_kzise,
  mkol.kziss AS blocked_stock_current_year_kziss,
  mkol.kzvsl AS unrestricted_stock_previous_year_kzvsl,
  mkol.kzvsq AS stock_in_quality_inspection_previous_year_kzvsq,
  mkol.kzvse AS restricted_use_stock_previous_year_kzvse,
  mkol.kzvss AS blocked_stock_previous_year_kzvss,
  mkol.mmeng AS minimum_order_quantity_mmeng,
  mkol.ameng AS replenishment_quantity_ameng,
  mkol.kodll AS date_of_last_physical_inventory_count_kodll,
  mkol.kojin AS fiscal_year_current_physical_inventory_indicator_kojin,
  mkol.korue AS mkol_korue,
  mkol.sgt_scat AS stock_segment_sgt_scat,
  mkol.fsh_salloc_qty AS allocated_stock_quantity_fsh_salloc_qty,
  mkol.fsh_collection AS collection_fsh_collection,
  mkol.fsh_season AS season_fsh_season,
  mkol.fsh_season_year AS season_year_fsh_season_year,
  mkol.fsh_theme AS theme_fsh_theme,
  IFNULL(mkol.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mkol")} AS mkol
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mkol"])
])}
`
);
