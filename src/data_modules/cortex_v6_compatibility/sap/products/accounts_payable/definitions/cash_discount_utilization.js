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
const finance = require("includes/finance.js");

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("cash_discount_utilization", { ...publishConfig, name: "CashDiscountUtilization" }).query(
  (ctx) => `
WITH
  AccountingDocuments AS (
    ${finance.getAccountingDocuments(ctx, moduleConfig.sources.sapModule.datasetId, moduleConfig.sources.sapMasterData.datasetId)}
  ),
  VendorsMD AS (
    ${master_data.getVendorsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  AccountingDocumentsKPI AS (
    SELECT
      AccountsPayable.Client_MANDT,
      AccountsPayable.CompanyCode_BUKRS,
      AccountsPayable.CompanyText_BUTXT,
      AccountingDocumentsCDU.AccountNumberOfVendorOrCreditor_LIFNR,
      AccountsPayable.NAME1,
      AccountingDocumentsCDU.AccountingDocumentNumber_BELNR,
      AccountingDocumentsCDU.AmountInLocalCurrency_DMBTR,
      AccountingDocumentsCDU.ClearingDate_AUGDT,
      AccountingDocumentsCDU.DocumentNumberOfTheClearingDocument_AUGBL,
      AccountsPayable.CashDiscountReceivedInSourceCurrency,
      AccountsPayable.CashDiscountReceivedInTargetCurrency,
      AccountsPayable.TargetCurrency_TCURR,
      AccountingDocumentsCDU.CurrencyKey_WAERS,
      AccountingDocumentsCDU.PostingDateInTheDocument_BUDAT,

      IF(
        AccountingDocumentsCDU.PostingKey_BSCHL = '31'
        AND
        AccountingDocumentsCDU.ClearingDate_AUGDT < DATE_ADD(
          AccountingDocumentsCDU.BaselineDateForDueDateCalculation_ZFBDT,
          INTERVAL CAST(AccountingDocumentsCDU.CashDiscountDays1_ZBD1T AS INT64) DAY
        ),
        (
          AccountingDocumentsCDU.AmountEligibleForCashDiscountInDocumentCurrency_SKFBT * AccountingDocumentsCDU.CashDiscountPercentage1_ZBD1P
        ) / 100, 0
      ) AS TargetCashDiscountInSourceCurrency,

      IF(
        AccountingDocumentsCDU.PostingKey_BSCHL = '31'
        AND
        AccountingDocumentsCDU.ClearingDate_AUGDT < DATE_ADD(
          AccountingDocumentsCDU.BaselineDateForDueDateCalculation_ZFBDT,
          INTERVAL CAST(AccountingDocumentsCDU.CashDiscountDays1_ZBD1T AS INT64) DAY
        ),
        (
          AccountingDocumentsCDU.AmountEligibleForCashDiscountInDocumentCurrency_SKFBT * AccountsPayable.ExchangeRate_UKURS * AccountingDocumentsCDU.CashDiscountPercentage1_ZBD1P
        ) / 100, 0
      ) AS TargetCashDiscountInTargetCurrency

    FROM ${ctx.ref('AccountsPayable')} AS AccountsPayable
    INNER JOIN AccountingDocuments AS AccountingDocumentsCDU
      ON
        AccountsPayable.Client_MANDT = AccountingDocumentsCDU.Client_MANDT
        AND AccountsPayable.CompanyCode_BUKRS = AccountingDocumentsCDU.CompanyCode_BUKRS
        AND AccountsPayable.AccountingDocumentNumber_BELNR = AccountingDocumentsCDU.DocumentNumberOfTheClearingDocument_AUGBL
        AND AccountingDocumentsCDU.AccountType_KOART = 'K'
        AND AccountingDocumentsCDU.PostingKey_BSCHL = '31'
  ),
  Vendors AS (
    SELECT Client_MANDT, AccountNumberOfVendorOrCreditor_LIFNR, NAME1
    FROM VendorsMD
    WHERE
      ValidToDate_DATE_TO = '9999-12-31'
      AND COALESCE(VersionIdForInternationalAddresses_NATION, '') = ''
  )

SELECT
  AccountingDocumentsKPI.Client_MANDT,
  AccountingDocumentsKPI.CompanyCode_BUKRS,
  AccountingDocumentsKPI.CompanyText_BUTXT,
  AccountingDocumentsKPI.AccountNumberOfVendorOrCreditor_LIFNR,
  Vendors.NAME1,
  AccountingDocumentsKPI.AccountingDocumentNumber_BELNR,
  AccountingDocumentsKPI.TargetCurrency_TCURR,
  ANY_VALUE(AccountingDocumentsKPI.CurrencyKey_WAERS) AS CurrencyKey_WAERS,
  ANY_VALUE(AccountingDocumentsKPI.AmountInLocalCurrency_DMBTR) AS AmountInLocalCurrency_DMBTR,
  ANY_VALUE(AccountingDocumentsKPI.ClearingDate_AUGDT) AS ClearingDate_AUGDT,
  ANY_VALUE(AccountingDocumentsKPI.DocumentNumberOfTheClearingDocument_AUGBL) AS DocumentNumberOfTheClearingDocument_AUGBL,
  ANY_VALUE(AccountingDocumentsKPI.PostingDateInTheDocument_BUDAT) AS PostingDateInTheDocument_BUDAT,
  SUM(AccountingDocumentsKPI.CashDiscountReceivedInSourceCurrency) AS CashDiscountReceivedInSourceCurrency,
  SUM(AccountingDocumentsKPI.CashDiscountReceivedInTargetCurrency) AS CashDiscountReceivedInTargetCurrency,
  AVG(AccountingDocumentsKPI.TargetCashDiscountInSourceCurrency) AS TargetCashDiscountInSourceCurrency,
  AVG(AccountingDocumentsKPI.TargetCashDiscountInTargetCurrency) AS TargetCashDiscountInTargetCurrency
FROM AccountingDocumentsKPI
LEFT OUTER JOIN Vendors
  ON
    AccountingDocumentsKPI.Client_MANDT = Vendors.Client_MANDT
    AND AccountingDocumentsKPI.AccountNumberOfVendorOrCreditor_LIFNR = Vendors.AccountNumberOfVendorOrCreditor_LIFNR
WHERE
  AccountingDocumentsKPI.TargetCashDiscountInSourceCurrency != 0
  AND AccountingDocumentsKPI.CashDiscountReceivedInSourceCurrency != 0
  AND AccountingDocumentsKPI.TargetCashDiscountInTargetCurrency != 0
  AND AccountingDocumentsKPI.CashDiscountReceivedInTargetCurrency != 0
GROUP BY
  AccountingDocumentsKPI.Client_MANDT,
  AccountingDocumentsKPI.CompanyCode_BUKRS,
  AccountingDocumentsKPI.CompanyText_BUTXT,
  AccountingDocumentsKPI.AccountNumberOfVendorOrCreditor_LIFNR,
  Vendors.NAME1,
  AccountingDocumentsKPI.AccountingDocumentNumber_BELNR,
  AccountingDocumentsKPI.TargetCurrency_TCURR
`
);
