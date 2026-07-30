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

publish("languages_t002", { ...publishConfig, name: "Languages_T002" }).query(
  (ctx) => `
SELECT
  T002.SPRAS AS LanguageKey_SPRAS,
  T002.LASPEZ AS LanguageSpecifications_LASPEZ,
  T002.LAHQ AS DegreeOfTranslationOfLanguage_LAHQ,
  T002.LAISO AS TwoCharacterSapLanguageCode_LAISO
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 't002')} AS T002
`
);
