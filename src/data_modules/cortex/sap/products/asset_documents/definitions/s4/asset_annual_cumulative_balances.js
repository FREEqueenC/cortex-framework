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
    "company_code_bukrs",
    "asset_number_anln1",
    "asset_subnumber_anln2",
    "depreciation_area_afabe",
    "fiscal_year_gjahr"
  ]
);

const filters = tableConfig.filters || {};
const apcSlalittypes = filters.acquisition_and_production_costs || ['07000', '07040'];
const ordDepSlalittypes = filters.ordinary_depreciation || ['07005', '07025', '07045', '07205'];
const specDepSlalittypes = filters.special_depreciation || ['07006', '07026', '07046', '07206'];
const unplDepSlalittypes = filters.unplanned_depreciation || ['07007', '07027', '07047', '07207'];

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH
${ctx.when(ctx.incremental(), `
updated_assets AS (
  SELECT DISTINCT
    mandt, bukrs, anln1, anln2, afabe
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "faat_ydda")}
  WHERE
    recordstamp >= (SELECT TIMESTAMP_SUB(IFNULL(MAX(source_last_updated_at), TIMESTAMP("1900-12-25 05:30:00+00")), INTERVAL 30 MINUTE) FROM ${ctx.self()})
  UNION DISTINCT
  SELECT DISTINCT
    rclnt AS mandt, rbukrs AS bukrs, anln1, anln2, afabe
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "acdoca")}
  WHERE
    recordstamp >= (SELECT TIMESTAMP_SUB(IFNULL(MAX(source_last_updated_at), TIMESTAMP("1900-12-25 05:30:00+00")), INTERVAL 30 MINUTE) FROM ${ctx.self()})
),
`)}
annual_movements AS (
  SELECT
    acdoca.rclnt AS client_mandt,
    acdoca.rbukrs AS company_code_bukrs,
    acdoca.anln1 AS asset_number_anln1,
    acdoca.anln2 AS asset_subnumber_anln2,
    acdoca.afabe AS depreciation_area_afabe,
    acdoca.gjahr AS fiscal_year_gjahr,
    SUM(CASE WHEN acdoca.slalittype IN (${sql_helper.formatFilterArray(apcSlalittypes)}) THEN acdoca.hsl ELSE 0 END) AS annual_apc,
    SUM(CASE WHEN acdoca.slalittype IN (${sql_helper.formatFilterArray(ordDepSlalittypes)}) THEN acdoca.hsl ELSE 0 END) AS annual_ord_dep,
    SUM(CASE WHEN acdoca.slalittype IN (${sql_helper.formatFilterArray(specDepSlalittypes)}) THEN acdoca.hsl ELSE 0 END) AS annual_spec_dep,
    SUM(CASE WHEN acdoca.slalittype IN (${sql_helper.formatFilterArray(unplDepSlalittypes)}) THEN acdoca.hsl ELSE 0 END) AS annual_unpl_dep,
    MAX(acdoca.recordstamp) AS max_recordstamp
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "acdoca")} AS acdoca
  ${ctx.when(ctx.incremental(), `
  INNER JOIN updated_assets AS ua
    ON acdoca.rclnt = ua.mandt
    AND acdoca.rbukrs = ua.bukrs
    AND acdoca.anln1 = ua.anln1
    AND acdoca.anln2 = ua.anln2
    AND acdoca.afabe = ua.afabe
  `)}
  WHERE
    acdoca.anln1 IS NOT NULL
  GROUP BY
    acdoca.rclnt, acdoca.rbukrs, acdoca.anln1, acdoca.anln2, acdoca.afabe, acdoca.gjahr
),

joined_years AS (
  SELECT
    ydda.mandt AS client_mandt,
    ydda.bukrs AS company_code_bukrs,
    ydda.anln1 AS asset_number_anln1,
    ydda.anln2 AS asset_subnumber_anln2,
    ydda.afabe AS depreciation_area_afabe,
    ydda.gjahr AS fiscal_year_gjahr,
    ydda.ndabj AS expired_useful_life_ndabj,
    ydda.ndabp AS expired_ul_periods_ndabp,
    COALESCE(mov.annual_apc, 0) AS annual_apc,
    COALESCE(mov.annual_ord_dep, 0) AS annual_ord_dep,
    COALESCE(mov.annual_spec_dep, 0) AS annual_spec_dep,
    COALESCE(mov.annual_unpl_dep, 0) AS annual_unpl_dep,
    GREATEST(
      IFNULL(ydda.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
      IFNULL(mov.max_recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
    ) AS source_last_updated_at
  FROM
    ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "faat_ydda")} AS ydda
  ${ctx.when(ctx.incremental(), `
  INNER JOIN updated_assets AS ua
    ON ydda.mandt = ua.mandt
    AND ydda.bukrs = ua.bukrs
    AND ydda.anln1 = ua.anln1
    AND ydda.anln2 = ua.anln2
    AND ydda.afabe = ua.afabe
  `)}
  LEFT JOIN
    annual_movements AS mov
    ON ydda.mandt = mov.client_mandt
    AND ydda.bukrs = mov.company_code_bukrs
    AND ydda.anln1 = mov.asset_number_anln1
    AND ydda.anln2 = mov.asset_subnumber_anln2
    AND ydda.gjahr = mov.fiscal_year_gjahr
    AND ydda.afabe = mov.depreciation_area_afabe
)

SELECT
  client_mandt,
  company_code_bukrs,
  asset_number_anln1,
  asset_subnumber_anln2,
  depreciation_area_afabe,
  fiscal_year_gjahr,
  expired_useful_life_ndabj,
  expired_ul_periods_ndabp,
  SUM(annual_apc) OVER(
    PARTITION BY client_mandt, company_code_bukrs, asset_number_anln1, asset_subnumber_anln2, depreciation_area_afabe
    ORDER BY fiscal_year_gjahr
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_acq_production_costs_kansw,
  SUM(annual_ord_dep) OVER(
    PARTITION BY client_mandt, company_code_bukrs, asset_number_anln1, asset_subnumber_anln2, depreciation_area_afabe
    ORDER BY fiscal_year_gjahr
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_ordinary_depreciation_knafa,
  SUM(annual_spec_dep) OVER(
    PARTITION BY client_mandt, company_code_bukrs, asset_number_anln1, asset_subnumber_anln2, depreciation_area_afabe
    ORDER BY fiscal_year_gjahr
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_special_depreciation_ksafa,
  SUM(annual_unpl_dep) OVER(
    PARTITION BY client_mandt, company_code_bukrs, asset_number_anln1, asset_subnumber_anln2, depreciation_area_afabe
    ORDER BY fiscal_year_gjahr
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_unplanned_depreciation_kaafa,
  source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  joined_years
`
);
