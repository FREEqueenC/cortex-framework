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
    "client_client",
    "business_partner_partner",
    "bank_details_id_bkvid",
    "valid_from"
  ]
);

publish("business_partner_bank_details", publishConfig).query(
  (ctx) => `
SELECT
  but0bk.mandt AS client_client,
  but0bk.partner AS business_partner_partner,
  but0bk.bkvid AS bank_details_id_bkvid,
  ${sql_helper.parseValidityFromTimestamp("but0bk.bk_valid_from")} AS valid_from,
  ${sql_helper.parseValidityToTimestamp("but0bk.bk_valid_to")} AS valid_to,
  but0bk.banks AS bank_country_banks,
  but0bk.bankl AS bank_key_bankl,
  but0bk.bankn AS bank_acct_bankn,
  but0bk.bkont AS bank_control_key_bkont,
  but0bk.bkref AS reference_details_bkref,
  but0bk.koinh AS account_holder_koinh,
  but0bk.bkext AS extern_bank_dtls_id_bkext,
  but0bk.xezer AS collection_authorization_xezer,
  but0bk.accname AS account_name_accname,
  but0bk.move_bkvid AS target_bank_details_move_bkvid,
  but0bk.bk_move_date AS date_of_change_bk_move_date,
  but0bk.iban AS iban_iban,
  but0bk.bank_guid AS bank_guid_bank_guid,
  but0bk.account_id AS bank_account_number_account_id,
  but0bk.check_digit AS bank_account_check_digit_check_digit,
  but0bk.account_type AS bank_account_type_account_type,
  but0bk.bp_eew_but0bk AS dummy_function_in_length_1_bp_eew_but0bk,
  but0bk.recordstamp AS but0bk_recordstamp,
  GREATEST(
    IFNULL(but0bk.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "but0bk")} AS but0bk
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["but0bk"])
])}
`
);
