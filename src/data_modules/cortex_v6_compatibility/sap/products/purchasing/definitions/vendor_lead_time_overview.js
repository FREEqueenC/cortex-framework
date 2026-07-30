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
  []
);

publish("vendor_lead_time_overview", { ...publishConfig, name: "VendorLeadTimeOverview" }).query(
  (ctx) => `
SELECT DISTINCT
  VendorAccountNumber_LIFNR,
  NAME1 AS VendorName,
  CountryKey_LAND1 AS VendorCountry,
  Company_BUKRS,
  CompanyText_BUTXT AS Company,
  PurchasingGroup_EKGRP,
  PurchasingGroupText_EKNAM AS PurchasingGroup,
  PurchasingOrganization_EKORG,
  PurchasingOrganizationText_EKOTX AS PurchasingOrganization,
  PurchasingDocumentDate_BEDAT,
  YearOfPurchasingDocumentDate_BEDAT,
  MonthOfPurchasingDocumentDate_BEDAT,
  WeekOfPurchasingDocumentDate_BEDAT,
  TargetCurrency_TCURR,
  LanguageKey_SPRAS,
  ROUND(
    AVG(VendorCycleTimeInDays) OVER (PARTITION BY VendorAccountNumber_LIFNR),
    1) AS AverageLeadTimeInDays
FROM
  ${ctx.ref('VendorPerformance')}
WHERE
  Client_MANDT = '${moduleConfig.sources.sapModule.mandt}'
`
);
