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
const date = require("includes/date.js");

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("accounting_documents_receivable", { ...publishConfig, name: "AccountingDocumentsReceivable" }).query(
  (ctx) => `
WITH
  Customers_Inline AS (
    SELECT
      mandt AS Client_MANDT,
      kunnr AS CustomerNumber_KUNNR,
      name1 AS NAME1_NAME1,
      land1 AS CountryKey_LAND1,
      ort01 AS City_ORT01
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'kna1')}
  ),

  Companies_Inline AS (
    SELECT
      mandt AS Client_MANDT,
      bukrs AS CompanyCode_BUKRS,
      butxt AS CompanyText_BUTXT,
      land1 AS Country_LAND1,
      ort01 AS CityName_ORT01,
      periv AS FiscalyearVariant_PERIV
    FROM
      ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't001')}
  )

SELECT
  AccountingDocuments.Client_MANDT,
  AccountingDocuments.ExchangeRateType_KURST,
  AccountingDocuments.CompanyCode_BUKRS,
  CompaniesMD.CompanyText_BUTXT,
  AccountingDocuments.CustomerNumber_KUNNR,
  AccountingDocuments.FiscalYear_GJAHR,
  CustomersMD.NAME1_NAME1,
  CompaniesMD.Country_LAND1 AS Company_Country,
  CompaniesMD.CityName_ORT01 AS Company_City,
  CustomersMD.CountryKey_LAND1,
  CustomersMD.City_ORT01,
  AccountingDocuments.AccountingDocumentNumber_BELNR,
  AccountingDocuments.NumberOfLineItemWithinAccountingDocument_BUZEI,
  AccountingDocuments.CurrencyKey_WAERS,
  AccountingDocuments.LocalCurrency_HWAER,
  CompaniesMD.FiscalyearVariant_PERIV AS Company_FiscalyearVariant,
  CompaniesMD.FiscalyearVariant_PERIV AS FiscalyearVariant_PERIV,
  FiscalDateDimension_BUDAT.FiscalYearPeriod AS Period,
  FiscalDateDimension_CURRENTDATE.FiscalYearPeriod AS Current_Period,
  AccountingDocuments.AccountType_KOART,
  AccountingDocuments.PostingDateInTheDocument_BUDAT,
  AccountingDocuments.DocumentDateInDocument_BLDAT,
  AccountingDocuments.InvoiceToWhichTheTransactionBelongs_REBZG,
  AccountingDocuments.BillingDocument_VBELN,
  AccountingDocuments.WrittenOffAmount_DMBTR,
  AccountingDocuments.BadDebt_DMBTR,
  AccountingDocuments.NetDueDateCalc AS NetDueDate,
  AccountingDocuments.sk1dtCalc AS CashDiscountDate1,
  AccountingDocuments.sk2dtCalc AS CashDiscountDate2,
  AccountingDocuments.OpenAndNotDue,
  AccountingDocuments.ClearedAfterDueDate,
  AccountingDocuments.ClearedOnOrBeforeDueDate,
  AccountingDocuments.OpenAndOverDue,
  AccountingDocuments.DoubtfulReceivables,
  AccountingDocuments.DaysInArrear,
  AccountingDocuments.AccountsReceivable,
  AccountingDocuments.Sales
FROM
  ${ctx.ref('AccountingDocuments')} AS AccountingDocuments
LEFT JOIN
  Customers_Inline AS CustomersMD
  ON
    AccountingDocuments.Client_MANDT = CustomersMD.Client_MANDT
    AND AccountingDocuments.CustomerNumber_KUNNR = CustomersMD.CustomerNumber_KUNNR
LEFT JOIN
  Companies_Inline AS CompaniesMD
  ON
    AccountingDocuments.Client_MANDT = CompaniesMD.Client_MANDT
    AND AccountingDocuments.CompanyCode_BUKRS = CompaniesMD.CompanyCode_BUKRS
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_BUDAT
  ON AccountingDocuments.Client_MANDT = FiscalDateDimension_BUDAT.mandt
    AND CompaniesMD.FiscalyearVariant_PERIV = FiscalDateDimension_BUDAT.periv
    AND AccountingDocuments.PostingDateInTheDocument_BUDAT = FiscalDateDimension_BUDAT.Date
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_CURRENTDATE
  ON AccountingDocuments.Client_MANDT = FiscalDateDimension_CURRENTDATE.mandt
    AND CompaniesMD.FiscalyearVariant_PERIV = FiscalDateDimension_CURRENTDATE.periv
    AND CURRENT_DATE() = FiscalDateDimension_CURRENTDATE.Date
WHERE
  AccountingDocuments.AccountType_KOART = 'D'
`
);
