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
  [
    "client_mandt",
    "controlling_area_kokrs"
  ]
);

publish("controlling_areas", publishConfig).query(
  (ctx) => `
SELECT
  tka01.mandt AS client_mandt,
  tka01.kokrs AS controlling_area_kokrs,
  tka01.bezei AS controlling_area_name_bezei,
  tka01.waers AS currency_code_waers,
  tka01.ktopl AS chart_of_accounts_ktopl,
  tka01.lmona AS fiscal_year_variant_lmona,
  tka01.kokfi AS cocd_to_co_area_kokfi,
  tka01.logsystem AS logical_system_logsystem,
  tka01.alemt AS distribution_method_alemt,
  tka01.md_logsystem AS logical_system_master_data_md_logsystem,
  tka01.khinr AS cost_center_std_hierarchy_khinr,
  tka01.komp1 AS convert_revenue_komp1,
  tka01.komp0 AS productive_indicator_komp0,
  tka01.komp2 AS reserve_komp2,
  tka01.erkrs AS operating_concern_erkrs,
  tka01.dprct AS dummy_profit_center_dprct,
  tka01.phinr AS hierarchy_area_phinr,
  tka01.pcldg AS profit_center_ledger_pcldg,
  tka01.pcbel AS elim_intern_bus_vol_pcbel,
  tka01.xwbuk AS diff_ccode_currency_xwbuk,
  tka01.bphinr AS hierarchy_area_bphinr,
  tka01.xbpale AS bus_proc_ale_active_xbpale,
  tka01.kstar_fin AS celem_vend_dwnpaymnt_kstar_fin,
  tka01.kstar_fid AS revtyp_cus_downpaymt_kstar_fid,
  tka01.pcacur AS profit_center_local_currency_pcacur,
  tka01.pcacurtp AS currency_type_for_profit_ctr_acctg_pcacurtp,
  tka01.pcatrcur AS transaction_currency_pcatrcur,
  tka01.ctyp AS currency_type_ctyp,
  tka01.rclac AS recon_ledger_active_rclac,
  tka01.blart AS document_type_blart,
  tka01.fikrs AS fm_area_fikrs,
  tka01.rcl_primac AS acct_determination_for_primary_celms_rcl_primac,
  tka01.pca_alemt AS ale_distribution_method_pca_alemt,
  tka01.pca_valu AS valuation_view_pca_valu,
  tka01.cvprof AS currency_and_valuation_profile_cvprof,
  tka01.cvact AS cv_profile_active_cvact,
  tka01.vname AS person_responsible_vname,
  tka01.pca_acc_diff AS account_control_transfer_valuation_diff_pca_acc_diff,
  tka01.tp_valohb AS valview_for_calcbase_tp_valohb,
  tka01.defprctr AS default_profit_ctr_defprctr,
  tka01.f_obsolete AS hide_entry_in_input_help_f_obsolete,
  tka01.auth_use_no_std AS do_not_use_std_hier_auth_use_no_std,
  tka01.auth_use_add1 AS hierarchy_1_auth_use_add1,
  tka01.auth_use_add2 AS hierarchy_2_auth_use_add2,
  tka01.auth_ke_no_std AS do_not_use_std_hier_auth_ke_no_std,
  tka01.auth_ke_use_add1 AS hierarchy_1_auth_ke_use_add1,
  tka01.auth_ke_use_add2 AS hierarchy_2_auth_ke_use_add2,
  IFNULL(tka01.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "tka01")} AS tka01
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["tka01"])
])}
`
);
