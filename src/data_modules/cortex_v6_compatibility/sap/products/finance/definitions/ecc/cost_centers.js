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
WITH RECURSIVE
  parent_child AS (
    SELECT
      mandt,
      setclass,
      subclass,
      setname AS parent,
      subsetname AS node,
      FALSE AS isleafnode,
      CAST(NULL AS STRING) AS value_from,
      CAST(NULL AS STRING) AS value_to
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setnode')}
    WHERE
      setclass = '0101'
      AND subclass = '${costCenterHierarchySubclass}'

    UNION ALL

    SELECT
      l.mandt,
      l.setclass,
      l.subclass,
      l.setname AS parent,
      c.kostl AS node,
      TRUE AS isleafnode,
      l.valfrom AS value_from,
      l.valto AS value_to
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setleaf')} AS l
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'csks')} AS c
      ON l.mandt = c.mandt
      AND l.subclass = c.kokrs
      AND (
        (l.valoption = 'EQ' AND c.kostl = l.valfrom)
        OR (l.valoption = 'BT' AND c.kostl BETWEEN l.valfrom AND l.valto)
      )
    WHERE
      l.setclass = '0101'
      AND l.subclass = '${costCenterHierarchySubclass}'
      AND c.datbi >= '9999-12-31'
  ),

  roots AS (
    SELECT
      mandt,
      setclass,
      subclass,
      setname AS root_set
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setheader')}
    WHERE
      setclass = '0101'
      AND subclass = '${costCenterHierarchySubclass}'
    
    EXCEPT DISTINCT
    
    SELECT
      mandt,
      setclass,
      subclass,
      subsetname AS root_set
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setnode')}
    WHERE
      setclass = '0101'
      AND subclass = '${costCenterHierarchySubclass}'
  ),

  set_tree AS (
    SELECT
      r.mandt,
      r.setclass,
      r.subclass,
      r.root_set AS hiername,
      CAST(NULL AS STRING) AS parent,
      r.root_set AS node,
      FALSE AS isleafnode,
      1 AS level,
      CAST(NULL AS STRING) AS value_from,
      CAST(NULL AS STRING) AS value_to
    FROM
      roots r

    UNION ALL

    SELECT
      t.mandt,
      t.setclass,
      t.subclass,
      t.hiername,
      t.node AS parent,
      pc.node,
      pc.isleafnode,
      t.level + 1 AS level,
      pc.value_from,
      pc.value_to
    FROM
      set_tree t
    INNER JOIN
      parent_child pc
      ON t.mandt = pc.mandt
      AND t.setclass = pc.setclass
      AND t.subclass = pc.subclass
      AND t.node = pc.parent
  ),

  sethanahier AS (
    SELECT
      mandt,
      setclass,
      subclass,
      hiername,
      node,
      parent,
      level,
      isleafnode,
      value_from,
      value_to
    FROM
      set_tree
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
