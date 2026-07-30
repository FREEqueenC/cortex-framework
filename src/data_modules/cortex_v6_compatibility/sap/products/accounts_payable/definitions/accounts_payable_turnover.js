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

publish("accounts_payable_turnover", { ...publishConfig, name: "AccountsPayableTurnover" }).query(
  (ctx) => `
WITH AccountsPayable AS (
  SELECT
    AccountsPayable.Client_MANDT,
    AccountsPayable.CompanyCode_BUKRS,
    AccountsPayable.CompanyText_BUTXT,
    AccountsPayable.AccountNumberOfVendorOrCreditor_LIFNR,
    AccountsPayable.NAME1,
    AccountsPayable.AccountingDocumentNumber_BELNR,
    AccountsPayable.NumberOfLineItemWithinAccountingDocument_BUZEI,
    AccountsPayable.PostingDateInTheDocument_BUDAT,
    AccountsPayable.AccountingDocumenttype_BLART,
    AccountsPayable.AmountInLocalCurrency_DMBTR,
    AccountsPayable.AmountInTargetCurrency_DMBTR,
    AccountsPayable.CurrencyKey_WAERS,
    AccountsPayable.TargetCurrency_TCURR,
    AccountsPayable.DocFiscPeriod,

    SUM(
      IF(
        AccountsPayable.AccountType_KOART = 'M' AND AccountsPayable.MovementType__inventoryManagement___BWART IN ('101', '501'),
        AccountsPayable.POOrderHistory_AmountInLocalCurrency_DMBTR,
        IF(
          AccountsPayable.AccountType_KOART = 'M' AND AccountsPayable.MovementType__inventoryManagement___BWART IN ('102', '502'),
          AccountsPayable.POOrderHistory_AmountInLocalCurrency_DMBTR * -1, 0
        )
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR, AccountsPayable.DocFiscPeriod
    ) AS TotalPurchasesInSourceCurrency,

    SUM(
      IF(
        AccountsPayable.AccountType_KOART = 'M' AND AccountsPayable.MovementType__inventoryManagement___BWART IN ('101', '501'),
        AccountsPayable.POOrderHistory_AmountInTargetCurrency_DMBTR,
        IF(
          AccountsPayable.AccountType_KOART = 'M' AND AccountsPayable.MovementType__inventoryManagement___BWART IN ('102', '502'),
          AccountsPayable.POOrderHistory_AmountInTargetCurrency_DMBTR * -1, 0
        )
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR, AccountsPayable.DocFiscPeriod
    ) AS TotalPurchasesInTargetCurrency,

    SUM(
      IF(
        AccountsPayable.Accounttype_KOART = 'K'
        AND AccountsPayable.InvoiceDocumenttype_BLART = 'RE'
        AND AccountsPayable.ClearingDate_AUGDT IS NULL,
        AccountsPayable.AmountInLocalCurrency_DMBTR,
        0
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR, AccountsPayable.DocFiscPeriod
    ) AS PeriodAPInSourceCurrency,

    SUM(
      IF(
        AccountsPayable.Accounttype_KOART = 'K'
        AND AccountsPayable.InvoiceDocumenttype_BLART = 'RE'
        AND AccountsPayable.ClearingDate_AUGDT IS NULL,
        AccountsPayable.AmountInTargetCurrency_DMBTR,
        0
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR, AccountsPayable.DocFiscPeriod
    ) AS PeriodAPInTargetCurrency,

    SUM(
      IF(
        AccountsPayable.Accounttype_KOART = 'K'
        AND AccountsPayable.InvoiceDocumenttype_BLART = 'RE'
        AND AccountsPayable.ClearingDate_AUGDT IS NULL,
        AccountsPayable.AmountInLocalCurrency_DMBTR,
        0
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR
      ORDER BY AccountsPayable.DocFiscPeriod
    ) AS ClosingAPInSourceCurrency,

    SUM(
      IF(
        AccountsPayable.Accounttype_KOART = 'K'
        AND AccountsPayable.InvoiceDocumenttype_BLART = 'RE'
        AND AccountsPayable.ClearingDate_AUGDT IS NULL,
        AccountsPayable.AmountInTargetCurrency_DMBTR,
        0
      )
    ) OVER (
      PARTITION BY AccountsPayable.Client_MANDT, AccountsPayable.CompanyCode_BUKRS, AccountsPayable.TargetCurrency_TCURR
      ORDER BY AccountsPayable.DocFiscPeriod
    ) AS ClosingAPInTargetCurrency

  FROM
    ${ctx.ref('AccountsPayable')} AS AccountsPayable
  WHERE
    AccountsPayable.DocFiscPeriod <= AccountsPayable.KeyFiscPeriod
)

SELECT
  AccountsPayable.*,
  (AccountsPayable.ClosingAPInSourceCurrency - COALESCE(AccountsPayable.PeriodAPInSourceCurrency, 0)) AS OpeningAPInSourceCurrency,

  /* AccountsPayableTurnover */
  SAFE_DIVIDE(
    AccountsPayable.TotalPurchasesInSourceCurrency,
    ((AccountsPayable.ClosingAPInSourceCurrency * 2 - COALESCE(AccountsPayable.PeriodAPInSourceCurrency, 0)) / 2)
  ) AS AccountsPayableTurnoverInSourceCurrency,

  SAFE_DIVIDE(
    AccountsPayable.TotalPurchasesInTargetCurrency,
    ((AccountsPayable.ClosingAPInTargetCurrency * 2 - COALESCE(AccountsPayable.PeriodAPInTargetCurrency, 0)) / 2)
  ) AS AccountsPayableTurnoverInTargetCurrency
FROM AccountsPayable
`
);
