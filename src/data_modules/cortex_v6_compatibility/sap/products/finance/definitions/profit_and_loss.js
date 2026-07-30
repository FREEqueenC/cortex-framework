// ___MODULE_CONTEXT___
// ___TABLE_CONFIG___

const moduleConfig = config.product[moduleContext.moduleId];
const publish_config = require("includes/publish_config.js");

const targetCurrencies = moduleConfig.moduleSettings?.targetCurrencies || ['USD'];
const rateType = moduleConfig.moduleSettings?.rateType || 'M';
const languages = moduleConfig.moduleSettings?.languages || ['E'];

const mandt = moduleConfig.sources.sapModule.mandt || '100';

const materializationType = tableConfig.materializationType || "table";
const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("profit_and_loss", { ...publishConfig, name: "ProfitAndLoss" }).query(
  (ctx) => `
#-- Copyright 20223
#-- Licensed under the Apache License, Version 2.0 (the "License");
#-- you may not use this file except in compliance with the License.
#-- You may obtain a copy of the License at
#--
#--     https://www.apache.org/licenses/LICENSE-2.0
#--
#-- Unless required by applicable law or agreed to in writing, software
#-- distributed under the License is distributed on an "AS IS" BASIS,
#-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#-- See the License for the specific language governing permissions and
#-- limitations under the License.

--The granularity of this query is Client,Company,ChartOfAccounts,HierarchyName,BusinessArea,
--ProfitCenter,CostCenter,LedgerInGeneralLedgerAccounting,FiscalYear,FiscalPeriod,Hierarchy Node,
--Language,TargetCurrency.
WITH
  LanguageKey AS (
    SELECT
      LanguageKey_SPRAS
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'Languages_T002')}
    WHERE LanguageKey_SPRAS IN UNNEST(${JSON.stringify(languages)})
  ),

  CurrencyConversion AS (
    SELECT
      Companies.Client_MANDT,
      MAX(Companies.FiscalYearVariant_PERIV) AS periv,
      Companies.CompanyCode_BUKRS,
      FiscalDateDimension.FiscalYear,
      FiscalDateDimension.FiscalPeriod,
      Currency.FromCurrency_FCURR,
      Currency.ToCurrency_TCURR,
      MAX_BY(Currency.ExchangeRate_UKURS, FiscalDateDimension.Date) AS ExchangeRate,
      MAX(Currency.ExchangeRate_UKURS) AS MaxExchangeRate,
      AVG(Currency.ExchangeRate_UKURS) AS AvgExchangeRate
    FROM
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'fiscal_date_dim')} AS FiscalDateDimension
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CompaniesMD')} AS Companies
      ON
        Companies.Client_MANDT = FiscalDateDimension.MANDT
        AND Companies.FiscalYearVariant_PERIV = FiscalDateDimension.periv
        AND FiscalDateDimension.Date <= CURRENT_DATE()
    INNER JOIN
      ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CurrencyConversion')} AS Currency
      ON
        FiscalDateDimension.MANDT = Currency.Client_MANDT
        AND FiscalDateDimension.Date = Currency.ConvDate
        AND Companies.CurrencyCode_WAERS = Currency.FromCurrency_FCURR
    WHERE
      Currency.Client_MANDT = '${mandt}'
      AND Currency.ToCurrency_TCURR IN UNNEST(${JSON.stringify(targetCurrencies)})
      --## CORTEX-CUSTOMER Modify the exchange rate type based on your requirement
      AND Currency.ExchangeRateType_KURST = '${rateType}'
    GROUP BY
      Companies.Client_MANDT,
      Companies.CompanyCode_BUKRS,
      FiscalDateDimension.FiscalYear,
      FiscalDateDimension.FiscalPeriod,
      Currency.FromCurrency_FCURR,
      Currency.ToCurrency_TCURR
  ),

  ParentId AS (
    SELECT
      fsv_parent.Client,
      fsv_parent.CompanyCode,
      fsv_parent.Parent,
      fsv_child.FinancialStatementItem
    FROM
      (
        SELECT DISTINCT
          Client,
          CompanyCode,
          Parent
        FROM ${ctx.ref('FinancialStatement')}
        -- PLAccountIndicator in ('P','N') represents GLAccount for Profit & Loss
        WHERE PLAccountIndicator IN ('P', 'N')
      ) AS fsv_parent
    INNER JOIN -- noqa: disable=L042
      (
        SELECT DISTINCT
          Client,
          CompanyCode,
          Node,
          FinancialStatementItem
        FROM ${ctx.ref('FinancialStatement')}
        -- PLAccountIndicator in ('P','N') represents GLAccount for Profit & Loss
        WHERE PLAccountIndicator IN ('P', 'N')
      ) AS fsv_child -- noqa: enable=all
      ON
        fsv_parent.Client = fsv_child.Client
        AND fsv_parent.Parent = fsv_child.Node
        AND fsv_parent.CompanyCode = fsv_child.CompanyCode
  )

SELECT
  FSV.Client,
  FSV.CompanyCode,
  FSV.FiscalYear,
  FSV.FiscalPeriod,
  FSV.ChartOfAccounts,
  FSV.HierarchyName AS GLHierarchy,
  FSV.BusinessArea,
  FSV.LedgerInGeneralLedgerAccounting,
  FSV.ProfitCenter,
  FSV.CostCenter,
  FSV.Node AS GLNode,
  LanguageKey.LanguageKey_SPRAS,
  FSV.Parent AS GLParent,
  FSV.FinancialStatementItem AS GLFinancialItem,
  --The following text columns are language dependent.
  COALESCE(GLNodeText.HierarchyNodeDescription_NODETXT, GLText.GlAccountLongText_TXT50) AS GLNodeText,
  GLParentText.HierarchyNodeDescription_NODETXT AS GLParentText,
  FSV.Level AS GLLevel,
  FSV.FiscalQuarter AS FiscalQuarter,
  FSV.IsLeafNode AS GLIsLeafNode,
  --The following text column is language independent.
  FSV.CompanyText AS CompanyText,
  FSV.AmountInLocalCurrency AS AmountInLocalCurrency,
  SUM(FSV.AmountInLocalCurrency)
    OVER ( -- noqa: disable=L003
      PARTITION BY
        FSV.Client, FSV.CompanyCode, FSV.BusinessArea,
        FSV.LedgerInGeneralLedgerAccounting, FSV.ProfitCenter, FSV.CostCenter,
        FSV.Node, LanguageKey.LanguageKey_SPRAS, CurrencyConversion.ToCurrency_TCURR
      ORDER BY
        FSV.FiscalYear ASC, FSV.FiscalPeriod ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS CumulativeAmountInLocalCurrency,
  FSV.CurrencyKey AS CurrencyKey,
  -- The following columns are having amount/prices in target currency.
  CurrencyConversion.ExchangeRate AS ExchangeRate,
  CurrencyConversion.MaxExchangeRate AS MaxExchangeRate,
  CurrencyConversion.AvgExchangeRate AS AvgExchangeRate,
  (FSV.AmountInLocalCurrency * CurrencyConversion.ExchangeRate) AS AmountInTargetCurrency,
  SUM(FSV.AmountInLocalCurrency * CurrencyConversion.ExchangeRate)
    OVER (
      PARTITION BY
        FSV.Client, FSV.CompanyCode, FSV.BusinessArea,
        FSV.LedgerInGeneralLedgerAccounting, FSV.Node, FSV.ProfitCenter, FSV.CostCenter,
        LanguageKey.LanguageKey_SPRAS, CurrencyConversion.ToCurrency_TCURR
      ORDER BY
        FSV.FiscalYear ASC, FSV.FiscalPeriod ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS CumulativeAmountInTargetCurrency,--noqa: enable=all
  CurrencyConversion.ToCurrency_TCURR AS TargetCurrency_TCURR

FROM
  (
    SELECT
      Client,
      CompanyCode,
      FiscalYear,
      FiscalPeriod,
      FiscalQuarter,
      ChartOfAccounts,
      HierarchyName,
      HierarchyVersion,
      BusinessArea,
      LedgerInGeneralLedgerAccounting,
      ProfitCenter,
      CostCenter,
      Node,
      Parent,
      FinancialStatementItem,
      Level,
      IsLeafNode,
      CompanyText,
      AmountInLocalCurrency,
      CurrencyKey
    FROM ${ctx.ref('FinancialStatement')}
    -- PLAccountIndicator in ('P', 'N') represents GLAccount for Profit & Loss
    WHERE PLAccountIndicator IN ('P', 'N')
  ) AS FSV

LEFT JOIN ParentId
  ON
    FSV.Client = ParentId.Client
    AND FSV.Parent = ParentId.Parent
    AND FSV.CompanyCode = ParentId.CompanyCode
LEFT JOIN CurrencyConversion
  ON
    FSV.Client = CurrencyConversion.Client_MANDT
    AND FSV.CompanyCode = CurrencyConversion.CompanyCode_BUKRS
    AND FSV.CurrencyKey = CurrencyConversion.FromCurrency_FCURR
    AND FSV.FiscalYear = CurrencyConversion.FiscalYear
    AND FSV.FiscalPeriod = CurrencyConversion.FiscalPeriod
CROSS JOIN LanguageKey
LEFT JOIN
  ${ctx.ref('FSVTextsMD')} AS GLNodeText
  ON
    FSV.Client = GLNodeText.Client_MANDT
    AND FSV.HierarchyName = GLNodeText.HierarchyID_HRYID
    AND FSV.HierarchyVersion = GLNodeText.HierarchyVersion_HRYVER
    AND FSV.Node = GLNodeText.HierarchyNode_HRYNODE
    AND GLNodeText.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'GLAccountsMD')} AS GLText
  ON
    FSV.Client = GLText.Client_MANDT
    AND FSV.ChartOfAccounts = GLText.ChartOfAccounts_KTOPL
    AND FSV.FinancialStatementItem = GLText.GlAccountNumber_SAKNR
    AND GLText.Language_SPRAS = LanguageKey.LanguageKey_SPRAS
LEFT JOIN
  ${ctx.ref('FSVTextsMD')} AS GLParentText
  ON
    FSV.Client = GLParentText.Client_MANDT
    AND FSV.HierarchyName = GLParentText.HierarchyID_HRYID
    AND FSV.HierarchyVersion = GLParentText.HierarchyVersion_HRYVER
    AND FSV.Parent = GLParentText.HierarchyNode_HRYNODE
    AND GLParentText.LanguageKey_SPRAS = LanguageKey.LanguageKey_SPRAS
`
);
