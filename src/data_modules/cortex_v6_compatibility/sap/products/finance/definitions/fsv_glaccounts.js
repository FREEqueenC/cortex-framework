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

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("fsv_glaccounts", { ...publishConfig, name: "fsv_glaccounts" }).query(
  (ctx) => `
WITH RECURSIVE fsv_hierarchy AS (
  -- Anchor Member: Root nodes (nodes in fagl_011pc that do not have a parent in the same version)
  SELECT
    mandt,
    versn,
    id AS node,
    parent AS parent_node,
    id AS root_node,
    1 AS level
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'fagl_011pc')} AS p
  WHERE
    parent = '' 
    OR parent IS NULL 
    OR parent NOT IN (
      SELECT DISTINCT id 
      FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'fagl_011pc')}
      WHERE versn = p.versn AND mandt = p.mandt
    )

  UNION ALL

  -- Recursive Member: Join children to their parents
  SELECT
    child.mandt,
    child.versn,
    child.id AS node,
    child.parent AS parent_node,
    h.root_node,
    h.level + 1 AS level
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'fagl_011pc')} AS child
  INNER JOIN
    fsv_hierarchy AS h
    ON child.mandt = h.mandt
      AND child.versn = h.versn
      AND child.parent = h.node
)

SELECT DISTINCT
  ska1.MANDT AS mandt,
  ska1.KTOPL AS chartofaccounts,
  zc.VERSN AS hiername,
  ska1.SAKNR AS glaccount,
  h.node AS node,
  h.parent_node AS parent,
  h.level AS level,
  IF(LTRIM(h.node, '0') = LTRIM(zc.ERGSL, '0'), TRUE, FALSE) AS isleafnode,
  CAST(NULL AS STRING) AS HierarchyVersion
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ska1')} AS ska1
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'fagl_011zc')} AS zc
  ON ska1.MANDT = zc.MANDT
    AND ska1.KTOPL = zc.KTOPL
INNER JOIN
  fsv_hierarchy AS h
  ON zc.MANDT = h.mandt
    AND zc.VERSN = h.versn
    AND LTRIM(zc.ERGSL, '0') = LTRIM(h.node, '0')
WHERE
  ska1.SAKNR BETWEEN zc.VONKT AND zc.BISKT
`
);
