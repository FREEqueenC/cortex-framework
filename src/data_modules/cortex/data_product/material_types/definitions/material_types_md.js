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

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "material_type_mtart",
    "language_key_spras"
  ]
);

publish("material_types_md", publishConfig).query(
  (ctx) => `
SELECT
  t134.mandt AS client_mandt,
  t134t.spras AS language_key_spras,
  t134.mtart AS material_type_mtart,
  t134.mtref AS reference_material_type_mtref,
  t134.mbref AS screen_reference_mbref,
  t134t.mtbez AS description_mtbez,
  t134.aranz AS display_material_aranz,
  t134.ardel AS time_till_deleted_ardel,
  t134.begru AS authorization_group_begru,
  t134.bsext AS external_purchase_orders_bsext,
  t134.bsint AS internal_purchase_orders_bsint,
  t134.cchis AS history_requirement_cchis,
  t134.chneu AS create_new_batch_chneu,
  t134.class AS class_class,
  t134.ctype AS class_type_ctype,
  t134.ekalr AS with_quantity_structure_ekalr,
  t134.envop AS external_number_assignment_indicator_envop,
  t134.flref AS field_reference_flref,
  t134.izust AS initial_status_izust,
  t134.kkref AS account_category_reference_kkref,
  t134.kzgrp AS grouping_indicator_kzgrp,
  t134.kzkfg AS configurable_material_kzkfg,
  t134.kzmpn AS manufacturer_part_kzmpn,
  t134.kzpip AS pipeline_mandatory_indicator_kzpip,
  t134.kzprc AS material_for_process_kzprc,
  t134.kzrac AS returnable_packaging_logistics_mandatory_indicator_kzrac,
  t134.kzvpr AS price_control_mandatory_indicator_kzvpr,
  t134.mstae AS cross_plant_status_mstae,
  t134.prdru AS print_price_indicator_prdru,
  t134.pstat AS maintenance_status_pstat,
  t134.vmtpo AS item_category_group_vmtpo,
  t134.vprsv AS price_control_vprsv,
  t134.vtype AS version_category_vtype,
  t134.wmakg AS material_type_id_wmakg,
  GREATEST(
    IFNULL(t134.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t134t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t134")} AS t134
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t134t")} AS t134t
  ON t134.mandt = t134t.mandt AND t134.mtart = t134t.mtart
${incremental.getWhere(ctx, ["t134.recordstamp", "t134t.recordstamp"])}
`,
);
