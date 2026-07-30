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

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  ["Client_MANDT", "CompanyCode_BUKRS"]
);

publish("companies_md", { ...publishConfig, name: "CompaniesMD" }).query(
  (ctx) => `
SELECT
  t001.MANDT AS Client_MANDT,
  t001.WAERS AS CurrencyCode_WAERS,
  t001.BUKRS AS CompanyCode_BUKRS,
  t001.BUTXT AS CompanyText_BUTXT,
  t001.ORT01 AS CityName_ORT01,
  t001.LAND1 AS Country_LAND1,
  t001.SPRAS AS Language_SPRAS,
  t001.KTOPL AS ChartOfAccounts_KTOPL,
  t001.PERIV AS FiscalyearVariant_PERIV,
  t001.RCOMP AS Company_RCOMP,
  t001.KKBER AS CreditControlArea_KKBER,
  t001.KTOP2 AS CountryChartofAccounts_KTOP2,
  t001.FIKRS AS FundsManagement_FIKRS



































































FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001')} AS t001
`
);
