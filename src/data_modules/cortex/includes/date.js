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
 * Returns a SQL query string that generates a date dimension table.
 * The table includes various date-related columns derived from a range of dates.
 * @param {number=} startYearsPast The number of years before the current year to start the date range. Defaults to 20.
 * @param {number=} endYearsFuture The number of years after the current year to end the date range. Defaults to 20.
 * @return {string} A SQL query string.
 */
function getDateDimension(startYearsPast = 20, endYearsFuture = 20) {
  return `
SELECT
  dt as date,
  CAST(FORMAT_DATE('%Y%m%d', dt) AS INT64) as date_int,
  FORMAT_DATE('%Y%m%d', dt) as date_str,
  FORMAT_DATE('%Y-%m-%d', dt) as date_str2,
  EXTRACT(YEAR FROM dt) as cal_year,
  IF(EXTRACT(QUARTER FROM dt) IN (1, 2), 1, 2) as cal_semester,
  EXTRACT(QUARTER FROM dt) as cal_quarter,
  EXTRACT(MONTH FROM dt) as cal_month,
  EXTRACT(WEEK FROM dt) as cal_week,
  CAST(EXTRACT(YEAR FROM dt) AS STRING) as cal_year_str,
  IF(EXTRACT(QUARTER FROM dt) IN (1, 2), '01', '02') as cal_semester_str,
  IF(EXTRACT(QUARTER FROM dt) IN (1, 2), 'S1', 'S2') as cal_semester_str2,
  '0' || EXTRACT(QUARTER FROM dt) as cal_quarter_str,
  'Q' || EXTRACT(QUARTER FROM dt) as cal_quarter_str2,
  FORMAT_DATE('%B', dt) as cal_month_long_str,
  FORMAT_DATE('%b', dt) as cal_month_short_str,
  '0' || (EXTRACT(WEEK FROM dt)) as cal_week_str,
  FORMAT_DATE('%A', dt) as day_name_long,
  FORMAT_DATE('%a', dt) as day_name_short,
  EXTRACT(DAYOFWEEK FROM dt) as day_of_week,
  EXTRACT(DAY FROM dt) as day_of_month,
  DATE_DIFF(dt, DATE_TRUNC(dt, QUARTER), DAY) + 1 as day_of_quarter,
  IF(
    EXTRACT(QUARTER FROM dt) IN (1, 2),
    EXTRACT(DAYOFYEAR FROM dt),
    IF(
      EXTRACT(QUARTER FROM dt) = 3,
      EXTRACT(DAYOFYEAR FROM dt) - EXTRACT(DAYOFYEAR FROM (DATE_TRUNC(dt, QUARTER) - 1)),
      EXTRACT(DAYOFYEAR FROM dt) - EXTRACT(DAYOFYEAR FROM (DATE_TRUNC(DATE_SUB(dt, INTERVAL 3 MONTH), QUARTER)))
    )
  ) as day_of_semester,
  EXTRACT(DAYOFYEAR FROM dt) as day_of_year,
  IF(
    EXTRACT(QUARTER FROM dt) IN (1, 2),
    EXTRACT(YEAR FROM dt) || 'S1',
    EXTRACT(YEAR FROM dt) || 'S2'
  ) as year_semester,
  EXTRACT(YEAR FROM dt) || 'Q' || EXTRACT(QUARTER FROM dt) as year_quarter,
  CAST(FORMAT_DATE('%Y%m', dt) AS STRING) as year_month,
  EXTRACT(YEAR FROM dt) || ' ' || FORMAT_DATE('%b', dt) as year_month2,
  FORMAT_DATE('%Y%U', dt) as year_week,
  (DATE_TRUNC(dt, YEAR) = dt) as is_first_day_of_year,
  (LAST_DAY(dt, YEAR) = dt) as is_last_day_of_year,
  (EXTRACT(MONTH FROM dt) IN (1, 7) AND EXTRACT(DAY FROM dt) = 1) as is_first_day_of_semester,
  ((EXTRACT(MONTH FROM dt) IN (6) AND EXTRACT(DAY FROM dt) IN (30))
    OR (EXTRACT(MONTH FROM dt) IN (12) AND EXTRACT(DAY FROM dt) IN (31))) as is_last_day_of_semester,
  (DATE_TRUNC(dt, QUARTER) = dt) as is_first_day_of_quarter,
  (LAST_DAY(dt, QUARTER) = dt) as is_last_day_of_quarter,
  (DATE_TRUNC(dt, MONTH) = dt) as is_first_day_of_month,
  (LAST_DAY(dt, MONTH) = dt) as is_last_day_of_month,
  (DATE_TRUNC(dt, WEEK) = dt) as is_first_day_of_week,
  (LAST_DAY(dt, WEEK) = dt) as is_last_day_of_week,
  ((MOD(EXTRACT(YEAR FROM dt), 4) = 0 AND MOD(EXTRACT(YEAR FROM dt), 100) != 0)
    OR MOD(EXTRACT(YEAR FROM dt), 400) = 0) as is_leap_year,
  (FORMAT_DATE('%A', dt) NOT IN ('Saturday', 'Sunday')) as is_week_day,
  (FORMAT_DATE('%A', dt) IN ('Saturday', 'Sunday')) as is_week_end,
  (DATE_TRUNC(dt, WEEK)) as week_start_date,
  (LAST_DAY(dt, WEEK)) as week_end_date,
  (DATE_TRUNC(dt, MONTH)) as month_start_date,
  (LAST_DAY(dt, MONTH)) as month_end_date,
  (EXTRACT(WEEK FROM LAST_DAY(dt, ISOYEAR)) = 53) as has_53_weeks
FROM UNNEST(GENERATE_DATE_ARRAY(
  DATE_SUB(
    DATE_TRUNC(CURRENT_DATE(), YEAR), INTERVAL ${startYearsPast} YEAR),
  LAST_DAY(DATE_ADD(CURRENT_DATE(), INTERVAL ${endYearsFuture} YEAR)),
  INTERVAL 1 DAY)
) as dt
`;
}

module.exports = {
  getDateDimension
};
