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
 * Generates a WHERE clause for incremental updates based on timestamp columns.
 * @param {!Object} ctx The Dataform context object.
 * @param {string|!Array<string>} timestampColumns The timestamp column(s) to check.
 * @returns {string} The WHERE clause string.
 */
function getWhere(ctx, timestampColumns) {
  const columns = Array.isArray(timestampColumns) ? timestampColumns : [timestampColumns];

  const timestampChecks = columns.map(
    (col) => `IFNULL(${col}, TIMESTAMP('1900-01-01 00:00:00+00'))`
  );

  const greatestTimestamp = timestampChecks.length > 1
    ? `GREATEST(${timestampChecks.join(', ')})`
    : timestampChecks[0];

  return ctx.when(
    ctx.incremental(),
    `WHERE ${greatestTimestamp} >= (
      SELECT TIMESTAMP_SUB(
        IFNULL(MAX(source_last_updated_at), TIMESTAMP('1900-12-25 05:30:00+00')),
        INTERVAL 30 MINUTE
      )
      FROM ${ctx.self()}
    )`,
    ""
  );
}

module.exports = { getWhere };
