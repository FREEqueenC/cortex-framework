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

/**
 * Helper to generate the JOIN syntax for an exchange rate table.
 * @param {string} sourceTableAlias The alias of the table containing the source data.
 * @param {string} sourceDateCol The name of the column containing the date for the exchange rate lookup.
 * @param {string} sourceCurrencyCol The name of the column containing the source currency code.
 * @param {string} targetCurrencyCol The name of the column containing the target currency code.
 * @param {string} exchangeRatesTableRef The reference to the exchange rates table.
 * @return {string} A SQL LEFT JOIN clause.
 */
function joinExchangeRateTable(sourceTableAlias, sourceDateCol, sourceCurrencyCol, targetCurrencyCol, exchangeRatesTableRef) {
  return `
    LEFT JOIN ${exchangeRatesTableRef} AS xr
      ON ${sourceTableAlias}.client_mandt = xr.client_mandt
      AND ${sourceTableAlias}.${sourceCurrencyCol} = xr.from_currency_fcurr
      AND ${targetCurrencyCol} = xr.to_currency_tcurr
      AND ${sourceTableAlias}.${sourceDateCol} = xr.conv_date
      AND xr.exchange_rate_type_kurst = 'M'
  `;
}

/**
 * Helper to execute the actual amount conversion.
 * @param {string} amountExpr The full expression for the amount (e.g., 'sales.amount').
 * @param {string} sourceCurrencyExpr The full expression for the source currency (e.g., 'sales.doc_currency').
 * @param {string} targetCurrencyExpr The target currency (e.g., "'USD'").
 * @param {string} [xrAlias='xr'] Optional. The alias of the joined exchange rate table.
 * @return {string} A SQL CASE statement for converting the currency.
 */
function convertCurrency(amountExpr, sourceCurrencyExpr, targetCurrencyExpr, xrAlias = 'xr') {
  return `
    CASE 
      WHEN ${targetCurrencyExpr} = ${sourceCurrencyExpr} THEN ${amountExpr}
      ELSE ${amountExpr} * ${xrAlias}.exchange_rate_ukurs
    END
  `;
}

/**
 * Returns a SQL query string for the currency decimal table.
 * The table includes the currency key and the currency decimal shift factor.
 * @param {string} tcurxTableRef The reference to the tcurx table.
 * @return {string} A SQL query string.
 */
function currencyDecimalShift(tcurxTableRef) {
  return `
SELECT DISTINCT
    tcurx.CURRKEY,
    CAST(POWER(10, 2 - COALESCE(tcurx.CURRDEC, 0)) AS NUMERIC) AS CURRFIX
  FROM
    ${tcurxTableRef} AS tcurx
`;
}

/**
 * Helper to calculate the amount with decimal shift.
 * @param {string} field The field name containing the amount.
 * @param {string} decimalShiftTableAlias The alias of the table containing the decimal shift factor.
 * @return {string} A SQL expression for the amount with decimal shift.
 */
function amountWithDecimalShift(field, decimalShiftTableAlias) {
  return `COALESCE(${field} * ${decimalShiftTableAlias}.CURRFIX, ${field})`;
}

module.exports = {
  currencyDecimalShift,
  joinExchangeRateTable,
  convertCurrency,
  amountWithDecimalShift
};
