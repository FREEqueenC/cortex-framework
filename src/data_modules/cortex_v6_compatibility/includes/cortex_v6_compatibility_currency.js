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
 * Shared currency utility functions for cortex_v6_compatibility models.
 */

function getCurrencyDecimalCTE(ctx, datasetId) {
  return `
SELECT
  currkey AS CURRKEY,
  currdec AS CURRDEC,
  CAST(POWER(10, 2 - COALESCE(currdec, 0)) AS NUMERIC) AS CURRFIX
FROM
  ${ctx.ref(datasetId, 'tcurx')}
`;
}

function getCurrencyConversionCTE(ctx, datasetId, moduleConfig) {
  const targetCurrencies = moduleConfig?.moduleSettings?.targetCurrencies || ['USD'];
  const rateType = moduleConfig?.moduleSettings?.rateType || 'M';
  return `
SELECT
  mandt AS Client_MANDT,
  mandt AS MANDT,
  kurst AS ExchangeRateType_KURST,
  kurst AS KURST,
  fcurr AS FromCurrency_FCURR,
  fcurr AS FCURR,
  tcurr AS ToCurrency_TCURR,
  tcurr AS TCURR,
  IF(ukurs < 0, SAFE_DIVIDE(1, ABS(ukurs)), ukurs) AS ExchangeRate_UKURS,
  IF(ukurs < 0, SAFE_DIVIDE(1, ABS(ukurs)), ukurs) AS UKURS,
  PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(gdatu AS INT64) AS STRING)) AS ConvDate,
  PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(gdatu AS INT64) AS STRING)) AS conv_date
FROM
  ${ctx.ref(datasetId, 'tcurr')}
WHERE
  tcurr IN UNNEST(${JSON.stringify(targetCurrencies)})
  AND kurst = '${rateType}'
`;
}

module.exports = {
  getCurrencyDecimalCTE,
  getCurrencyConversionCTE
};

