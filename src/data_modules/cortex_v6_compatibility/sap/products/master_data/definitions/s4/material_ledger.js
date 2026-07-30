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

const currencyHelper = require("includes/cortex_v6_compatibility_currency.js");

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("material_ledger", { ...publishConfig, name: "MaterialLedger" }).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
)
SELECT
  ckmlhd.MANDT AS Client_MANDT,
  ckmlhd.MATNR AS MaterialNumber_MATNR,
  ckmlhd.BWTAR AS ValuationType_BWTAR,
  ckmlhd.BWKEY AS ValuationArea_BWKEY,
  ckmlcr.PEINH AS PriceUnit_PEINH,
  ckmlcr.POPER AS PostingPeriod,
  ckmlcr.BDATJ AS FiscalYear,
  ckmlcr.VPRSV AS PriceControlIndicator_VPRSV,
  COALESCE(ckmlcr.STPRS * currency_decimal.CURRFIX, ckmlcr.STPRS) AS StandardCost_STPRS,
  COALESCE(ckmlcr.SALK3 * currency_decimal.CURRFIX, ckmlcr.SALK3) AS ValueOfTotalValuatedStock_SALK3,
  COALESCE(ckmlcr.PVPRS * currency_decimal.CURRFIX, ckmlcr.PVPRS) AS MovingAveragePrice,
  t001.WAERS AS CurrencyKey_WAERS
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ckmlhd')} AS ckmlhd
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ckmlcr')} AS ckmlcr
  ON ckmlhd.mandt = ckmlcr.mandt
    AND ckmlhd.kalnr = ckmlcr.kalnr
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001k')} AS t001k
  ON ckmlhd.MANDT = t001k.MANDT
    AND ckmlhd.BWKEY = t001k.BWKEY
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001')} AS t001
  ON t001.MANDT = t001k.MANDT
    AND t001.BUKRS = t001k.BUKRS
LEFT JOIN
  currency_decimal AS currency_decimal
  ON t001.WAERS = currency_decimal.CURRKEY
WHERE ckmlcr.CURTP = '10'
`
);
