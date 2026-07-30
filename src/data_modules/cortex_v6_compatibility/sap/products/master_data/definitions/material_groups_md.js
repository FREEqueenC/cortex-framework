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

publish("material_groups_md", { ...publishConfig, name: "MaterialGroupsMD" }).query(
  (ctx) => `
SELECT
  t023.mandt AS Client_MANDT,
  t023.matkl AS MaterialGroup_MATKL,
  t023.spart AS Division_SPART,
  t023.wwgda AS ReferenceGroupRefMaterial_WWGDA,
  t023.wwgpa AS GroupMaterial_WWGPA,
  t023.abtnr AS DepartmentNumber_ABTNR,
  t023.begru AS AuthorizationGroup_BEGRU,
  t023.gewei AS DefaultUnitofWeight_GEWEI,
  t023.bklas AS ValuationClass_BKLAS,
  t023.ekwsl AS PurchasingValueKey_EKWSL,
  t023.anlkl AS AssetClass_ANLKL,
  t023.price_group AS PriceLevelGroup_PRICE_GROUP,
  t023t.wgbez AS MaterialGroupName_WGBEZ,
  t023t.spras AS Language_SPRAS
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't023')} AS t023
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't023t')} AS t023t
  ON t023.mandt = t023t.mandt AND t023.matkl = t023t.matkl
`
);
