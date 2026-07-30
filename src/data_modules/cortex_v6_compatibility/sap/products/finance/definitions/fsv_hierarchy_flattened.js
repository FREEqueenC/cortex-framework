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

publish("fsv_hierarchy_flattened", { ...publishConfig, name: "FSVHierarchyFlattened" }).query(
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
  FSV.mandt AS Client_MANDT,
  FSV.chartofaccounts AS ChartOfAccounts,
  FSV.hiername AS HierarchyName,
  LanguageKey.LanguageKey_SPRAS,
  FSV.glaccount AS GeneralLedgerAccount,
  FSV.node AS GLNode,
  FSV.parent AS ParentNode,
  GLParentText.HierarchyNodeDescription_NODETXT AS ParentNodeText,
  COALESCE(GLNodeText.HierarchyNodeDescription_NODETXT, GLText.GlAccountLongText_TXT50) AS GLNodeText,
  FSV.level AS Level,
  FSV.isleafnode AS IsLeafNode
FROM
  ${ctx.ref('fsv_glaccounts')} AS FSV
CROSS JOIN LanguageKey
LEFT JOIN
  ${ctx.ref('FSVTextsMD')} AS GLNodeText
  ON
    FSV.mandt = GLNodeText.Client_MANDT
    AND FSV.hiername = GLNodeText.HierarchyID_HRYID
    AND FSV.HierarchyVersion = GLNodeText.HierarchyVersion_HRYVER
    AND FSV.Node = GLNodeText.HierarchyNode_HRYNODE
    AND GLNodeText.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'GLAccountsMD')} AS GLText
  ON
    FSV.mandt = GLText.Client_MANDT
    AND FSV.chartofaccounts = GLText.ChartOfAccounts_KTOPL
    AND FSV.glaccount = GLText.GlAccountNumber_SAKNR
    AND GLText.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  ${ctx.ref('FSVTextsMD')} AS GLParentText
  ON
    FSV.mandt = GLParentText.Client_MANDT
    AND FSV.hiername = GLParentText.HierarchyID_HRYID
    AND FSV.HierarchyVersion = GLParentText.HierarchyVersion_HRYVER
    AND FSV.Parent = GLParentText.HierarchyNode_HRYNODE
    AND GLParentText.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
`
);
