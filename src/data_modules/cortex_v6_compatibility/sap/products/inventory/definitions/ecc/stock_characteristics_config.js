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

const publishConfig = publish_config.getPublishConfig(
  "view",
  tableConfig,
  moduleConfig,
  []
);

const rows = [
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '343', StockCharacteristic: 'Blocked' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '349', StockCharacteristic: 'Blocked' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '352', StockCharacteristic: 'InTransit' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '342', StockCharacteristic: 'Restricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '102', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '122', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '201', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '261', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '303', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '311', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '322', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '341', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '344', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '351', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '453', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '553', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '562', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '601', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '321', StockCharacteristic: 'QualityInspection' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'H', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '350', StockCharacteristic: 'QualityInspection' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '344', StockCharacteristic: 'Blocked' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '350', StockCharacteristic: 'Blocked' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '351', StockCharacteristic: 'InTransit' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '341', StockCharacteristic: 'Restricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '101', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '262', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '303', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '305', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '311', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '321', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '342', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '343', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '352', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '453', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: 'W', MovementType_BWART: '561', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: 'O', MovementType_BWART: '561', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '561', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: 'E', MovementType_BWART: '561', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '602', StockCharacteristic: 'Unrestricted' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: 'K', MovementType_BWART: '101', StockCharacteristic: 'VendorManaged' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '651', StockCharacteristic: 'BlockedReturns' },
  { Client_MANDT: '100', StockType_INSMK: 'X', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '101', StockCharacteristic: 'QualityInspection' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '322', StockCharacteristic: 'QualityInspection' },
  { Client_MANDT: '100', StockType_INSMK: '', Debit_CreditIndicator_SHKZG: 'S', SpecialStockIndicator_SOBKZ: '', MovementType_BWART: '349', StockCharacteristic: 'QualityInspection' }
];

const sqlQuery = rows.map(row => 
  `SELECT '${row.Client_MANDT}' AS Client_MANDT, '${row.StockType_INSMK}' AS StockType_INSMK, '${row.Debit_CreditIndicator_SHKZG}' AS Debit_CreditIndicator_SHKZG, '${row.SpecialStockIndicator_SOBKZ}' AS SpecialStockIndicator_SOBKZ, '${row.MovementType_BWART}' AS MovementType_BWART, '${row.StockCharacteristic}' AS StockCharacteristic`
).join('\nUNION ALL\n');

publish("stock_characteristics_config", { ...publishConfig, name: "StockCharacteristicsConfig" }).query(
  (ctx) => sqlQuery
);
