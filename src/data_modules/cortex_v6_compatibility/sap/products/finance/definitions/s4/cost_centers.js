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
const costCenterHierarchySubclass = moduleConfig.moduleSettings?.costCenterHierarchySubclass || 'A000';

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("cost_centers", { ...publishConfig, name: "cost_centers" }).query(
  (ctx) => `
WITH RECURSIVE sethanahier AS (
  SELECT
    child.mandt,
    child.setclass,
    child.subclass,
    child.hierbase AS hiername,
    child.setname AS node,
    parent.setname AS parent,
    child.hlevel AS level,
    child.succ,
    FALSE AS isleafnode,
    CAST(NULL AS STRING) AS value_from,
    CAST(NULL AS STRING) AS value_to
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'sethanahier0101')} AS child
  LEFT JOIN
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'sethanahier0101')} AS parent
    ON child.mandt = parent.mandt
    AND child.setclass = parent.setclass
    AND child.subclass = parent.subclass
    AND child.hierbase = parent.hierbase
    AND child.pred = parent.succ
    AND parent.hlevel != 0
  WHERE
    child.mandt = '${moduleConfig.sources.sapModule.mandt}'
    AND child.setclass = '0101'
    AND child.subclass = '${costCenterHierarchySubclass}'
    AND child.hlevel != 0

  UNION ALL

  SELECT
    h.mandt,
    h.setclass,
    h.subclass,
    h.hiername,
    c.kostl AS node,
    h.node AS parent,
    h.level,
    CAST(NULL AS INT64) AS succ,
    TRUE AS isleafnode,
    h.value_from,
    h.value_to
  FROM
    sethanahier AS h
  CROSS JOIN
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'csks')} AS c
  WHERE
    h.mandt = '${moduleConfig.sources.sapModule.mandt}'
    AND h.setclass = '0101'
    AND h.subclass = '${costCenterHierarchySubclass}'
    AND h.value_from IS NOT NULL
    AND h.succ != -1
    AND c.mandt = '${moduleConfig.sources.sapModule.mandt}'
    AND c.kokrs = '${costCenterHierarchySubclass}'
    AND c.datbi >= '9999-12-31'
    AND c.kostl BETWEEN h.value_from AND h.value_to
),

cost_center_parents AS (
  SELECT
    mandt,
    setclass,
    subclass,
    hiername,
    parent,
    node,
    node AS costcenter,
    level,
    isleafnode
  FROM
    sethanahier
  WHERE
    isleafnode

  UNION ALL

  SELECT
    h.mandt,
    h.setclass,
    h.subclass,
    h.hiername,
    p.parent,
    p.node,
    h.costcenter,
    p.level,
    p.isleafnode
  FROM
    cost_center_parents AS h
  INNER JOIN
    sethanahier AS p
    ON
      h.mandt = p.mandt
      AND h.setclass = p.setclass
      AND h.subclass = p.subclass
      AND h.hiername = p.hiername
      AND h.parent = p.node
)

SELECT DISTINCT
  mandt,
  setclass,
  subclass,
  hiername,
  parent,
  node,
  costcenter,
  level,
  isleafnode
FROM
  cost_center_parents
`
);
