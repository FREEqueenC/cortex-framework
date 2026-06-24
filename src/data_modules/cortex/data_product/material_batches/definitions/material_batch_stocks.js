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
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "material_number_matnr",
    "plant_werks",
    "storage_location_lgort",
    "batch_number_charg",
    "language_key_spras"
  ]
);

publish('material_batch_stocks', publishConfig).query(
  (ctx) => `
SELECT
  mchb.mandt AS client_mandt,
  mchb.matnr AS material_number_matnr,
  mchb.werks AS plant_werks,
  mchb.lgort AS storage_location_lgort,
  mchb.charg AS batch_number_charg,
  makt.spras AS language_key_spras,
  makt.maktx AS material_description_maktx,
  t001w.name1 AS plant_name_name1,
  mchb.lvorm AS stock_deletion_flag_lvorm,
  mchb.ersda AS created_on_ersda,
  mchb.ernam AS created_by_ernam,
  mchb.laeda AS last_changed_on_laeda,
  mchb.aenam AS changed_by_aenam,
  mchb.lfgja AS year_current_period_lfgja,
  mchb.lfmon AS current_period_lfmon,
  mchb.sperc AS physical_inventory_blocking_indicator_sperc,
  mchb.clabs AS unrestricted_use_stock_clabs,
  mchb.cumlm AS stock_in_transfer_cumlm,
  mchb.cinsm AS stock_in_quality_inspection_cinsm,
  mchb.ceinm AS restricted_use_stock_ceinm,
  mchb.cspem AS blocked_stock_cspem,
  mchb.cretm AS blocked_stock_returns_cretm,
  mchb.cvmla AS unrestricted_use_stock_valuation_period_cvmla,
  mchb.cvmum AS stock_in_transfer_valuation_period_cvmum,
  mchb.cvmin AS stock_in_quality_inspection_valuation_period_cvmin,
  mchb.cvmei AS restricted_use_stock_valuation_period_cvmei,
  mchb.cvmsp AS blocked_stock_valuation_period_cvmsp,
  mchb.cvmre AS blocked_stock_returns_valuation_period_cvmre,
  mchb.kzicl AS physical_inventory_indicator_unrestricted_use_stock_kzicl,
  mchb.kzicq AS physical_inventory_indicator_quality_inspection_stock_kzicq,
  mchb.kzice AS physical_inventory_indicator_restricted_use_stock_kzice,
  mchb.kzics AS physical_inventory_indicator_blocked_stock_kzics,
  mchb.kzvcl AS physical_inventory_indicator_unrestricted_use_stock_previous_period_kzvcl,
  mchb.kzvcq AS physical_inventory_indicator_quality_inspection_stock_previous_period_kzvcq,
  mchb.kzvce AS physical_inventory_indicator_restricted_use_stock_previous_period_kzvce,
  mchb.kzvcs AS physical_inventory_indicator_blocked_stock_previous_period_kzvcs,
  mchb.herkl AS country_of_origin_of_material_herkl,
  mchb.chdll AS date_of_last_count_chdll,
  mchb.chjin AS physical_inventory_year_of_current_period_chjin,
  mchb.chrue AS mchb_chrue,
  GREATEST(
    IFNULL(mchb.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(makt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001w.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mchb")} AS mchb
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "makt")} AS makt
  ON mchb.mandt = makt.mandt
  AND mchb.matnr = makt.matnr
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001w")} AS t001w
  ON mchb.mandt = t001w.mandt
  AND mchb.werks = t001w.werks
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mchb", "makt", "t001w"])
])}
`
);
