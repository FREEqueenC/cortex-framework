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
    "language_key_spras",
    "transaction_type_bwasl"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  tabw.mandt AS client_mandt,
  tabwt.spras AS language_key_spras,
  tabw.bwasl AS transaction_type_bwasl,
  tabwt.bwatxt AS transaction_type_name_bwatxt,
  tabw.bwagrp AS transaction_type_group_bwagrp,
  tabwh.bwgtxt AS transaction_type_group_name_bwgtxt,
  tabw.xverga AS transaction_in_past_xverga,
  tabw.xaktiv AS capitalize_fixed_asset_xaktiv,
  tabw.xdeakt AS deactivate_fixed_asset_xdeakt,
  tabw.xabgmm AS gain_loss_from_asset_retirement_xabgmm,
  tabw.xerlos AS retirement_with_revenue_xerlos,
  tabw.xaverb AS transfer_between_affiliates_gross_xaverb,
  tabw.xabuch AS cannot_be_used_manually_xabuch,
  tabw.bwakon AS consolidation_transaction_type_bwakon,
  tabw.xprjkt AS account_assignment_to_project_xprjkt,
  tabw.anshkz AS debit_credit_indicator_anshkz,
  tabw.bwaslg AS offsetting_transaction_type_bwaslg,
  tabw.blart AS document_type_blart,
  tabw.xabinv AS repay_investment_support_xabinv,
  tabw.bwasln AS acquisition_in_same_year_bwasln,
  tabw.gittgr AS asset_history_sheet_group_gittgr,
  tabw.xabgwg AS lva_retirement_simulation_xabgwg,
  tabw.xabimm AS retirement_intangibles_simulation_xabimm,
  tabw.xusbwa AS individual_check_required_xusbwa,
  tabw.xumbhi AS adopt_depreciation_start_date_xumbhi,
  tabw.xifrel AS post_gain_loss_to_asset_xifrel,
  tabw.xcoobj AS budget_relevant_xcoobj,
  tabw.xaverbn AS post_to_affiliate_net_xaverbn,
  tabw.xzugbr AS enter_gross_acquisition_xzugbr,
  tabw.xumja AS changeover_year_set_xumja,
  tabw.rsn_code AS asset_transaction_category_rsn_code,
  tabw.xobs AS transaction_type_obsolete_xobs,
  GREATEST(
    IFNULL(tabw.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tabwt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tabwh.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tabw")} AS tabw
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tabwt")} AS tabwt
  ON tabw.mandt = tabwt.mandt
  AND tabw.bwasl = tabwt.bwasl
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tabwh")} AS tabwh
  ON tabw.mandt = tabwh.mandt
  AND tabw.bwagrp = tabwh.bwagrp
  AND tabwt.spras = tabwh.spras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["tabw", "tabwt", "tabwh"])
])}
`
);
