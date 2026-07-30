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

publish("sales_organizations_md", { ...publishConfig, name: "SalesOrganizationsMD" }).query(
  (ctx) => `
SELECT
  TVKO.MANDT AS Client_MANDT,
  TVKO.VKORG AS SalesOrg_VKORG,
  TVKO.WAERS AS SalesOrgCurrency_WAERS,
  TVKO.KUNNR AS SalesOrgCustomer_KUNNR,
  TVKO.BUKRS AS CompanyCode_BUKRS,
  T001.LAND1 AS Country_LAND1,
  T001.WAERS AS CoCoCurrency_WAERS,
  T001.PERIV AS FiscalYrVariant_PERIV,
  T001.BUTXT AS Company_BUTXT,
  TVKOT.VTEXT AS SalesOrgName_VTEXT,
  TVKOT.SPRAS AS Language_SPRAS
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvko')} AS TVKO
LEFT OUTER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001')} AS T001
  ON
    TVKO.MANDT = T001.MANDT
    AND TVKO.BUKRS = T001.BUKRS
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tvkot')} AS TVKOT
  ON
    TVKO.MANDT = TVKOT.MANDT
    AND TVKO.VKORG = TVKOT.VKORG
`
);
