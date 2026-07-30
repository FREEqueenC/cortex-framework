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
const materializationType = tableConfig.materializationType || "view";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "contract_type_rantyp",
    "treasury_id_number_ranl",
    "exchange_rhandpl",
    "rate_price_type_skursart",
    "rate_price_date_dkurs"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  atras.mandt AS client_mandt,
  atras.rantyp AS contract_type_rantyp,
  atras.ranl AS treasury_id_number_ranl,
  atras.rhandpl AS exchange_rhandpl,
  atras.skursart AS rate_price_type_skursart,
  atras.dkurs AS rate_price_date_dkurs,
  atras.waers AS quotation_currency_waers,
  atras.pkur AS price_in_percent_pkur,
  atras.pktkur AS treasury_price_pktkur,
  atras.skherk AS source_of_value_skherk,
  atras.sobjekt AS object_key_sobjekt,
  atras.rbear AS last_changed_by_rbear,
  atras.dbear AS last_edited_on_dbear,
  atras.tbear AS last_edited_at_tbear,
  atras.rfgeb AS releaser_rfgeb,
  atras.dfrei AS release_date_dfrei,
  atras.tfrei AS time_of_release_tfrei,
  atras.skzusa AS price_notation_skzusa,
  atras.skabsch AS price_markdown_skabsch,
  IFNULL(atras.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "atras")} AS atras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["atras"])
])}
`
);
