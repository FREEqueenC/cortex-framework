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

const materializationType = tableConfig.materializationType || "view";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  []
);

publish("slow_moving_threshold", { ...publishConfig, name: "SlowMovingThreshold" }).query(
  (ctx) => `
SELECT DISTINCT
  mandt AS Client_MANDT,
  mtart AS MaterialType_MTART,
  CASE
    WHEN mara.mtart = 'FERT' THEN 50
    WHEN mara.mtart = 'ROH' THEN 60
    WHEN mara.mtart = 'HIBE' THEN 60
    WHEN mara.mtart = 'HALB' THEN 60
    ELSE 0
  END AS ThresholdValue
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'mara')} AS mara
`
);
