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
const currencyHelper = require("includes/cortex_v6_compatibility_currency.js");
const dateHelper = require("includes/cortex_v6_compatibility_date.js");

const materializationType = tableConfig.materializationType || "table";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("pricing_conditions", { ...publishConfig, name: "PricingConditions" }).query(
  (ctx) => `
WITH
  currency_decimal AS (
    ${currencyHelper.getCurrencyDecimalCTE(ctx, moduleConfig.sources.sapModule.datasetId)}
  ),
  CalendarDateDimension_KDATU AS (
    ${dateHelper.getCalendarDateDimCTE(ctx)}
  )

SELECT
  konv.MANDT AS Client_MANDT,
  konv.KNUMV AS NumberOfTheDocumentCondition_KNUMV,
  konv.KPOSN AS ConditionItemNumber_KPOSN,
  konv.STUNR AS StepNumber_STUNR,
  konv.ZAEHK AS ConditionCounter_ZAEHK,
  konv.KAPPL AS Application_KAPPL,
  konv.KSCHL AS ConditionType_KSCHL,
  konv.KRECH AS CalculationTypeForCondition_KRECH,
  konv.KAWRT AS Checkbox_KAWRT,
  konv.KBETR AS ConditionAmountOrPercentage_KBETR,
  konv.KKURS AS ConditionExchangeRateForConversionToLocalCurrency_KKURS,
  konv.KPEIN AS ConditionPricingUnit_KPEIN,
  konv.KMEIN AS ConditionUnitInTheDocument_KMEIN,
  konv.KUMZA AS NumeratorForConvertingConditionUnitsToBaseUnits_KUMZA,
  konv.KUMNE AS DenominatorForConvertingConditionUnitsToBaseUnits_KUMNE,
  konv.KNTYP AS ConditionCategory_KNTYP,
  konv.KSTAT AS ConditionIsUsedForStatistics_KSTAT,
  konv.KNPRS AS ScaleType_KNPRS,
  konv.KRUEK AS ConditionIsRelevantForAccrual_KRUEK,
  konv.KRELI AS ConditionForInvoiceList_KRELI,
  konv.KHERK AS OriginOfTheCondition_KHERK,
  konv.KGRPE AS GroupCondition_KGRPE,
  konv.KOUPD AS ConditionUpdate_KOUPD,
  konv.KOLNR AS AccessSequenceAccessNumber_KOLNR,
  konv.KNUMH AS NumberOfConditionRecordFromBatchDetermination_KNUMH,
  konv.KOPOS AS SequentialNumberOfTheCondition_KOPOS,
  konv.KVSL1 AS AccountKey_KVSL1,
  konv.SAKN1 AS GLAccountNumber_SAKN1,
  konv.MWSK1 AS TaxOnSalesPurchasesCode_MWSK1,
  konv.KVSL2 AS AccountKeyAccrualsProvisions_KVSL2,
  konv.SAKN2 AS GLAccountNumber_SAKN2,
  konv.MWSK2 AS WithholdingTaxCode_MWSK2,
  konv.LIFNR AS AccountNumberOfVendorORCreditor_LIFNR,
  konv.KUNNR AS CustomerNumber_KUNNR,
  konv.KDIFF AS RoundingOffDifferenceOfTheCondition_KDIFF,
  konv.KSTEU AS ConditionControl_KSTEU,
  konv.KINAK AS ConditionIsInactive_KINAK,
  konv.KOAID AS ConditionClass_KOAID,
  konv.ZAEKO AS ConditionCounter_ZAEKO,
  konv.KMXAW AS IndicatorForMaximumConditionBaseValue_KMXAW,
  konv.KMXWR AS IndicatorForMaximumConditionAmount_KMXWR,
  konv.KFAKTOR AS FactorForConditionBaseValue_KFAKTOR,
  konv.KDUPL AS StructureCondition_KDUPL,
  konv.KFAKTOR1 AS FactorForConditionBasis_KFAKTOR1,
  konv.KZBZG AS ScaleBasisIndicator_KZBZG,
  konv.KSTBS AS ScaleBaseValueOfTheCondition_KSTBS,
  konv.KONMS AS ConditionScaleUnitOfMeasure_KONMS,
  konv.KONWS AS ScaleCurrency_KONWS,
  konv.KAWRT_K AS UpdatedInformationInRelatedUserDataField_KAWRT_K,
  konv.KWAEH AS ConditionCurrency_KWAEH,
  konv.KWERT_K AS ConditionValue_KWERT_K,
  konv.KFKIV AS ConditionForInterCompanyBilling_KFKIV,
  konv.KVARC AS VariantCond_KVARC,
  konv.KMPRS AS ConditionChangedManually_KMPRS,
  konv.PRSQU AS PriceSource_PRSQU,
  konv.VARCOND AS VariantCondition_VARCOND,
  konv.KTREL AS RelevanceForAccountAssignment_KTREL,
  konv.MDFLG AS IndicatorMatrixMaintenance_MDFLG,
  konv.TXJLV AS TaxJurisdictionCodeLevel_TXJLV,
  konv.KBFLAG AS BitEncryptedFlagsInPricing_KBFLAG,
  konv.CPF_GUID AS IdentifierOfCPFFormulaInDocument_CPF_GUID,
  konv.KAQTY AS AdjustedQuantity_KAQTY,
  CalendarDateDimension_KDATU.CalYear AS YearOfChangeDate_KDATU,
  CalendarDateDimension_KDATU.CalMonth AS MonthOfChangeDate_KDATU,
  CalendarDateDimension_KDATU.CalWeek AS WeekOfChangeDate_KDATU,
  CalendarDateDimension_KDATU.CalQuarter AS QuarterOfChangeDate_KDATU,
  konv.KDATU AS Checkbox_KDATU,
  konv.STUFE AS Level_STUFE,
  konv.WEGXX AS Path_WEGXX,
  konv.KOLNR3 AS AccessSequenceAccessNumber_KOLNR3,
  CAST(NULL AS STRING) AS ProcessConditionsWithValueEqualToZero_VAL_ZERO,
  CAST(NULL AS STRING) AS StatisticalAndRelevantForAccountDetermination_IS_ACCT_DETN_RELEVANT,
  CAST(NULL AS STRING) AS TaxReportingCountry_TAX_COUNTRY,
  CAST(NULL AS STRING) AS SDDocumentCurrency_WAERK,
  CAST(NULL AS DATE) AS DataFilterValueForDataAging_DATAAGING,
  COALESCE(konv.WAERS, '') AS CurrencyKey_WAERS,
  COALESCE(konv.KWERT * currency_decimal.CURRFIX, konv.KWERT) AS ConditionValue_KWERT
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'konv')} AS konv
LEFT JOIN currency_decimal AS currency_decimal
  ON COALESCE(konv.WAERS, '') = currency_decimal.CURRKEY
LEFT JOIN CalendarDateDimension_KDATU AS CalendarDateDimension_KDATU
  ON CalendarDateDimension_KDATU.Date = konv.KDATU
`
);
