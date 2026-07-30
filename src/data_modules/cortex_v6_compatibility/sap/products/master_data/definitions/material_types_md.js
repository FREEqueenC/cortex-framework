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
const publish_config = require("includes/publish_config.js");

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("material_types_md", { ...publishConfig, name: "MaterialTypesMD" }).query(
  (ctx) => `
SELECT
  t134.mandt AS Client_MANDT,
  t134.mtart AS MaterialType_MTART,
  t134.mtref AS ReferenceMaterialType_MTREF,
  t134.mbref AS ScreenReferenceDependingOnTheMaterialType_MBREF,
  t134t.spras AS LanguageKey_SPRAS,
  t134t.mtbez AS DescriptionOfMaterialType_MTBEZ
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't134')} AS t134
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't134t')} AS t134t
  ON t134.mandt = t134t.mandt AND t134.mtart = t134t.mtart
`
);
