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

publish("financial_statement", { ...publishConfig, name: "FinancialStatement" }).query(
  (ctx) => `
WITH
  BaseTransactions AS (
    SELECT
      Client_MANDT AS Client,
      CompanyCode_BUKRS AS CompanyCode,
      BusinessArea_GSBER AS BusinessArea,
      LedgerInGeneralLedgerAccounting_RLDNR AS ledger,
      ProfitCenter_PRCTR AS ProfitCenter,
      CostCenter_KOSTL AS CostCenter,
      GeneralLedgerAccount_HKONT AS glaccount,
      FiscalYear_GJAHR AS FiscalYear,
      FiscalPeriod_MONAT AS FiscalPeriod,
      Indicator_AccountIsABalanceSheetAccount_XBILK AS BalanceSheetAccountIndicator,
      PlStatementAccountType_GVTYP AS PLAccountIndicator,
      CurrencyKey_WAERS AS currency,
      SUM(AmountInLocalCurrency_DMBTR) AS period_amount
    FROM
      ${ctx.ref('AccountingDocuments')}
    GROUP BY
      Client_MANDT, CompanyCode_BUKRS, BusinessArea_GSBER, LedgerInGeneralLedgerAccounting_RLDNR,
      ProfitCenter_PRCTR, CostCenter_KOSTL, GeneralLedgerAccount_HKONT, FiscalYear_GJAHR,
      FiscalPeriod_MONAT, Indicator_AccountIsABalanceSheetAccount_XBILK, PlStatementAccountType_GVTYP,
      CurrencyKey_WAERS
  ),

  UniqueCombinations AS (
    SELECT DISTINCT
      Client,
      CompanyCode,
      BusinessArea,
      ledger,
      ProfitCenter,
      CostCenter,
      glaccount,
      BalanceSheetAccountIndicator,
      PLAccountIndicator,
      currency
    FROM
      BaseTransactions
  ),

  PeriodGrid AS (
    SELECT
      c.*,
      p.FiscalYear,
      p.FiscalPeriod,
      p.FiscalQuarter
    FROM
      UniqueCombinations c
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CompaniesMD')} AS CompaniesMD
      ON
        c.Client = CompaniesMD.Client_MANDT
        AND c.CompanyCode = CompaniesMD.CompanyCode_BUKRS
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS p
      ON
        c.Client = p.mandt
        AND COALESCE(CompaniesMD.FiscalyearVariant_PERIV, 'K4') = p.periv
  ),

  DensedTransactions AS (
    SELECT
      g.*,
      COALESCE(t.period_amount, 0) AS period_amount
    FROM
      PeriodGrid g
    LEFT JOIN
      BaseTransactions t
      ON
        g.Client = t.Client
        AND g.CompanyCode = t.CompanyCode
        AND g.BusinessArea IS NOT DISTINCT FROM t.BusinessArea
        AND g.ledger IS NOT DISTINCT FROM t.ledger
        AND g.ProfitCenter IS NOT DISTINCT FROM t.ProfitCenter
        AND g.CostCenter IS NOT DISTINCT FROM t.CostCenter
        AND g.glaccount = t.glaccount
        AND g.FiscalYear = t.FiscalYear
        AND LTRIM(g.FiscalPeriod, '0') = LTRIM(t.FiscalPeriod, '0')
  ),

  CarryForward AS (
    SELECT
      Client,
      CompanyCode,
      BusinessArea,
      ledger,
      ProfitCenter,
      CostCenter,
      glaccount,
      FiscalYear,
      FiscalPeriod,
      FiscalQuarter,
      BalanceSheetAccountIndicator,
      PLAccountIndicator,
      currency,
      period_amount,
      CASE
        WHEN BalanceSheetAccountIndicator = 'X' THEN
          SUM(period_amount) OVER (
            PARTITION BY Client, CompanyCode, ledger, BusinessArea, ProfitCenter, CostCenter, glaccount, currency
            ORDER BY FiscalYear ASC, FiscalPeriod ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )
        ELSE
          SUM(period_amount) OVER (
            PARTITION BY Client, CompanyCode, ledger, BusinessArea, ProfitCenter, CostCenter, glaccount, currency, FiscalYear
            ORDER BY FiscalPeriod ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )
      END AS amount
    FROM
      DensedTransactions
  ),

  FSVGLAccounts AS (
    SELECT
      CF.Client AS Client,
      CF.glaccount AS GeneralLedgerAccount,
      FinancialStatementVersion.chartofaccounts AS ChartOfAccounts,
      FinancialStatementVersion.hiername AS HierarchyName,
      FinancialStatementVersion.hierarchyversion AS HierarchyVersion,
      CF.CompanyCode AS CompanyCode,
      CF.BusinessArea AS BusinessArea,
      CF.ledger AS LedgerInGeneralLedgerAccounting,
      CF.ProfitCenter AS ProfitCenter,
      CF.CostCenter AS CostCenter,
      CF.BalanceSheetAccountIndicator AS BalanceSheetAccountIndicator,
      CF.PLAccountIndicator AS PLAccountIndicator,
      CF.FiscalYear AS FiscalYear,
      CF.FiscalPeriod AS FiscalPeriod,
      CF.FiscalQuarter AS FiscalQuarter,
      FinancialStatementVersion.parent AS Parent,
      FinancialStatementVersion.node AS Node,
      FinancialStatementVersion.node AS FinancialStatementItem,
      FinancialStatementVersion.level AS Level,
      FinancialStatementVersion.isleafnode AS IsLeafNode,
      CF.period_amount AS AmountInLocalCurrency,
      CF.amount AS CumulativeAmountInLocalCurrency,
      CF.currency AS CurrencyKey,
      CompaniesMD.CompanyText_BUTXT AS CompanyText
    FROM
      CarryForward CF
    INNER JOIN
      ${ctx.ref('fsv_glaccounts')} AS FinancialStatementVersion
      ON
        CF.Client = FinancialStatementVersion.mandt
        AND CF.glaccount = FinancialStatementVersion.glaccount
    LEFT JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CompaniesMD')} AS CompaniesMD
      ON
        CF.Client = CompaniesMD.Client_MANDT
        AND CF.CompanyCode = CompaniesMD.CompanyCode_BUKRS
  )

SELECT
  Client,
  CompanyCode,
  FiscalYear,
  FiscalPeriod,
  ChartOfAccounts,
  HierarchyName,
  BusinessArea,
  LedgerInGeneralLedgerAccounting,
  ProfitCenter,
  CostCenter,
  Node,
  ANY_VALUE(HierarchyVersion) AS HierarchyVersion,
  ANY_VALUE(Parent) AS Parent,
  ANY_VALUE(FiscalQuarter) AS FiscalQuarter,
  ANY_VALUE(FinancialStatementItem) AS FinancialStatementItem,
  ANY_VALUE(Level) AS Level,
  ANY_VALUE(IsLeafNode) AS IsLeafNode,
  ANY_VALUE(BalanceSheetAccountIndicator) AS BalanceSheetAccountIndicator,
  ANY_VALUE(PLAccountIndicator) AS PLAccountIndicator,
  ANY_VALUE(CompanyText) AS CompanyText,
  ANY_VALUE(CurrencyKey) AS CurrencyKey,
  SUM(AmountInLocalCurrency) AS AmountInLocalCurrency,
  SUM(CumulativeAmountInLocalCurrency) AS CumulativeAmountInLocalCurrency
FROM
  FSVGLAccounts
GROUP BY
  Client,
  CompanyCode,
  ChartOfAccounts,
  HierarchyName,
  BusinessArea,
  LedgerInGeneralLedgerAccounting,
  ProfitCenter,
  CostCenter,
  FiscalYear,
  FiscalPeriod,
  Node
`
);
