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
const targetCurrencies = moduleConfig.moduleSettings?.targetCurrencies || ['USD'];
const rateType = moduleConfig.moduleSettings?.rateType || 'M';
const paymentDocTypes = moduleConfig.moduleSettings?.paymentDocTypes || ['KZ', 'ZP'];
const cashDiscountTransactionKey = moduleConfig.moduleSettings?.cashDiscountTransactionKey || 'SKE';

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("accounts_payable", { ...publishConfig, name: "AccountsPayable" }).query(
  (ctx) => `
WITH
  CurrencyConversion AS (
    SELECT
      Client_MANDT, FromCurrency_FCURR, ToCurrency_TCURR, ConvDate, ExchangeRate_UKURS
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CurrencyConversion')}
    WHERE
      ToCurrency_TCURR IN UNNEST(${JSON.stringify(targetCurrencies)})
      AND ExchangeRateType_KURST = '${rateType}'
  ),

  Vendors AS (
    ${master_data.getVendorsMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  Companies AS (
    ${master_data.getCompaniesMD(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),

  AccountingInvoices AS (
    SELECT
      AccountingDocuments.Client_MANDT,
      AccountingDocuments.CompanyCode_BUKRS,
      AccountingDocuments.AccountingDocumentNumber_BELNR,
      AccountingDocuments.FiscalYear_GJAHR,
      AccountingDocuments.Documenttype_BLART AS AccountingDocumenttype_BLART,
      InvoiceDocuments.Documenttype_BLART AS InvoiceDocumenttype_BLART,
      AccountingDocuments.DocumentDateInDocument_BLDAT,
      AccountingDocuments.PostingDateInTheDocument_BUDAT,
      InvoiceDocuments.PostingDate_BUDAT,
      AccountingDocuments.FiscalPeriod_MONAT,
      AccountingDocuments.PurchasingDocumentNumber_EBELN,
      AccountingDocuments.NumberOfLineItemWithinAccountingDocument_BUZEI,
      AccountingDocuments.ClearingDate_AUGDT,
      COALESCE(AccountingDocuments.NetPaymentAmount_NEBTR, 0) AS NetPaymentAmount_NEBTR,
      COALESCE(AccountingDocuments.AmountInLocalCurrency_DMBTR, 0) AS AmountInLocalCurrency_DMBTR,
      AccountingDocuments.AccountType_KOART,
      AccountingDocuments.TransactionKey_KTOSL,
      AccountingDocuments.PostingKey_BSCHL,
      AccountingDocuments.CashDiscountDays1_ZBD1T,
      AccountingDocuments.BaselineDateForDueDateCalculation_ZFBDT,
      COALESCE(AccountingDocuments.AmountEligibleForCashDiscountInDocumentCurrency_SKFBT, 0) AS AmountEligibleForCashDiscountInDocumentCurrency_SKFBT,
      AccountingDocuments.AccountNumberOfVendorOrCreditor_LIFNR,
      AccountingDocuments.PaymentBlockKey_ZLSPR,
      AccountingDocuments.SpecialGlIndicator_UMSKZ,
      AccountingDocuments.ItemNumberOfPurchasingDocument_EBELP,
      AccountingDocuments.FollowOnDocumentType_REBZT,
      AccountingDocuments.DocumentNumberOfTheClearingDocument_AUGBL,
      AccountingDocuments.TermsOfPaymentKey_ZTERM,
      AccountingDocuments.ReasonCodeForPayments_RSTGR,
      AccountingDocuments.CashDiscountPercentage1_ZBD1P,
      AccountingDocuments.NetPaymentTermsPeriod_ZBD3T,
      AccountingDocuments.CashDiscountDays2_ZBD2T,
      AccountingDocuments.DebitcreditIndicator_SHKZG,
      AccountingDocuments.InvoiceToWhichTheTransactionBelongs_REBZG,
      AccountingDocuments.CurrencyKey_WAERS,
      AccountingDocuments.SupplyingCountry_LANDL,
      AccountingDocuments.ObjectKey_AWKEY,
      NULL AS InvStatus_RBSTAT,
      AccountingDocuments.YearOfPostingDateInTheDocument_BUDAT,
      AccountingDocuments.MonthOfPostingDateInTheDocument_BUDAT,
      AccountingDocuments.WeekOfPostingDateInTheDocument_BUDAT,
      AccountingDocuments.QuarterOfPostingDateInTheDocument_BUDAT,
      AccountingDocuments.LocalCurrency_HWAER
    FROM ${ctx.ref(moduleConfig.sources.sapFinance.datasetId, 'AccountingDocuments')} AS AccountingDocuments
    LEFT OUTER JOIN ${ctx.ref('InvoiceDocuments_Flow')} AS InvoiceDocuments
      ON
        AccountingDocuments.Client_MANDT = InvoiceDocuments.Client_MANDT
        AND AccountingDocuments.CompanyCode_BUKRS = InvoiceDocuments.CompanyCode_BUKRS
        AND LEFT(AccountingDocuments.ObjectKey_AWKEY, 10) = InvoiceDocuments.InvoiceDocNum_BELNR
        AND AccountingDocuments.FiscalYear_GJAHR = InvoiceDocuments.FiscalYear_GJAHR
        AND LTRIM(AccountingDocuments.NumberOfLineItemWithinAccountingDocument_BUZEI, '0') = LTRIM(InvoiceDocuments.InvoiceDocLineNum_BUZEI, '0')
    WHERE
      AccountingDocuments.AccountType_KOART = 'K'
      OR AccountingDocuments.PurchasingDocumentNumber_EBELN IS NOT NULL
      OR AccountingDocuments.Documenttype_BLART IN (${paymentDocTypes.map(x => `'${x}'`).join(', ')})
      OR AccountingDocuments.TransactionKey_KTOSL = '${cashDiscountTransactionKey}'
      OR AccountingDocuments.PostingKey_BSCHL = '31'

    UNION ALL

    SELECT
      InvoiceDocuments.Client_MANDT,
      InvoiceDocuments.CompanyCode_BUKRS,
      InvoiceDocuments.InvoiceDocNum_BELNR AS AccountingDocumentNumber_BELNR,
      InvoiceDocuments.FiscalYear_GJAHR,
      CAST(NULL AS STRING) AS AccountingDocumenttype_BLART,
      CAST(NULL AS STRING) AS InvoiceDocumenttype_BLART,
      InvoiceDocuments.DocumentDate_BLDAT AS DocumentDateInDocument_BLDAT,
      InvoiceDocuments.PostingDate_BUDAT AS PostingDateInTheDocument_BUDAT,
      InvoiceDocuments.PostingDate_BUDAT,
      CAST(NULL AS STRING) AS FiscalPeriod_MONAT,
      CAST(NULL AS STRING) AS PurchasingDocumentNumber_EBELN,
      CAST(NULL AS STRING) AS NumberOfLineItemWithinAccountingDocument_BUZEI,
      CAST(NULL AS DATE) AS ClearingDate_AUGDT,
      NULL AS NetPaymentAmount_NEBTR,
      InvoiceDocuments.GrossInvAmnt_RMWWR AS AmountInLocalCurrency_DMBTR,
      CAST(NULL AS STRING) AS AccountType_KOART,
      CAST(NULL AS STRING) AS TransactionKey_KTOSL,
      CAST(NULL AS STRING) AS PostingKey_BSCHL,
      CAST(NULL AS NUMERIC) AS CashDiscountDays1_ZBD1T,
      CAST(NULL AS DATE) AS BaselineDateForDueDateCalculation_ZFBDT,
      CAST(NULL AS NUMERIC) AS AmountEligibleForCashDiscountInDocumentCurrency_SKFBT,
      InvoiceDocuments.InvoicingParty_LIFNR AS AccountNumberOfVendorOrCreditor_LIFNR,
      CAST(NULL AS STRING) AS PaymentBlockKey_ZLSPR,
      CAST(NULL AS STRING) AS SpecialGlIndicator_UMSKZ,
      CAST(NULL AS STRING) AS ItemNumberOfPurchasingDocument_EBELP,
      CAST(NULL AS STRING) AS FollowOnDocumentType_REBZT,
      CAST(NULL AS STRING) AS DocumentNumberOfTheClearingDocument_AUGBL,
      CAST(NULL AS STRING) AS TermsOfPaymentKey_ZTERM,
      CAST(NULL AS STRING) AS ReasonCodeForPayments_RSTGR,
      CAST(NULL AS NUMERIC) AS CashDiscountPercentage1_ZBD1P,
      CAST(NULL AS NUMERIC) AS NetPaymentTermsPeriod_ZBD3T,
      CAST(NULL AS NUMERIC) AS CashDiscountDays2_ZBD2T,
      CAST(NULL AS STRING) AS DebitcreditIndicator_SHKZG,
      CAST(NULL AS STRING) AS InvoiceToWhichTheTransactionBelongs_REBZG,
      Currency_WAERS AS CurrencyKey_WAERS,
      CAST(NULL AS STRING) AS SupplyingCountry_LANDL,
      CAST(NULL AS STRING) AS ObjectKey_AWKEY,
      InvoiceDocuments.InvStatus_RBSTAT,
      InvoiceDocuments.YearOfPostingDate_BUDAT,
      InvoiceDocuments.MonthOfPostingDate_BUDAT,
      InvoiceDocuments.WeekOfPostingDate_BUDAT,
      InvoiceDocuments.QuarterOfPostingDate_BUDAT,
      CAST(NULL AS STRING) AS LocalCurrency_HWAER
    FROM
      ${ctx.ref('InvoiceDocuments_Flow')} AS InvoiceDocuments
    WHERE
      InvoiceDocuments.Invstatus_RBSTAT = 'A'
    QUALIFY RANK() OVER (
      PARTITION BY InvoiceDocuments.Client_MANDT, InvoiceDocuments.CompanyCode_BUKRS, InvoiceDocuments.InvoiceDocNum_BELNR
      ORDER BY InvoiceDocuments.InvoiceDocLineNum_BUZEI
    ) = 1
  ),

  AccountingInvoicesKPI AS (
    SELECT
      AccountingInvoices.*,
      Companies.CompanyText_BUTXT,
      FiscalDateDimension_BUDAT.FiscalYearPeriod AS DocFiscPeriod,
      FiscalDateDimension_KEYDATE.FiscalYearPeriod AS KeyFiscPeriod,

      DATE_ADD(
        IF(
          AccountingInvoices.AccountType_KOART = 'K' AND AccountingInvoices.BaselineDateForDueDateCalculation_ZFBDT IS NULL,
          AccountingInvoices.DocumentDateInDocument_BLDAT,
          AccountingInvoices.BaselineDateForDueDateCalculation_ZFBDT
        ),
        INTERVAL CAST(
          CASE
            WHEN AccountingInvoices.AccountType_KOART = 'K' AND AccountingInvoices.NetPaymentTermsPeriod_ZBD3T IS NOT NULL
              THEN AccountingInvoices.NetPaymentTermsPeriod_ZBD3T
            WHEN AccountingInvoices.AccountType_KOART = 'K' AND AccountingInvoices.CashDiscountDays2_ZBD2T IS NOT NULL
              THEN AccountingInvoices.CashDiscountDays2_ZBD2T
            WHEN AccountingInvoices.AccountType_KOART = 'K' AND AccountingInvoices.CashDiscountDays1_ZBD1T IS NOT NULL
              THEN AccountingInvoices.CashDiscountDays1_ZBD1T
            WHEN AccountingInvoices.CashDiscountDays1_ZBD1T IS NULL
              THEN 0
            WHEN AccountingInvoices.AccountType_KOART = 'K' AND AccountingInvoices.DebitcreditIndicator_SHKZG = 'H'
              AND AccountingInvoices.InvoiceToWhichTheTransactionBelongs_REBZG IS NULL
              THEN 0
            ELSE 0
          END
          AS INT64
        ) DAY
      ) AS NetDueDate

    FROM AccountingInvoices
    INNER JOIN
      Companies
      ON
        AccountingInvoices.Client_MANDT = Companies.Client_MANDT
        AND AccountingInvoices.CompanyCode_BUKRS = Companies.CompanyCode_BUKRS
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_BUDAT
      ON
        AccountingInvoices.Client_MANDT = FiscalDateDimension_BUDAT.mandt
        AND Companies.CompanyFiscalyearVariant = FiscalDateDimension_BUDAT.periv
        AND AccountingInvoices.PostingDateInTheDocument_BUDAT = FiscalDateDimension_BUDAT.Date
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension_KEYDATE
      ON
        AccountingInvoices.Client_MANDT = FiscalDateDimension_KEYDATE.mandt
        AND Companies.CompanyFiscalyearVariant = FiscalDateDimension_KEYDATE.periv
        AND DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 DAY) = FiscalDateDimension_KEYDATE.Date
  )

SELECT
  AccountingInvoicesKPI.Client_MANDT,
  AccountingInvoicesKPI.CompanyCode_BUKRS,
  AccountingInvoicesKPI.CompanyText_BUTXT,
  AccountingInvoicesKPI.AccountNumberOfVendorOrCreditor_LIFNR AS AccountNumberOfVendorOrCreditor_LIFNR,
  Vendors.NAME1 AS NAME1,
  AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
  AccountingInvoicesKPI.AccountingDocumentNumber_BELNR,
  AccountingInvoicesKPI.NumberOfLineItemWithinAccountingDocument_BUZEI,
  AccountingInvoicesKPI.DocumentNumberOfTheClearingDocument_AUGBL,
  AccountingInvoicesKPI.TermsOfPaymentKey_ZTERM,
  AccountingInvoicesKPI.AccountType_KOART,
  AccountingInvoicesKPI.ReasonCodeForPayments_RSTGR,
  AccountingInvoicesKPI.PaymentBlockKey_ZLSPR,
  AccountingInvoicesKPI.ClearingDate_AUGDT,
  AccountingInvoicesKPI.PostingDateInTheDocument_BUDAT,
  AccountingInvoicesKPI.FiscalYear_GJAHR,
  AccountingInvoicesKPI.FiscalPeriod_MONAT AS FiscalPeriod_MONAT,
  AccountingInvoicesKPI.DocFiscPeriod,
  AccountingInvoicesKPI.KeyFiscPeriod,
  AccountingInvoicesKPI.NetDueDate,
  AccountingInvoicesKPI.InvStatus_RBSTAT,
  AccountingInvoicesKPI.PostingDate_BUDAT,
  AccountingInvoicesKPI.PurchasingDocumentNumber_EBELN,
  AccountingInvoicesKPI.CurrencyKey_WAERS AS CurrencyKey_WAERS,
  AccountingInvoicesKPI.SupplyingCountry_LANDL,
  AccountingInvoicesKPI.AccountingDocumenttype_BLART,
  AccountingInvoicesKPI.InvoiceDocumenttype_BLART,
  POOrderHistory.MovementType__inventoryManagement___BWART,
  POOrderHistory.AmountInLocalCurrency_DMBTR AS POOrderHistory_AmountInLocalCurrency_DMBTR,
  POOrderHistory.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS AS POOrderHistory_AmountInTargetCurrency_DMBTR,
  AccountingInvoicesKPI.YearOfPostingDateInTheDocument_BUDAT,
  AccountingInvoicesKPI.MonthOfPostingDateInTheDocument_BUDAT,
  AccountingInvoicesKPI.WeekOfPostingDateInTheDocument_BUDAT,
  AccountingInvoicesKPI.QuarterOfPostingDateInTheDocument_BUDAT,
  AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS AS AmountInTargetCurrency_DMBTR,
  CurrencyConversion.ExchangeRate_UKURS,
  CurrencyConversion.ToCurrency_TCURR AS TargetCurrency_TCURR,



  /* Overdue Amount */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND CURRENT_DATE() > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS OverdueAmountInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND CURRENT_DATE() > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS OverdueAmountInTargetCurrency,


  /* Outstanding But Not Overdue */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND CURRENT_DATE() <= AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS OutstandingButNotOverdueInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND CURRENT_DATE() <= AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS OutstandingButNotOverdueInTargetCurrency,

  /* Overdue On Past Date */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K'
    AND AccountingInvoicesKPI.PostingDateInTheDocument_BUDAT < CURRENT_DATE()
    AND AccountingInvoicesKPI.NetDueDate < CURRENT_DATE()
    AND AccountingInvoicesKPI.ClearingDate_AUGDT IS NULL,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  )
  + IF(
    AccountingInvoicesKPI.FollowOnDocumentType_REBZT = 'Z',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS OverdueOnPastDateInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K'
    AND AccountingInvoicesKPI.PostingDateInTheDocument_BUDAT < CURRENT_DATE()
    AND AccountingInvoicesKPI.NetDueDate < CURRENT_DATE()
    AND AccountingInvoicesKPI.ClearingDate_AUGDT IS NULL,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  )
  + IF(
    AccountingInvoicesKPI.FollowOnDocumentType_REBZT = 'Z',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS OverdueOnPastDateInTargetCurrency,

  /* Partial Payments */
  IF(
    AccountingInvoicesKPI.FollowOnDocumentType_REBZT = 'Z',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS PartialPaymentsInSourceCurrency,

  IF(
    AccountingInvoicesKPI.FollowOnDocumentType_REBZT = 'Z',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS PartialPaymentsInTargetCurrency,

  /* Late Payments */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND AccountingInvoicesKPI.ClearingDate_AUGDT > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS LatePaymentsInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND AccountingInvoicesKPI.ClearingDate_AUGDT > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS LatePaymentsInTargetCurrency,

  /* Upcoming Payments */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K'
    AND AccountingInvoicesKPI.NetDueDate BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 14 DAY)
    AND AccountingInvoicesKPI.ClearingDate_AUGDT IS NULL,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS UpcomingPaymentsInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K'
    AND AccountingInvoicesKPI.NetDueDate BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 14 DAY)
    AND AccountingInvoicesKPI.ClearingDate_AUGDT IS NULL,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS UpcomingPaymentsInTargetCurrency,

  /* Potential Penalty */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND AccountingInvoicesKPI.ClearingDate_AUGDT > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) * COALESCE(SAFE_CAST(VendorConfig.LowField_LOW AS INT64), 0) AS PotentialPenaltyInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'K' AND AccountingInvoicesKPI.ClearingDate_AUGDT > AccountingInvoicesKPI.NetDueDate,
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) * COALESCE(SAFE_CAST(VendorConfig.LowField_LOW AS INT64), 0) AS PotentialPenaltyInTargetCurrency,

  /* Purchase */
  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'M' AND POOrderHistory.MovementType__inventoryManagement___BWART IN ('101', '501'),
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    IF(
      AccountingInvoicesKPI.AccountType_KOART = 'M' AND POOrderHistory.MovementType__inventoryManagement___BWART IN ('102', '502'),
      AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * -1, 0
    )
  ) AS PurchaseInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountType_KOART = 'M' AND POOrderHistory.MovementType__inventoryManagement___BWART IN ('101', '501'),
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    IF(
      AccountingInvoicesKPI.AccountType_KOART = 'M' AND POOrderHistory.MovementType__inventoryManagement___BWART IN ('102', '502'),
      AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS * -1, 0
    )
  ) AS PurchaseInTargetCurrency,

  /* Parked Invoices */
  IF(AccountingInvoicesKPI.Invstatus_RBSTAT = 'A', TRUE, FALSE) AS IsParkedInvoice,

  /* Blocked Invoices */
  IF(AccountingInvoicesKPI.PaymentBlockKey_ZLSPR IN ('A', 'B'), TRUE, FALSE) AS IsBlockedInvoice,

  /* Cash Discount Received */
  IF(
    AccountingInvoicesKPI.AccountingDocumenttype_BLART IN (${paymentDocTypes.map(x => `'${x}'`).join(', ')}) AND AccountingInvoicesKPI.TransactionKey_KTOSL = '${cashDiscountTransactionKey}',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS CashDiscountReceivedInSourceCurrency,

  IF(
    AccountingInvoicesKPI.AccountingDocumenttype_BLART IN (${paymentDocTypes.map(x => `'${x}'`).join(', ')}) AND AccountingInvoicesKPI.TransactionKey_KTOSL = '${cashDiscountTransactionKey}',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS CashDiscountReceivedInTargetCurrency,

  /* Target Cash Discount */
  IF(
    AccountingInvoicesKPI.PostingKey_BSCHL = '31',
    (AccountingInvoicesKPI.AmountEligibleForCashDiscountInDocumentCurrency_SKFBT * AccountingInvoicesKPI.CashDiscountPercentage1_ZBD1P) / 100,
    0
  ) AS TargetCashDiscountInSourceCurrency,

  IF(
    AccountingInvoicesKPI.PostingKey_BSCHL = '31',
    (AccountingInvoicesKPI.AmountEligibleForCashDiscountInDocumentCurrency_SKFBT * CurrencyConversion.ExchangeRate_UKURS * AccountingInvoicesKPI.CashDiscountPercentage1_ZBD1P) / 100,
    0
  ) AS TargetCashDiscountInTargetCurrency,

  /* Amount Of Open Debit Items */
  IF(
    AccountingInvoicesKPI.Accounttype_KOART = 'K' AND AccountingInvoicesKPI.SpecialGlIndicator_UMSKZ = 'A',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR,
    0
  ) AS AmountOfOpenDebitItemsInSourceCurrency,

  IF(
    AccountingInvoicesKPI.Accounttype_KOART = 'K' AND AccountingInvoicesKPI.SpecialGlIndicator_UMSKZ = 'A',
    AccountingInvoicesKPI.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS,
    0
  ) AS AmountOfOpenDebitItemsInTargetCurrency,

  /* Amount Of Return */
  IF(
    POOrderHistory.MovementType__inventoryManagement___BWART = '122',
    POOrderHistory.AmountInLocalCurrency_DMBTR * POOrderHistory.Quantity_MENGE,
    0
  ) AS AmountOfReturnInSourceCurrency,

  IF(
    POOrderHistory.MovementType__inventoryManagement___BWART = '122',
    POOrderHistory.AmountInLocalCurrency_DMBTR * CurrencyConversion.ExchangeRate_UKURS * POOrderHistory.Quantity_MENGE,
    0
  ) AS AmountOfReturnInTargetCurrency

FROM AccountingInvoicesKPI
LEFT OUTER JOIN Vendors
  ON
    AccountingInvoicesKPI.Client_MANDT = Vendors.Client_MANDT
    AND AccountingInvoicesKPI.AccountNumberOfVendorOrCreditor_LIFNR = Vendors.AccountNumberOfVendorOrCreditor_LIFNR
LEFT OUTER JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'VendorConfig')} AS VendorConfig
  ON Vendors.AccountNumberOfVendorOrCreditor_LIFNR = ARRAY_REVERSE(SPLIT(VendorConfig.NameOfVariantVariable_NAME, '_'))[SAFE_OFFSET(0)]
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapPurchasing.datasetId, 'PurchaseDocumentsHistory')} AS POOrderHistory
  ON
    AccountingInvoicesKPI.Client_MANDT = POOrderHistory.Client_MANDT
    AND AccountingInvoicesKPI.PurchasingDocumentNumber_EBELN = POOrderHistory.PurchasingDocumentNumber_EBELN
    AND AccountingInvoicesKPI.ItemNumberOfPurchasingDocument_EBELP = POOrderHistory.ItemNumberOfPurchasingDocument_EBELP
    AND AccountingInvoicesKPI.FiscalYear_GJAHR = POOrderHistory.MaterialDocumentYear_GJAHR
    AND AccountingInvoicesKPI.ObjectKey_AWKEY = CONCAT(POOrderHistory.NumberOfMaterialDocument_BELNR, POOrderHistory.MaterialDocumentYear_GJAHR)

LEFT JOIN CurrencyConversion
  ON
    AccountingInvoicesKPI.Client_MANDT = CurrencyConversion.Client_MANDT
    AND AccountingInvoicesKPI.CurrencyKey_WAERS = CurrencyConversion.FromCurrency_FCURR
    AND AccountingInvoicesKPI.PostingDateInTheDocument_BUDAT = CurrencyConversion.ConvDate
`
);
