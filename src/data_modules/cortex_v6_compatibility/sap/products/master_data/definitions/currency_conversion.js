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

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

publish("currency_conversion", { ...publishConfig, name: "CurrencyConversion" }).query(
  (ctx) => `
SELECT
  mandt AS Client_MANDT,
  kurst AS ExchangeRateType_KURST,
  fcurr AS FromCurrency_FCURR,
  tcurr AS ToCurrency_TCURR,
  IF(ukurs < 0, SAFE_DIVIDE(1, ABS(ukurs)), ukurs) AS ExchangeRate_UKURS,
  PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(gdatu AS INT64) AS STRING)) AS ConvDate,
  PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(gdatu AS INT64) AS STRING)) AS StartDate,
  PARSE_DATE("%Y%m%d", CAST(99999999 - CAST(gdatu AS INT64) AS STRING)) AS EndDate
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tcurr')}
`
);
