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

publish("product_hierarchies_md", { ...publishConfig, name: "ProductHierarchiesMD" }).query(
  (ctx) => `
SELECT t179.mandt AS Client_MANDT,
  t179.prodh AS Hierarchy_PRODH,
  t179.stufe AS Level_STUFE,
  t179t.spras AS Language_SPRAS,
  t179t.vtext AS Description_VTEXT
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179')} AS t179
INNER JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't179t')} AS t179t
  ON t179.mandt = t179t.mandt AND t179.prodh = t179t.prodh
`
);
