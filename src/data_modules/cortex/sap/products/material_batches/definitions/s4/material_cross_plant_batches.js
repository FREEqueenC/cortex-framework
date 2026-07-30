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
    "material_number_matnr",
    "batch_number_charg",
    "language_key_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  mch1.mandt AS client_mandt,
  mch1.matnr AS material_number_matnr,
  mch1.charg AS batch_number_charg,
  makt.spras AS language_key_spras,
  makt.maktx AS material_description_maktx,
  mch1.lvorm AS deletion_flag_for_all_data_in_a_batch_lvorm,
  mch1.ersda AS created_on_ersda,
  mch1.ernam AS created_by_ernam,
  mch1.aenam AS changed_by_aenam,
  mch1.laeda AS last_changed_on_laeda,
  mch1.verab AS availability_date_verab,
  mch1.vfdat AS shelf_life_expiration_or_best_before_date_vfdat,
  mch1.zusch AS batch_status_key_zusch,
  mch1.zustd AS batch_in_restricted_use_stock_zustd,
  mch1.zaedt AS last_status_change_date_zaedt,
  mch1.lifnr AS vendors_account_number_lifnr,
  mch1.licha AS supplier_batch_number_licha,
  mch1.vlcha AS original_batch_number_vlcha,
  mch1.vlwrk AS original_plant_vlwrk,
  mch1.vlmat AS original_material_vlmat,
  mch1.batch_id AS batch_id,
  mch1.xpcbt AS single_unit_batch_indicator_xpcbt,
  mch1.chame AS unit_of_issue_for_batch_chame,
  mch1.lwedt AS date_of_last_goods_receipt_lwedt,
  mch1.fvdt1 AS date_for_free_use1_fvdt1,
  mch1.fvdt2 AS date_for_free_use2_fvdt2,
  mch1.fvdt3 AS date_for_free_use3_fvdt3,
  mch1.fvdt4 AS date_for_free_use4_fvdt4,
  mch1.fvdt5 AS date_for_free_use5_fvdt5,
  mch1.fvdt6 AS date_for_free_use6_fvdt6,
  mch1.herkl AS country_of_origin_of_material_herkl,
  mch1.herkr AS region_of_origin_of_material_herkr,
  mch1.mtver AS material_group_for_intrastat_mtver,
  mch1.qndat AS next_inspection_date_qndat,
  mch1.hsdat AS date_of_manufacture_hsdat,
  mch1.cuobj_bm AS internal_object_number_batch_classification_cuobj_bm,
  mch1.deact_bm AS batch_is_no_longer_active_deact_bm,
  mch1.batch_type AS type_of_batch_batch_type,
  mch1.ersda_tmstp AS utc_timestamp_in_short_form_ersda_tmstp,
  mch1.ersda_tz_sys AS time_zone_ersda_tz_sys,
  mch1.ersda_tz_usr AS time_zone_ersda_tz_usr,  
  mch1.zfdat AS date_of_certification_zfdat,
  mch1.creation_datetime AS created_on_timestamp_creation_datetime,
  mch1.lastchange_datetime AS last_change_timestamp_lastchange_datetime,
  mch1.sttpec_sertype AS serialization_type_sttpec_sertype,
  mch1.sttpec_plant AS batch_production_plant_sttpec_plant,
  mch1.sttpec_synctime AS synchronization_time_stamp_sttpec_synctime,
  mch1.sttpec_syncact AS synchronization_active_sttpec_syncact,
  GREATEST(
    IFNULL(mch1.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(makt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mch1")} AS mch1
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "makt")} AS makt
  ON mch1.mandt = makt.mandt
  AND mch1.matnr = makt.matnr
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mch1", "makt"])
])}
`
);
