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
const materializationType = tableConfig.materializationType || "incremental";
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  ["client_mandt", "company_code_bukrs", "asset_number_anln1", "asset_subnumber_anln2", "valid_to_bdatu"]
);

publish('time_dependent_asset_allocations', publishConfig).query(
  (ctx) => `
SELECT
  anlz.mandt AS client_mandt,
  anlz.bukrs AS company_code_bukrs,
  anlz.anln1 AS asset_number_anln1,
  anlz.anln2 AS asset_subnumber_anln2,
  anlz.bdatu AS valid_to_bdatu,
  anlz.adatu AS valid_from_adatu,
  anlz.kostl AS cost_center_kostl,
  anlz.werks AS plant_werks,
  anlz.gsber AS business_area_gsber,
  anlz.lstar AS activity_type_lstar,
  anlz.msfak AS shift_factor_msfak,
  anlz.xstil AS asset_shutdown_xstil,
  anlz.stort AS location_stort,
  anlz.caufn AS internal_order_caufn,
  anlz.raumn AS room_raumn,
  anlz.iaufn AS maintenance_order_iaufn,
  anlz.tplnr AS functional_location_tplnr,
  anlz.anupd AS change_type_anupd,
  anlz.txjcd AS tax_jurisdiction_txjcd,
  anlz.ipsnr AS wbs_element_maint_ipsnr,
  anlz.kfzkz AS license_plate_number_kfzkz,
  anlz.pernr AS personnel_number_pernr,
  anlz.kostlv AS resp_cost_center_kostlv,
  anlz.fistl AS funds_center_fistl,
  anlz.geber AS fund_geber,
  anlz.fkber AS functional_area_fkber,
  anlz.grant_nbr AS grant_grant_nbr,
  anlz.geber2 AS fund_geber2,
  anlz.fkber2 AS functional_area_fkber2,
  anlz.grant_nbr2 AS grant_grant_nbr2,
  anlz.fistl2 AS funds_center_fistl2,
  anlz.imkey AS real_estate_key_imkey,
  anlz.ps_psp_pnr2 AS wbs_element_costs_ps_psp_pnr2,
  anlz.budget_pd AS budget_period_budget_pd,
  anlz.budget_pd2 AS budget_period_budget_pd2,
  anlz.segment AS segment_segment,
  anlz.prctr AS profit_center_prctr,
  anlz.recordstamp AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anlz")} AS anlz
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anlz"])
])}
`
);
