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
 * Shared date utility functions for cortex_v6_compatibility models.
 */

const date = require("includes/date.js");

function getCalendarDateDimCTE(ctx) {
  return `
WITH v7_date_dim AS (
  ${date.getDateDimension()}
)
SELECT
  date AS Date,
  cal_year AS CalYear,
  cal_month AS CalMonth,
  cal_week AS CalWeek,
  cal_quarter AS CalQuarter,
  day_of_month AS DayOfMonth
FROM
  v7_date_dim
`;
}

module.exports = {
  getCalendarDateDimCTE
};
