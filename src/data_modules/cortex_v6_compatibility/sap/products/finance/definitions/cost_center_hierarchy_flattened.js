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

publish("cost_center_hierarchy_flattened", { ...publishConfig, name: "CostCenterHierarchyFlattened" }).query(
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
  CostCenters.mandt AS Client_MANDT,
  CostCenters.setclass AS HierarchyClass_SETCLASS,
  CostCenters.subclass AS HierarchySubClass_SUBCLASS,
  CostCenters.hiername AS HierarchyType_HIERBASE,
  LanguageKey.LanguageKey_SPRAS,
  CostCenters.costcenter AS CostCenter_KOSTL,
  CostCenters.node AS CostCenterNode,
  CostCenters.parent AS ParentNode,
  CCParentText.ShortDescriptionOfSet_DESCRIPT AS ParentNodeText,
  COALESCE(CCNodeText.ShortDescriptionOfSet_DESCRIPT, CCText.Description_LTEXT) AS CostCenterNodeText,
  CostCenters.level AS Level,
  CostCenters.isleafnode AS IsLeafNode
FROM
  ${ctx.ref(moduleConfig.targetDatasetId, 'cost_centers')} AS CostCenters
CROSS JOIN LanguageKey
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CostCenterHierarchiesMD')} AS CCParentText
  ON
    CostCenters.mandt = CCParentText.Client_MANDT
    AND CostCenters.setclass = CCParentText.SetClass_SETCLASS
    AND CostCenters.subclass = CCParentText.OrganizationalUnit_SUBCLASS
    AND CCParentText.LanguageKey_LANGU = LanguageKey.LanguageKey_SPRAS
    AND CCParentText.SetName_SETNAME = CostCenters.parent
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CostCenterHierarchiesMD')} AS CCNodeText
  ON
    CostCenters.mandt = CCNodeText.Client_MANDT
    AND CostCenters.setclass = CCNodeText.SetClass_SETCLASS
    AND CostCenters.subclass = CCNodeText.OrganizationalUnit_SUBCLASS
    AND CCNodeText.LanguageKey_LANGU = LanguageKey.LanguageKey_SPRAS
    AND CCNodeText.SetName_SETNAME = CostCenters.node
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CostCentersMD')} AS CCText
  ON
    CostCenters.mandt = CCText.Client_MANDT
    AND CostCenters.subclass = CCText.ControllingArea_KOKRS
    AND CostCenters.node = CCText.CostCenter_KOSTL
    AND CCText.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
    AND CCText.ValidTo_DATBI = '9999-12-31'
`
);
