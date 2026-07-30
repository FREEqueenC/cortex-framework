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

publish("days_payable_outstanding", { ...publishConfig, name: "DaysPayableOutstanding" }).query(
  (ctx) => `
WITH
  AccountsPayableAgg AS (
    SELECT
      AccountsPayable.Client_MANDT,
      AccountsPayable.CompanyCode_BUKRS,
      AccountsPayable.CompanyText_BUTXT,
      AccountsPayable.TargetCurrency_TCURR,
      SUBSTR(AccountsPayable.DocFiscPeriod, 1, 4) AS FiscalYear,
      SUBSTR(AccountsPayable.DocFiscPeriod, 5, 3) AS FiscalPeriod,
      SUM(AccountsPayable.OverdueAmountInSourceCurrency)
      + SUM(AccountsPayable.PartialPaymentsInSourceCurrency) AS OverdueAmountInSourceCurrency,
      SUM(AccountsPayable.OverdueAmountInTargetCurrency)
      + SUM(AccountsPayable.PartialPaymentsInTargetCurrency) AS OverdueAmountInTargetCurrency
    FROM
      ${ctx.ref('AccountsPayable')} AS AccountsPayable
    WHERE
      AccountsPayable.DocFiscPeriod <= AccountsPayable.KeyFiscPeriod
    GROUP BY
      AccountsPayable.Client_MANDT,
      AccountsPayable.CompanyCode_BUKRS,
      AccountsPayable.CompanyText_BUTXT,
      AccountsPayable.DocFiscPeriod,
      AccountsPayable.TargetCurrency_TCURR
  ),

  InventoryMetricsAgg AS (
    SELECT
      InventoryKeyMetrics.Client_MANDT,
      InventoryKeyMetrics.CompanyCode_BUKRS,
      InventoryKeyMetrics.FiscalYear,
      InventoryKeyMetrics.FiscalPeriod,
      InventoryKeyMetrics.TargetCurrency_TCURR,
      SUM(InventoryKeyMetrics.CostOfGoodsSoldByMonth) AS COGSInSourceCurrency,
      SUM(InventoryKeyMetrics.CostofGoodsSoldInTargetCurrency) AS COGSInTargetCurrency
    FROM
      ${ctx.ref('InventoryKeyMetrics')} AS InventoryKeyMetrics
    WHERE
      InventoryKeyMetrics.LanguageKey_SPRAS = (
        SELECT LanguageKey_SPRAS
        FROM ${ctx.ref('InventoryKeyMetrics')}
        LIMIT 1
      )
    GROUP BY
      InventoryKeyMetrics.Client_MANDT,
      InventoryKeyMetrics.CompanyCode_BUKRS,
      InventoryKeyMetrics.FiscalYear,
      InventoryKeyMetrics.FiscalPeriod,
      InventoryKeyMetrics.TargetCurrency_TCURR
  ),

  AccountsPayableKPI AS (
    SELECT
      AccountsPayableAgg.Client_MANDT,
      AccountsPayableAgg.CompanyCode_BUKRS,
      AccountsPayableAgg.CompanyText_BUTXT,
      AccountsPayableAgg.TargetCurrency_TCURR,
      AccountsPayableAgg.FiscalYear,
      AccountsPayableAgg.FiscalPeriod,
      AccountsPayableAgg.OverdueAmountInSourceCurrency,
      AccountsPayableAgg.OverdueAmountInTargetCurrency,
      Fiscal.StartDate AS FiscalPeriodStart,
      Fiscal.EndDate AS FiscalPeriodEnd,
      SUM(AccountsPayableAgg.OverdueAmountInSourceCurrency) OVER (
        PARTITION BY
          AccountsPayableAgg.Client_MANDT,
          AccountsPayableAgg.CompanyCode_BUKRS,
          AccountsPayableAgg.TargetCurrency_TCURR
        ORDER BY
          AccountsPayableAgg.FiscalYear,
          AccountsPayableAgg.FiscalPeriod
      ) AS PeriodAPInSourceCurrency,

      SUM(AccountsPayableAgg.OverdueAmountInTargetCurrency) OVER (
        PARTITION BY
          AccountsPayableAgg.Client_MANDT,
          AccountsPayableAgg.CompanyCode_BUKRS,
          AccountsPayableAgg.TargetCurrency_TCURR
        ORDER BY
          AccountsPayableAgg.FiscalYear,
          AccountsPayableAgg.FiscalPeriod
      ) AS PeriodAPInTargetCurrency

    FROM AccountsPayableAgg AS AccountsPayableAgg
    INNER JOIN ${ctx.ref('CompaniesMD')} AS Company
      ON
        AccountsPayableAgg.Client_MANDT = Company.Client_MANDT
        AND AccountsPayableAgg.CompanyCode_BUKRS = Company.CompanyCode_BUKRS
    INNER JOIN (
      SELECT
        mandt,
        periv,
        FiscalPeriod,
        FiscalYear,
        MIN(Date) AS StartDate,
        MAX(Date) AS Enddate
      FROM ${ctx.ref('fiscal_date_dim')}
      GROUP BY mandt, periv, FiscalPeriod, FiscalYear
    ) AS Fiscal
      ON
        AccountsPayableAgg.Client_MANDT = Fiscal.mandt
        AND Company.FiscalyearVariant_PERIV = Fiscal.periv
        AND AccountsPayableAgg.FiscalYear = Fiscal.FiscalYear
        AND AccountsPayableAgg.FiscalPeriod = Fiscal.FiscalPeriod
  )

SELECT
  AccountsPayableKPI.Client_MANDT,
  AccountsPayableKPI.CompanyCode_BUKRS,
  AccountsPayableKPI.CompanyText_BUTXT,
  AccountsPayableKPI.FiscalYear,
  AccountsPayableKPI.FiscalPeriod,
  AccountsPayableKPI.TargetCurrency_TCURR,
  AccountsPayableKPI.PeriodAPInSourceCurrency,
  AccountsPayableKPI.PeriodAPInTargetCurrency,
  InventoryMetricsAgg.COGSInSourceCurrency,
  InventoryMetricsAgg.COGSInTargetCurrency,

  DATE_DIFF(
    AccountsPayableKPI.FiscalPeriodEnd,
    AccountsPayableKPI.FiscalPeriodStart,
    DAY
  ) + 1 AS NumberOfDays,

  SAFE_DIVIDE(
    AccountsPayableKPI.PeriodAPInSourceCurrency
    * (DATE_DIFF(
      AccountsPayableKPI.FiscalPeriodEnd,
      AccountsPayableKPI.FiscalPeriodStart,
      DAY
    ) + 1),
    InventoryMetricsAgg.COGSInSourceCurrency
  ) AS DaysPayableOutstandingInSourceCurrency,

  SAFE_DIVIDE(
    AccountsPayableKPI.PeriodAPInTargetCurrency
    * (DATE_DIFF(
      AccountsPayableKPI.FiscalPeriodEnd,
      AccountsPayableKPI.FiscalPeriodStart,
      DAY
    ) + 1),
    InventoryMetricsAgg.COGSInTargetCurrency
  ) AS DaysPayableOutstandingInTargetCurrency

FROM AccountsPayableKPI AS AccountsPayableKPI
INNER JOIN InventoryMetricsAgg AS InventoryMetricsAgg
  ON AccountsPayableKPI.Client_MANDT = InventoryMetricsAgg.Client_MANDT
    AND AccountsPayableKPI.CompanyCode_BUKRS = InventoryMetricsAgg.CompanyCode_BUKRS
    AND AccountsPayableKPI.FiscalYear = InventoryMetricsAgg.FiscalYear
    AND AccountsPayableKPI.FiscalPeriod = InventoryMetricsAgg.FiscalPeriod
    AND AccountsPayableKPI.TargetCurrency_TCURR = InventoryMetricsAgg.TargetCurrency_TCURR
`
);
