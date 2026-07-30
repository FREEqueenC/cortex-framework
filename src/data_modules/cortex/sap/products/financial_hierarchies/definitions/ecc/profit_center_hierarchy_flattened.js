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
const materializationType = tableConfig.materializationType || "table";
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");
const language = require("includes/language.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "hierarchy_class_setclass",
    "hierarchy_subclass_subclass",
    "hierarchy_type_hierbase",
    "language_key_spras",
    "profit_center_prctr",
    "profit_center_node",
    "parent_node",
  ]
);

const filters = tableConfig.filters || {};  
const setClasses = filters.set_classes || ["0106"];
const languages = filters.languages || [filters.fallback_language || "E"];

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH RECURSIVE
  language_key AS (
    ${language.getLanguageKeys(ctx.ref(moduleConfig.sources.sapModule.datasetId, "t002"), languages)}
  ),

  parent_child AS (
    SELECT
      mandt,
      setclass,
      subclass,
      setname AS parent,
      subsetname AS node,
      false AS isleafnode,
      IFNULL(recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setnode')}
    WHERE
      setclass IN (${sql_helper.formatFilterArray(setClasses)})

    UNION ALL

    SELECT
      l.mandt,
      l.setclass,
      l.subclass,
      l.setname AS parent,
      c.prctr AS node,
      true AS isleafnode,
      GREATEST(
        IFNULL(l.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
        IFNULL(c.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
      ) AS recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setleaf')} l
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'cepc')} c
      ON l.mandt = c.mandt
      AND l.subclass = c.kokrs
      AND (
        (l.valoption = 'EQ' AND c.prctr = l.valfrom)
        OR (l.valoption = 'BT' AND c.prctr BETWEEN l.valfrom AND l.valto)
      )
    WHERE
      l.setclass IN (${sql_helper.formatFilterArray(setClasses)})
      AND c.datbi = '9999-12-31'
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
      setclass IN (${sql_helper.formatFilterArray(setClasses)})
    
    EXCEPT DISTINCT
    
    SELECT
      mandt,
      setclass,
      subclass,
      subsetname AS root_set
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'setnode')}
    WHERE
      setclass IN (${sql_helper.formatFilterArray(setClasses)})
  ),

  set_tree AS (
    SELECT
      r.mandt,
      r.setclass,
      r.subclass,
      r.root_set AS hiername,
      pc.parent,
      pc.node,
      pc.isleafnode,
      1 AS depth,
      pc.recordstamp
    FROM
      roots r
    INNER JOIN
      parent_child pc
      ON r.mandt = pc.mandt
      AND r.setclass = pc.setclass
      AND r.subclass = pc.subclass
      AND r.root_set = pc.parent

    UNION ALL

    SELECT
      t.mandt,
      t.setclass,
      t.subclass,
      t.hiername,
      pc.parent,
      pc.node,
      pc.isleafnode,
      t.depth + 1 AS depth,
      GREATEST(
        IFNULL(t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
        IFNULL(pc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
      ) AS recordstamp
    FROM
      set_tree t
    INNER JOIN
      parent_child pc
      ON t.mandt = pc.mandt
      AND t.setclass = pc.setclass
      AND t.subclass = pc.subclass
      AND t.node = pc.parent
  ),

  hierarchy AS (
    SELECT
      mandt,
      setclass,
      subclass,
      hiername,
      parent,
      node,
      node AS profitcenter,
      0 AS level,
      isleafnode,
      recordstamp
    FROM
      set_tree
    WHERE
      isleafnode

    UNION ALL

    SELECT
      h.mandt,
      h.setclass,
      h.subclass,
      h.hiername,
      t.parent,
      t.node,
      h.profitcenter,
      h.level + 1 AS level,
      false AS isleafnode,
      GREATEST(
        IFNULL(h.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
        IFNULL(t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
      ) AS recordstamp
    FROM
      hierarchy h
    INNER JOIN
      set_tree t
      ON h.mandt = t.mandt
      AND h.setclass = t.setclass
      AND h.subclass = t.subclass
      AND h.hiername = t.hiername
      AND h.parent = t.node
  )

SELECT
  h.mandt AS client_mandt,
  h.setclass AS hierarchy_class_setclass,
  h.subclass AS hierarchy_subclass_subclass,
  h.hiername AS hierarchy_type_hierbase,
  language_key.language_key_spras AS language_key_spras,
  h.profitcenter AS profit_center_prctr,
  h.node AS profit_center_node,
  h.parent AS parent_node,
  PCParentText.short_description_of_set_descript AS parent_node_text,
  COALESCE(PCNodeText.short_description_of_set_descript, PCText.ltext) AS profit_center_node_text,
  h.level AS level,
  h.isleafnode AS is_leaf_node,
  GREATEST(
    IFNULL(h.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(PCText.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  hierarchy h
CROSS JOIN
  language_key
LEFT JOIN
  ${ctx.ref(moduleConfig.targetDatasetId, "profit_center_group_hierarchy")} AS PCParentText
  ON h.mandt = PCParentText.client_mandt
  AND h.setclass = PCParentText.set_class_setclass
  AND h.subclass = PCParentText.subclass_subclass
  AND h.parent = PCParentText.set_name_setname
  AND PCParentText.language_key_langu = language_key.language_key_spras
LEFT JOIN
  ${ctx.ref(moduleConfig.targetDatasetId, "profit_center_group_hierarchy")} AS PCNodeText
  ON h.mandt = PCNodeText.client_mandt
  AND h.setclass = PCNodeText.set_class_setclass
  AND h.subclass = PCNodeText.subclass_subclass
  AND h.node = PCNodeText.set_name_setname
  AND PCNodeText.language_key_langu = language_key.language_key_spras
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cepct")} AS PCText
  ON h.mandt = PCText.mandt
  AND h.subclass = PCText.kokrs
  AND h.node = PCText.prctr
  AND PCText.spras = language_key.language_key_spras
  AND PCText.datbi = '9999-12-31'
`
);
