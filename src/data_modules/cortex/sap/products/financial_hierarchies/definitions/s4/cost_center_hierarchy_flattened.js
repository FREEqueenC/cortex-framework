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
    "cost_center_kostl",
    "cost_center_node",
    "parent_node",
  ]
);

const filters = tableConfig.filters || {};
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
      hierbase,
      CAST(pred AS STRING) AS parent,
      CAST(succ AS STRING) AS node,
      false AS isleafnode,
      IFNULL(recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'sethanahier0101')}

    UNION ALL

    SELECT
      h.mandt,
      h.setclass,
      h.subclass,
      h.hierbase,
      CAST(h.succ AS STRING) AS parent,
      c.kostl AS node,
      true AS isleafnode,
      GREATEST(
        IFNULL(h.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
        IFNULL(c.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
      ) AS recordstamp
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'sethanahier0101')} h
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'csks')} c
      ON h.mandt = c.mandt
      AND h.subclass = c.kokrs
      AND c.kostl BETWEEN h.value_from AND h.value_to
    WHERE
      h.value_from IS NOT NULL
      AND c.datbi = '9999-12-31'
  ),

  hierarchy AS (
    SELECT
      mandt,
      setclass,
      subclass,
      hierbase,
      parent,
      node,
      node AS costcenter,
      0 AS level,
      isleafnode,
      recordstamp
    FROM
      parent_child
    WHERE
      isleafnode

    UNION ALL

    SELECT
      h.mandt,
      h.setclass,
      h.subclass,
      h.hierbase,
      pc.parent,
      pc.node,
      h.costcenter,
      h.level + 1 AS level,
      false AS isleafnode,
      GREATEST(
        IFNULL(h.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
        IFNULL(pc.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
      ) AS recordstamp
    FROM
      hierarchy h
    INNER JOIN
      parent_child pc
      ON h.mandt = pc.mandt
      AND h.setclass = pc.setclass
      AND h.subclass = pc.subclass
      AND h.hierbase = pc.hierbase
      AND h.parent = pc.node
  )

SELECT
  h.mandt AS client_mandt,
  h.setclass AS hierarchy_class_setclass,
  h.subclass AS hierarchy_subclass_subclass,
  h.hierbase AS hierarchy_type_hierbase,
  language_key.language_key_spras AS language_key_spras,
  h.costcenter AS cost_center_kostl,
  h.node AS cost_center_node,
  h.parent AS parent_node,
  CCParentText.set_name_setname AS parent_node_text,
  COALESCE(CCNodeText.set_name_setname, CCText.ltext) AS cost_center_node_text,
  h.level AS level,
  h.isleafnode AS is_leaf_node,
  GREATEST(
    IFNULL(h.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(CCText.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  hierarchy h
CROSS JOIN
  language_key
LEFT JOIN
  ${ctx.ref(moduleConfig.targetDatasetId, "cost_center_group_hierarchy")} AS CCParentText
  ON h.mandt = CCParentText.client_mandt
  AND h.setclass = CCParentText.set_class_setclass
  AND h.subclass = CCParentText.subclass_subclass
  AND h.hierbase = CCParentText.hierarchy_base_hierbase
  AND h.parent = CCParentText.successor_node_succ
LEFT JOIN
  ${ctx.ref(moduleConfig.targetDatasetId, "cost_center_group_hierarchy")} AS CCNodeText
  ON h.mandt = CCNodeText.client_mandt
  AND h.setclass = CCNodeText.set_class_setclass
  AND h.subclass = CCNodeText.subclass_subclass
  AND h.hierbase = CCNodeText.hierarchy_base_hierbase
  AND h.node = CCNodeText.successor_node_succ
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "cskt")} AS CCText
  ON h.mandt = CCText.mandt
  AND h.subclass = CCText.kokrs
  AND h.node = CCText.kostl
  AND CCText.spras = language_key.language_key_spras
  AND CCText.datbi = '9999-12-31'
`
);
