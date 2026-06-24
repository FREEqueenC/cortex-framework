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
    "sales_document_vbeln",
    "sales_document_item_posnr",
    "partner_function_parvw"
  ]
);

publish("sales_document_partners", publishConfig).query(
  (ctx) => `
SELECT
  vbpa.mandt AS client_mandt,
  vbpa.vbeln AS sales_document_vbeln,
  vbpa.posnr AS sales_document_item_posnr,
  vbpa.parvw AS partner_function_parvw,
  vbpa.kunnr AS customer_number_kunnr,
  vbpa.lifnr AS vendor_number_lifnr,
  vbpa.pernr AS personnel_number_pernr,
  vbpa.parnr AS contact_person_number_parnr,
  vbpa.adrnr AS address_number_adrnr,
  vbpa.ablad AS unloading_point_ablad,
  vbpa.land1 AS country_key_land1,
  vbpa.adrda AS address_indicator_adrda,
  vbpa.xcpdk AS one_time_account_indicator_xcpdk,
  vbpa.hityp AS customer_hierarchy_type_hityp,
  vbpa.prfre AS price_determination_indicator_prfre,
  vbpa.bokre AS rebate_indicator_bokre,
  vbpa.histunr AS hierarchy_level_histunr,
  vbpa.knref AS partner_description_knref,
  vbpa.lzone AS transportation_zone_lzone,
  vbpa.hzuor AS hierarchy_assignment_hzuor,
  vbpa.stceg AS vat_registration_number_stceg,
  vbpa.parvw_ff AS further_partners_parvw_ff,
  vbpa.adrnp AS person_number_adrnp,
  vbpa.kale AS maintain_appointments_indicator_kale,
  IFNULL(
    vbpa.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "vbpa")} AS vbpa
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["vbpa"])
])}
`,
);
