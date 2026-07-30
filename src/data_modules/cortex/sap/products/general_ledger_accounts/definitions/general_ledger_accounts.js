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
    "chart_of_accounts_ktopl",
    "gl_account_number_saknr",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  ska1.mandt AS client_mandt,
  ska1.ktopl AS chart_of_accounts_ktopl,
  ska1.saknr AS gl_account_number_saknr,
  skat.spras AS language_key_spras,
  ska1.xbilk AS balance_sheet_account_xbilk,
  ska1.sakan AS gl_account_sakan,
  ska1.bilkt AS group_account_number_bilkt,
  ska1.erdat AS created_on_erdat,
  ska1.ernam AS created_by_ernam,
  ska1.gvtyp AS pl_statement_account_type_gvtyp,
  ska1.ktoks AS account_group_ktoks,
  ska1.mustr AS sample_account_mustr,
  ska1.vbund AS trading_partner_vbund,
  ska1.xloev AS marked_for_deletion_xloev,
  ska1.xspea AS blocked_for_creation_xspea,
  ska1.xspeb AS blocked_for_posting_xspeb,
  ska1.xspep AS blocked_for_planning_xspep,
  ska1.mcod1 AS search_term_mcod1,
  ska1.func_area AS functional_area_func_area,
  skat.txt20 AS short_text_txt20,
  skat.txt50 AS gl_account_long_text_txt50,
  skat.mcod1 AS gl_long_text_mcod1,
  GREATEST(
    IFNULL(ska1.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(skat.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ska1")} AS ska1
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "skat")} AS skat
  ON ska1.mandt = skat.mandt
  AND ska1.ktopl = skat.ktopl
  AND ska1.saknr = skat.saknr
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ska1", "skat"])
])}
`
);
