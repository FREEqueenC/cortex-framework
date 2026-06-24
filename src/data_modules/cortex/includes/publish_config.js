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

/**
 * Generates a publish configuration object for Dataform.
 * @param {string} materializationType The materialization type (view, table, incremental).
 * @param {!Object} tableConfig The table configuration object.
 * @param {!Object} moduleConfig The module configuration object.
 * @param {?Array<string>} uniqueKeys The unique keys for incremental materialization.
 * @returns {!Object} The publish configuration object.
 */
function getPublishConfig(materializationType, tableConfig, moduleConfig, uniqueKeys = []) {
  const config = {
    type: materializationType,
    description: tableConfig.description,
    database: moduleConfig.targetProjectId,
    schema: moduleConfig.targetDatasetId,
    columns: tableConfig.columns,
    tags: tableConfig.tags
  };

  if (materializationType === "incremental") {
    config.onSchemaChange = "EXTEND";
    if (uniqueKeys && uniqueKeys.length > 0) {
      config.uniqueKey = uniqueKeys;

      const tableName = tableConfig.tableName;
      const database = moduleConfig.targetProjectId;
      const schema = moduleConfig.targetDatasetId;
      const assertionFunc = typeof assertion !== "undefined" ? assertion : global.assertion;

      if (tableName && assertionFunc) {
        // 1. Unique Key Assertion
        assertionFunc(`${tableName}_assertions_uniqueKey`, {
          database: database,
          schema: schema,
          tags: tableConfig.tags
        }).query(ctx => `
          SELECT
            ${uniqueKeys.map(k => `\`${k}\``).join(", ")},
            COUNT(1) as row_count
          FROM
            ${ctx.ref(tableName)}
          GROUP BY
            ${uniqueKeys.map(k => `\`${k}\``).join(", ")}
          HAVING
            row_count > 1
        `);

        // 2. Non-Null Key Assertion
        assertionFunc(`${tableName}_assertions_nonNull`, {
          database: database,
          schema: schema,
          tags: tableConfig.tags
        }).query(ctx => `
          SELECT
            *
          FROM
            ${ctx.ref(tableName)}
          WHERE
            ${uniqueKeys.map(k => `\`${k}\` IS NULL`).join(" OR ")}
        `);
      }
    }
  }

  if ((materializationType === "incremental" || materializationType === "table") && tableConfig.bigquery) {
    config.bigquery = tableConfig.bigquery;
  }

  return config;
}

module.exports = { getPublishConfig };
