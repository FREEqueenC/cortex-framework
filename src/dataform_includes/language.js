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
 * Helper to generate the LanguageKey CTE query.
 * @param {string} t002TableRef The reference to the t002 table (e.g., ctx.ref('t002')).
 * @param {Array<string>} languages The list of languages.
 * @returns {string} The SQL query string for LanguageKey CTE.
 */
function getLanguageKeys(t002TableRef, languages) {
  const sql_helper = require("includes/sql_helper.js");
  return `
    SELECT
      spras AS language_key_spras
    FROM
      ${t002TableRef}
    WHERE spras IN (${sql_helper.formatFilterArray(languages)})
  `;
}

module.exports = {
  getLanguageKeys
};
