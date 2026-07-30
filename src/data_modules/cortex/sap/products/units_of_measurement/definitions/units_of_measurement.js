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
    "unit_of_measurement_msehi",
    "language_key_spras",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t006.mandt AS client_mandt,
  t006.msehi AS unit_of_measurement_msehi,
  t006a.spras AS language_key_spras,
  t006.kzex3 AS three_char_indicator_for_external_unit_of_measurement_kzex3,
  t006.kzex6 AS six_char_id_for_external_unit_of_measurement_kzex6,
  t006.isocode AS iso_code_isocode,
  t006.primary AS primary_code_primary,
  t006.kzkeh AS commercial_measurement_unit_kzkeh,
  t006.andec AS decimal_rounding_andec,
  t006.decan AS decimal_places_decan,
  t006.exp10 AS exponent_exp10,
  t006.expon AS exponent_floating_point_expon,
  t006.zaehl AS numerator_zaehl,
  t006.nennr AS denominator_nennr,
  t006.addko AS additive_constant_addko,
  t006.dimid AS dimension_dimid,
  t006.famunit AS unit_of_measurement_family_famunit,
  t006.temp_value AS temperature_temp_value,
  t006.temp_unit AS temperature_unit_temp_unit,
  t006.press_val AS pressure_value_press_val,
  t006.press_unit AS unit_of_pressure_press_unit,
  t006a.mseht AS measuremt_unit_text_mseht,
  t006a.msehl AS unit_text_msehl,
  t006a.mseh3 AS three_char_commercial_text_mseh3,
  t006a.mseh6 AS six_char_technical_text_mseh6,
  t006t.txdim AS dimension_text_txdim,
  t006.kz1eh AS one_unit_kz1eh,
  t006.kz2eh AS two_unit_kz2eh,
  t006.kzwob AS value_based_commitment_indicator_kzwob,
  GREATEST(
    IFNULL(t006.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t006a.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t006t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t006")} AS t006
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t006t")} AS t006t
  ON
    t006.mandt = t006t.mandt
    AND t006.dimid = t006t.dimid
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t006a")} AS t006a
  ON
    t006.mandt = t006a.mandt
    AND t006.msehi = t006a.msehi
    AND t006a.spras = t006t.spras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t006", "t006a", "t006t"])
])}
`
);
