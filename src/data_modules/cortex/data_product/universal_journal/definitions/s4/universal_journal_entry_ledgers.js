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
const materializationType = tableConfig.materializationType || "table";
const publish_config = require("includes/cortex/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "ledger_rldnr",
    "language_langu"
  ]
);

publish("universal_journal_entry_ledgers", publishConfig).query(
  (ctx) => `
SELECT
  finsc_ledger.mandt AS client_mandt,
  finsc_ledger.rldnr AS ledger_rldnr,
  finsc_ledger_t.langu AS language_langu,
  finsc_ledger_t.name AS ledger_name_name,
  finsc_ledger.ledger_type AS ledger_type_ledger_type,
  finsc_ledger.ext_ledger_type AS extension_ledger_type_ext_ledger_type,
  finsc_ledger.appl AS owner_application_appl,
  finsc_ledger.subappl AS sub_application_subappl,
  finsc_ledger.xleading AS leading_ledger_indicator_xleading,
  finsc_ledger.core AS underlying_ledger_core,
  finsc_ledger.valutyp AS valuation_type_valutyp,
  finsc_ledger.valusubtyp AS valuation_subtype_valusubtyp,
  finsc_ledger.man_post_not_allwd AS manual_postings_not_allowed_man_post_not_allwd,
  finsc_ledger.acc_principle AS accounting_principle_acc_principle,
  finsc_ledger.fallback_ledger AS fallback_ledger_fallback_ledger,
  finsc_ledger.tech_ledger AS technical_ledger_tech_ledger,
  finsc_ledger.xcash_ledger AS cash_ledger_indicator_xcash_ledger,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "finsc_ledger")} AS finsc_ledger
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "finsc_ledger_t")} AS finsc_ledger_t
  ON finsc_ledger.mandt = finsc_ledger_t.mandt
  AND finsc_ledger.rldnr = finsc_ledger_t.rldnr
`
);
