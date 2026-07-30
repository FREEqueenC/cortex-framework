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
    "cost_element_kstar",
    "valid_to_datbi",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  cskb.mandt AS client_mandt,
  cskb.kokrs AS controlling_area_kokrs,
  cskb.kstar AS cost_element_kstar,
  cskb.datbi AS valid_to_datbi,
  csku.spras AS language_key_spras,
  tka01.ktopl AS chart_of_accounts_ktopl,
  cskb.datab AS valid_from_datab,
  cskb.katyp AS celem_category_katyp,
  cskb.ersda AS entered_on_ersda,
  cskb.usnam AS created_by_usnam,
  cskb.eigen AS attribute_mix_eigen,
  cskb.plazu AS planning_access_plazu,
  cskb.plaor AS planning_location_plaor,
  cskb.plaus AS planning_user_plaus,
  cskb.kostl AS cost_center_kostl,
  cskb.aufnr AS order_aufnr,
  cskb.mgefl AS record_quantity_mgefl,
  cskb.msehi AS internal_uom_msehi,
  cskb.deakt AS deakt_deakt,
  cskb.loevm AS deletion_flag_loevm,
  cskb.last_changed_ts AS timestamp_last_changed_ts,
  cskb.recid AS recovery_indicator_recid,
  csku.ktext AS name_ktext,
  csku.ltext AS description_ltext,
  csku.mctxt AS cost_element_short_text_mctxt,
  GREATEST(
    IFNULL(cskb.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tka01.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(csku.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cskb")} AS cskb
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tka01")} AS tka01
  ON cskb.mandt = tka01.mandt
  AND cskb.kokrs = tka01.kokrs
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "csku")} AS csku
  ON cskb.mandt = csku.mandt
  AND tka01.ktopl = csku.ktopl
  AND cskb.kstar = csku.kstar
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["cskb", "tka01", "csku"])
])}
`
);
