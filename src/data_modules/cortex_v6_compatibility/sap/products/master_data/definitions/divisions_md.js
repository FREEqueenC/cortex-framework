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

publish("divisions_md", { ...publishConfig, name: "DivisionsMD" }).query(
  (ctx) => `
SELECT
  TSPA.mandt AS Client_MANDT,
  TSPA.spart AS Division_SPART,
  TSPAT.spras AS LanguageKey_SPRAS,
  TSPAT.vtext AS DivisionName_VTEXT
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tspa')} AS TSPA
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tspat')} AS TSPAT
  ON
    TSPA.MANDT = TSPAT.MANDT
    AND TSPA.SPART = TSPAT.SPART
`
);
