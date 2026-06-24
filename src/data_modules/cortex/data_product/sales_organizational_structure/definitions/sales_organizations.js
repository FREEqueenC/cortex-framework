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
    "sales_organization_vkorg",
    "language_key_spras"
  ]
);

publish("sales_organizations", publishConfig).query(
  (ctx) => `
SELECT
  tvko.mandt as client_mandt,
  tvko.vkorg as sales_organization_vkorg,
  tvkot.spras as language_key_spras,
  tvkot.vtext as name_vtext,
  tvko.waers as statistics_currency_waers,
  tvko.bukrs as company_code_bukrs,
  tvko.adrnr as address_adrnr,
  tvko.txnam_adr as address_text_name_txnam_adr,
  tvko.txnam_kop as letter_header_text_txnam_kop,
  tvko.txnam_fus as footer_lines_text_txnam_fus,
  tvko.txnam_gru as greeting_text_name_txnam_gru,
  tvko.vkoau as refsorg_salesdoctype_vkoau,
  tvko.kunnr as cust_inter_co_bill_kunnr,
  tvko.boavo as rebate_proc_active_boavo,
  tvko.vkokl as sales_org_calendar_vkokl,
  tvko.ekorg as purch_organization_ekorg,
  tvko.ekgrp as purchasing_group_ekgrp,
  tvko.lifnr as vendor_lifnr,
  tvko.werks as plant_werks,
  tvko.bsart as order_type_bsart,
  tvko.bstyp as purch_doc_category_bstyp,
  tvko.bwart as movement_type_bwart,
  tvko.lgort as storage_location_lgort,
  tvko.txnam_sdb as text_sds_sender_txnam_sdb,
  tvko.mwskz as tax_code_for_sd_doc_mwskz,
  tvko.xstceg as tax_number_xstceg,
  tvko.j_1anutime as numbering_time_j_1anutime,
  tvko.maxbi as max_no_bill_items_maxbi,
  GREATEST(
    IFNULL(tvko.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(tvkot.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) as source_last_updated_at,
  CURRENT_TIMESTAMP() as bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvko')} AS tvko
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvkot')} AS tvkot
  ON tvko.mandt = tvkot.mandt
  AND tvko.vkorg = tvkot.vkorg
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["tvko", "tvkot"])
])}
`,
);
