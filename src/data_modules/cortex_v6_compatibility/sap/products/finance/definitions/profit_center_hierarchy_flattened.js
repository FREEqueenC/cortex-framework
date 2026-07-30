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
const languages = moduleConfig.moduleSettings?.languages || ['E', 'S'];

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("profit_center_hierarchy_flattened", { ...publishConfig, name: "ProfitCenterHierarchyFlattened" }).query(
  (ctx) => `
WITH
  LanguageKey AS (
    SELECT
      LanguageKey_SPRAS
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'Languages_T002')}
    WHERE LanguageKey_SPRAS IN UNNEST(${JSON.stringify(languages)})
  )
SELECT
  ProfitCenters.mandt AS Client_MANDT,
  ProfitCenters.setclass AS HierarchyClass_SETCLASS,
  ProfitCenters.subclass AS HierarchySubClass_SUBCLASS,
  ProfitCenters.hiername AS HierarchyType_HIERBASE,
  LanguageKey.LanguageKey_SPRAS,
  ProfitCenters.profitcenter AS ProfitCenter_PRCTR,
  ProfitCenters.node AS ProfitCenterNode,
  ProfitCenters.parent AS ParentNode,
  PCParentText.ShortDescriptionOfSet_DESCRIPT AS ParentNodeText,
  COALESCE(PCNodeText.ShortDescriptionOfSet_DESCRIPT, PCText.LongText_LTEXT) AS ProfitCenterNodeText,
  ProfitCenters.level AS Level,
  ProfitCenters.isleafnode AS IsLeafNode
FROM
  ${ctx.ref(moduleConfig.targetDatasetId, 'profit_centers')} AS ProfitCenters
CROSS JOIN LanguageKey
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'ProfitCenterHierarchiesMD')} AS PCParentText
  ON
    ProfitCenters.mandt = PCParentText.Client_MANDT
    AND ProfitCenters.setclass = PCParentText.SetClass_SETCLASS
    AND ProfitCenters.subclass = PCParentText.OrganizationalUnit_SUBCLASS
    AND PCParentText.LanguageKey_LANGU = LanguageKey.LanguageKey_SPRAS
    AND PCParentText.SetName_SETNAME = ProfitCenters.parent
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'ProfitCenterHierarchiesMD')} AS PCNodeText
  ON
    ProfitCenters.mandt = PCNodeText.Client_MANDT
    AND ProfitCenters.setclass = PCNodeText.SetClass_SETCLASS
    AND ProfitCenters.subclass = PCNodeText.OrganizationalUnit_SUBCLASS
    AND PCNodeText.LanguageKey_LANGU = LanguageKey.LanguageKey_SPRAS
    AND PCNodeText.SetName_SETNAME = ProfitCenters.node
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'ProfitCentersMD')} AS PCText
  ON
    ProfitCenters.mandt = PCText.Client_MANDT
    AND ProfitCenters.subclass = PCText.ControllingArea_KOKRS
    AND ProfitCenters.node = PCText.ProfitCenter_PRCTR
    AND PCText.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
    AND PCText.ValidToDate_DATBI = '9999-12-31'
`
);
