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

publish("sales_order_pricing", { ...publishConfig, name: "SalesOrderPricing" }).query(
  (ctx) => `
SELECT
  PricingConditions.Client_MANDT,
  PricingConditions.NumberOfTheDocumentCondition_KNUMV,
  PricingConditions.ConditionItemNumber_KPOSN,
  MAX(CurrencyKey_WAERS) AS ConditionValueCurrencyKey_WAERS,
  MAX(Checkbox_KDATU) AS Checkbox_KDATU,
  SUM(
    IF(
      PricingConditions.CalculationTypeForCondition_KRECH = 'C'
        AND PricingConditions.ConditionClass_KOAID = 'B'
        AND PricingConditions.ConditionIsInactive_KINAK IS NULL,
      PricingConditions.ConditionValue_KWERT,
    NULL)
  ) AS ListPrice,
  SUM(
    IF(
      PricingConditions.CalculationTypeForCondition_KRECH = 'C'
        AND PricingConditions.ConditionClass_KOAID = 'B'
        AND PricingConditions.ConditionType_KSCHL = 'PB00',
      PricingConditions.ConditionValue_KWERT,
    NULL)
  ) AS AdjustedPrice,
  SUM(
    IF(
      PricingConditions.ConditionClass_KOAID = 'A'
        AND PricingConditions.ConditionIsInactive_KINAK IS NULL,
      PricingConditions.ConditionValue_KWERT,
    NULL)
  ) AS Discount,
  SUM(
    IF(
      PricingConditions.ConditionForIntercompanyBilling_KFKIV = 'X'
        AND PricingConditions.ConditionClass_KOAID = 'B'
        AND PricingConditions.ConditionIsInactive_KINAK IS NULL,
      PricingConditions.ConditionValue_KWERT,
    NULL)
  ) AS InterCompanyPrice
FROM ${ctx.ref('PricingConditions')} AS PricingConditions
GROUP BY
  PricingConditions.Client_MANDT,
  PricingConditions.NumberOfTheDocumentCondition_KNUMV,
  PricingConditions.ConditionItemNumber_KPOSN
`
);
