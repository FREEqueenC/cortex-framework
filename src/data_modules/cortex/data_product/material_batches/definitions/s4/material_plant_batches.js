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
    "batch_number_charg",
    "language_key_spras"
  ]
);

publish('material_plant_batches', publishConfig).query(
  (ctx) => `
SELECT
  mcha.mandt AS client_mandt,
  mcha.matnr AS material_number_matnr,
  mcha.werks AS plant_werks,
  mcha.charg AS batch_number_charg,
  makt.spras AS language_key_spras,
  makt.maktx AS material_description_maktx,
  t001w.name1 AS plant_name_name1,
  mcha.lvorm AS deletion_flag_for_all_data_in_a_batch_lvorm,
  mcha.ersda AS created_on_ersda,
  mcha.ernam AS created_by_ernam,
  mcha.aenam AS changed_by_aenam,
  mcha.laeda AS last_changed_on_laeda,
  mcha.verab AS availability_date_verab,
  mcha.vfdat AS shelf_life_expiration_or_best_before_date_vfdat,
  mcha.zusch AS batch_status_key_zusch,
  mcha.zustd AS batch_in_restricted_use_stock_zustd,
  mcha.zaedt AS last_status_change_date_zaedt,
  mcha.lifnr AS vendors_account_number_lifnr,
  mcha.licha AS supplier_batch_number_licha,
  mcha.vlcha AS original_batch_number_vlcha,
  mcha.vlwrk AS original_plant_vlwrk,
  mcha.vlmat AS original_material_vlmat,
  mcha.bwtar AS valuation_type_bwtar,
  mcha.batch_id AS batch_id,
  mcha.xpcbt AS single_unit_batch_indicator_xpcbt,
  mcha.chame AS unit_of_issue_for_batch_chame,
  mcha.lwedt AS date_of_last_goods_receipt_lwedt,
  mcha.fvdt1 AS date_for_free_use1_fvdt1,
  mcha.fvdt2 AS date_for_free_use2_fvdt2,
  mcha.fvdt3 AS date_for_free_use3_fvdt3,
  mcha.fvdt4 AS date_for_free_use4_fvdt4,
  mcha.fvdt5 AS date_for_free_use5_fvdt5,
  mcha.fvdt6 AS date_for_free_use6_fvdt6,
  mcha.herkl AS country_of_origin_of_material_herkl,
  mcha.herkr AS region_of_origin_of_material_herkr,
  mcha.mtver AS material_group_for_intrastat_mtver,
  mcha.qndat AS next_inspection_date_qndat,
  mcha.hsdat AS date_of_manufacture_hsdat,
  mcha.cuobj_bm AS internal_object_number_batch_classification_cuobj_bm,
  mcha.deact_bm AS batch_is_no_longer_active_deact_bm,
  mcha.batch_type AS type_of_batch_batch_type,
  mcha.ersda_tmstp AS utc_timestamp_in_short_form_ersda_tmstp,
  mcha.ersda_tz_sys AS time_zone_ersda_tz_sys,
  mcha.ersda_tz_usr AS time_zone_ersda_tz_usr,  
  mcha.zfdat AS date_of_certification_zfdat,
  mcha.creation_datetime AS created_on_timestamp_creation_datetime,
  mcha.lastchange_datetime AS last_change_timestamp_lastchange_datetime,
  mcha.sttpec_sertype AS serialization_type_sttpec_sertype,
  mcha.sttpec_plant AS batch_production_plant_sttpec_plant,
  mcha.sttpec_synctime AS synchronization_time_stamp_sttpec_synctime,
  mcha.sttpec_syncact AS synchronization_active_sttpec_syncact,
  GREATEST(
    IFNULL(mcha.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(makt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t001w.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mcha")} AS mcha
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "makt")} AS makt
  ON mcha.mandt = makt.mandt
  AND mcha.matnr = makt.matnr
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t001w")} AS t001w
  ON mcha.mandt = t001w.mandt
  AND mcha.werks = t001w.werks
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mcha", "makt", "t001w"])
])}
`
);
