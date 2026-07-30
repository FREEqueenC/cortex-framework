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
    "purchasing_document_ebeln",
    "item_ebelp",
    "sequential_number_etens"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  ekes.mandt AS client_mandt,
  ekes.ebeln AS purchasing_document_ebeln,
  ekes.ebelp AS item_ebelp,
  ekes.etens AS sequential_number_etens,
  ekes.ebtyp AS confirm_category_ebtyp,
  ekes.eindt AS delivery_date_eindt,
  ekes.lpein AS deliv_date_category_lpein,
  ekes.uzeit AS time_uzeit,
  ekes.erdat AS creation_date_erdat,
  ekes.ezeit AS creation_time_ezeit,
  ekes.menge AS quantity_menge,
  ekes.dabmg AS quantity_reduced_mrp_dabmg,
  ekes.estkz AS creation_indicator_estkz,
  ekes.loekz AS deletion_indicator_loekz,
  ekes.kzdis AS mrp_relevant_kzdis,
  ekes.xblnr AS reference_xblnr,
  ekes.vbeln AS delivery_vbeln,
  ekes.vbelp AS item_vbelp,
  ekes.mprof AS mfr_part_profile_mprof,
  ekes.ematn AS mpn_material_ematn,
  ekes.mahnz AS number_rem_expediters_mahnz,
  ekes.charg AS batch_charg,
  ekes.uecha AS higherlevelitembatch_uecha,
  ekes.ref_etens AS sequential_number_reference_etens,
  ekes.imwrk AS in_plant_imwrk,
  ekes.vbeln_st AS delivery_vbeln_st,
  ekes.vbelp_st AS item_vbelp_st,
  ekes.handoverdate AS handover_date_handoverdate,
  ekes.handovertime AS handover_time_handovertime,
  ekes.sgt_scat AS stock_segment_sgt_scat,
  ekes.fsh_salloc_qty AS allocated_stock_quantity_fsh_salloc_qty,
  IFNULL(
    ekes.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ekes")} AS ekes
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ekes"])
])}
`
);
