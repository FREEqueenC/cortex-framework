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
    "language_key_spras"
  ]
);

publish("materials_by_storage_location", publishConfig).query(
  (ctx) => `
SELECT
  mard.mandt AS client_mandt,
  mard.matnr AS material_number_matnr,
  makt.spras AS language_key_spras,
  makt.maktx AS material_text_maktx,
  mard.werks AS plant_werks,
  t001w.name1 AS plant_name_name1,
  mard.lgort AS storage_location_lgort,
  t001l.lgobe AS storage_location_text_lgobe,
  mard.pstat AS maintenance_status_pstat,
  mard.lvorm AS flag_material_for_deletion_at_storage_location_level_lvorm,
  mard.lfgja AS fiscal_year_of_current_period_lfgja,
  mard.lfmon AS current_period_lfmon,
  mard.sperr AS physical_inventory_blocking_indicator_sperr,
  mard.labst AS valuated_unrestricted_use_stock_labst,
  mard.umlme AS stock_in_transfer_umlme,
  mard.insme AS stock_in_quality_inspection_insme,
  mard.einme AS restricted_use_stock_einme,
  mard.speme AS blocked_stock_speme,
  mard.retme AS stock_in_returns_retme,
  mard.vmlab AS unrestricted_use_stock_in_previous_period_vmlab,
  mard.vmuml AS stock_in_transfer_in_previous_period_vmuml,
  mard.vmins AS stock_in_quality_inspection_in_previous_period_vmins,
  mard.vmein AS restricted_use_stock_in_previous_period_vmein,
  mard.vmspe AS blocked_stock_in_previous_period_vmspe,
  mard.vmret AS stock_in_returns_in_previous_period_vmret,
  mard.ersda AS created_on_ersda,
  GREATEST(
    IFNULL(mard.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(makt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001l.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001w.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mard")} AS mard
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "makt")} AS makt
  ON mard.mandt = makt.mandt AND mard.matnr = makt.matnr
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001w")} AS t001w
  ON mard.mandt = t001w.mandt AND mard.werks = t001w.werks
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001l")} AS t001l
  ON mard.mandt = t001l.mandt AND mard.werks = t001l.werks AND mard.lgort = t001l.lgort
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mard", "makt", "t001l", "t001w"])
])}
`
);
