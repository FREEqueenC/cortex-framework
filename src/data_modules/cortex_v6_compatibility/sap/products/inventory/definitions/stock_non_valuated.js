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
const publish_config = require("includes/publish_config.js");
const master_data = require("includes/master_data.js");

const languages = moduleConfig.moduleSettings?.languages || ['E'];

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("stock_non_valuated", { ...publishConfig, name: "Stock_NonValuated" }).query(
  (ctx) => `
WITH
  MaterialsMD AS (
    ${master_data.getMaterialsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  PlantsMD AS (
    ${master_data.getPlantsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  )

SELECT
  MARD.MANDT AS Client_MANDT,
  MARD.MATNR AS MaterialNumber_MATNR,
  mara.MaterialText_MAKTX,
  MARD.WERKS AS Plant_WERKS,
  t001w.Name_NAME1 AS Plant_Name,
  MARD.LGORT AS StorageLocation_LGORT,
  mara.BaseUnitOfMeasure_MEINS,
  mara.Language_SPRAS,
  mara.MaterialType_MTART,
  mara.MaterialGroup_MATKL,
  mara.ProductHierarchy_PRDHA,
  t001w.Region_County__REGIO AS Plant_Region,
  t001w.CountryKey_LAND1 AS Plant_Country,
  SUM(MARD.LABST) AS ValuatedUnrestrictedUseStock
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mard')} AS MARD
INNER JOIN MaterialsMD AS mara
  ON mara.Client_MANDT = MARD.MANDT
    AND mara.MaterialNumber_MATNR = MARD.MATNR
INNER JOIN PlantsMD AS t001w
  ON t001w.Client_MANDT = MARD.MANDT
    AND t001w.Plant_WERKS = MARD.WERKS
    AND t001w.Language_SPRAS = mara.Language_SPRAS
WHERE mara.Language_SPRAS IN UNNEST(${JSON.stringify(languages)})
GROUP BY
  MARD.MANDT, MARD.MATNR, mara.MaterialText_MAKTX, MARD.WERKS,
  t001w.Name_NAME1, MARD.LGORT, mara.BaseUnitOfMeasure_MEINS,
  mara.Language_SPRAS, mara.MaterialType_MTART,
  mara.MaterialGroup_MATKL, mara.ProductHierarchy_PRDHA,
  t001w.Region_County__REGIO, t001w.CountryKey_LAND1
`
);
