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

publish("delivery_fact", { ...publishConfig, name: "DeliveryFact" }).query(
  (ctx) => `
(SELECT
  LIPS.*,
  LIKP.* EXCEPT(Client_MANDT, Delivery_VBELN),
  
  -- Sold-To Party Dimensions
  SoldToParty.Name1_NAME1 AS SoldToPartyName,
  SoldToParty.City_ORT01 AS SoldToPartyCity,
  SoldToParty.CountryKey_LAND1 AS SoldToPartyCountry,
  
  -- Ship-To Party Dimensions
  ShipToParty.Name1_NAME1 AS ShipToPartyName,
  ShipToParty.City_ORT01 AS ShipToPartyCity,
  ShipToParty.CountryKey_LAND1 AS ShipToPartyCountry,
  
  -- Material Dimensions
  MaterialsMD.MaterialText_MAKTX AS MaterialDescription,
  MaterialsMD.MaterialType_MTART AS MaterialType,
  MaterialsMD.MaterialCategory_ATTYP AS ProductCategory,
  MaterialsMD.Brand_BRAND_ID AS Brand,
  MaterialsMD.MaterialGroup_MATKL AS MaterialGroup,
  
  -- Plant Dimensions
  PlantsMD.Name_NAME1 AS PlantName,
  PlantsMD.City_ORT01 AS PlantCity,
  PlantsMD.CountryKey_LAND1 AS PlantCountry
  
FROM ${ctx.ref('DeliveryLineItems')} AS LIPS
INNER JOIN ${ctx.ref('DeliveryHeaders')} AS LIKP
  ON LIPS.Delivery_VBELN = LIKP.Delivery_VBELN
  AND LIPS.Client_MANDT = LIKP.Client_MANDT
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CustomersMD')} AS SoldToParty
  ON LIKP.SoldToParty_KUNAG = SoldToParty.CustomerNumber_KUNNR
  AND LIKP.Client_MANDT = SoldToParty.Client_MANDT
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'CustomersMD')} AS ShipToParty
  ON LIKP.ShipToParty_KUNNR = ShipToParty.CustomerNumber_KUNNR
  AND LIKP.Client_MANDT = ShipToParty.Client_MANDT
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'MaterialsMD')} AS MaterialsMD
  ON LIPS.MaterialNumber_MATNR = MaterialsMD.MaterialNumber_MATNR
  AND LIPS.Client_MANDT = MaterialsMD.Client_MANDT
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapMasterData.datasetId, 'PlantsMD')} AS PlantsMD
  ON LIPS.Plant_WERKS = PlantsMD.Plant_WERKS
  AND LIPS.Client_MANDT = PlantsMD.Client_MANDT)
`
);
