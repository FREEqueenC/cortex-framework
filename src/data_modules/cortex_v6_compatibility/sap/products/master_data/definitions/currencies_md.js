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

publish("currencies_md", { ...publishConfig, name: "CurrenciesMD" }).query(
  (ctx) => `
SELECT
  tcurc.mandt AS Client_MANDT, tcurc.waers AS CurrencyCode_WAERS, tcurc.isocd AS CurrencyISO_ISOCD,
  tcurx.currdec AS CurrencyDecimals_CURRDEC, tcurt.spras AS Language,
  tcurt.ktext AS CurrShortText_KTEXT, tcurt.ltext AS CurrLongText_LTEXT
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tcurc')} AS tcurc
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tcurx')} AS tcurx ON tcurc.waers = tcurx.currkey
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'tcurt')}AS tcurt
  ON tcurc.waers = tcurt.waers AND tcurc.mandt = tcurt.mandt
`
);
