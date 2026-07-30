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
const materializationType = tableConfig.materializationType || "incremental";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "hierarchy_id_hryid",
    "hierarchy_version_hryver",
    "node_class_nodecls",
    "hierarchy_node_hrynode",
    "parent_node_parnode",
    "valid_to_hryvalto",
    "language_key_spras",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  node.mandt AS client_mandt,
  node.hryid AS hierarchy_id_hryid,
  node.hryver AS hierarchy_version_hryver,
  node.nodecls AS node_class_nodecls,
  node.hrynode AS hierarchy_node_hrynode,
  node.parnode AS parent_node_parnode,
  node.hryvalto AS valid_to_hryvalto,
  text.spras AS language_key_spras,
  node.hryvalfrom AS valid_from_hryvalfrom,
  node.balind AS balance_indicator_balind,
  node.nodetype AS node_type_nodetype,
  node.nodevalue AS node_value_nodevalue,
  node.hryseqnbr AS sequence_number_hryseqnbr,
  node.hrylevel AS hierarchy_level_hrylevel,
  text.nodetxt AS node_text_nodetxt,
  GREATEST(
    IFNULL(node.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(text.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'hrrp_node')} AS node
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'hrrp_nodet')} AS text
  ON node.mandt = text.mandt
  AND node.hryid = text.hryid
  AND node.hryver = text.hryver
  AND node.nodecls = text.nodecls
  AND node.hrynode = text.hrynode
  AND node.parnode = text.parnode
  AND node.hryvalto = text.hryvalto
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["node", "text"])
])}
`
);
