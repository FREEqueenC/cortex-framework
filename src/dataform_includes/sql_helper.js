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
 * Generates a WHERE clause from an array of conditions.
 * Filters out empty conditions and joins them with AND.
 * @param {!Array<string>} conditions The array of SQL conditions.
 * @returns {string} The WHERE clause string or empty string.
 */
function buildDynamicWhere(conditions) {
  const validConditions = conditions.filter(c => c && c.trim() !== "");

  if (validConditions.length === 0) {
    return "";
  }

  return `WHERE ${validConditions.join(" AND ")}`;
}

/**
 * Formats an array of values for use in an SQL IN clause.
 * @param {!Array<string|number>} arr The array of values to format.
 * @returns {string} The formatted string for the IN clause (e.g., "'A', 'B', 'C'").
 */
function formatFilterArray(arr) {
  return arr.map(val => `'${val}'`).join(', ');
}

/**
 * Parses a 14-digit decimal/integer validity start ('from') timestamp (YYYYMMDDHHMMSS) from SAP
 * into a BigQuery TIMESTAMP, handling standard SAP fallback values.
 * @param {string} fieldName The name of the field/column to parse.
 * @returns {string} The SQL CASE statement string.
 */
function parseValidityFromTimestamp(fieldName) {
  return `CASE
    WHEN SAFE_CAST(${fieldName} AS INT64) = 0 OR ${fieldName} IS NULL THEN TIMESTAMP('1900-01-01 00:00:00+00')
    ELSE SAFE.PARSE_TIMESTAMP('%Y%m%d%H%M%S', CAST(SAFE_CAST(${fieldName} AS INT64) AS STRING))
  END`;
}

/**
 * Parses a 14-digit decimal/integer validity end ('to') timestamp (YYYYMMDDHHMMSS) from SAP
 * into a BigQuery TIMESTAMP, handling standard SAP fallback values.
 * @param {string} fieldName The name of the field/column to parse.
 * @returns {string} The SQL CASE statement string.
 */
function parseValidityToTimestamp(fieldName) {
  return `CASE
    WHEN SAFE_CAST(${fieldName} AS INT64) = 0 OR ${fieldName} IS NULL THEN TIMESTAMP('9999-12-31 23:59:59+00')
    WHEN SAFE_CAST(${fieldName} AS INT64) = 99991231235959 THEN TIMESTAMP('9999-12-31 23:59:59+00')
    ELSE SAFE.PARSE_TIMESTAMP('%Y%m%d%H%M%S', CAST(SAFE_CAST(${fieldName} AS INT64) AS STRING))
  END`;
}

module.exports = {
  buildDynamicWhere,
  formatFilterArray,
  parseValidityFromTimestamp,
  parseValidityToTimestamp
};

