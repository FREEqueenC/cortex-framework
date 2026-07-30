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
const currency = require("includes/currency.js");
const date = require("includes/date.js");
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "order_number_aufnr"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  aufk.mandt AS client_mandt,
  aufk.aufnr AS order_number_aufnr,
  aufk.auart AS order_type_auart,
  aufk.autyp AS order_category_autyp,
  aufk.refnr AS reference_order_refnr,
  aufk.ernam AS entered_by_ernam,
  aufk.erdat AS created_on_erdat,
  dimensional_date_erdat.cal_year AS year_of_created_on_erdat,
  dimensional_date_erdat.cal_month AS month_of_created_on_erdat,
  dimensional_date_erdat.cal_quarter AS quarter_of_created_on_erdat,
  dimensional_date_erdat.cal_week AS week_of_created_on_erdat,
  aufk.aenam AS last_changed_by_aenam,
  aufk.aedat AS change_date_aedat,
  aufk.ktext AS description_ktext,
  aufk.ltext AS long_text_exists_ltext,
  aufk.bukrs AS company_code_bukrs,
  aufk.werks AS plant_werks,
  aufk.gsber AS business_area_gsber,
  aufk.kokrs AS controlling_area_kokrs,
  aufk.cckey AS cost_collector_key_cckey,
  aufk.kostv AS responsible_cost_center_kostv,
  aufk.stort AS location_plant_stort,
  aufk.sowrk AS location_plant_sowrk,
  aufk.astkz AS statistical_order_astkz,
  aufk.waers AS currency_key_waers,
  aufk.astnr AS order_status_astnr,
  aufk.stdat AS status_change_stdat,
  aufk.estnr AS reached_status_estnr,
  aufk.phas0 AS created_phas0,
  aufk.phas1 AS released_phas1,
  aufk.phas2 AS completed_phas2,
  aufk.phas3 AS closed_phas3,
  aufk.pdat1 AS planned_release_pdat1,
  aufk.pdat2 AS planned_completion_pdat2,
  aufk.pdat3 AS planned_closing_date_pdat3,
  aufk.idat1 AS release_date_idat1,
  aufk.idat2 AS technical_completion_idat2,
  aufk.idat3 AS close_idat3,
  aufk.objid AS object_id_objid,
  aufk.vogrp AS disallowed_trans_grp_vogrp,
  aufk.loekz AS deletion_flag_loekz,
  aufk.plgkz AS plan_line_items_plgkz,
  aufk.kvewe AS usage_kvewe,
  aufk.kappl AS application_kappl,
  aufk.kalsm AS costing_sheet_kalsm,
  aufk.zschl AS overhead_key_zschl,
  aufk.abkrs AS processing_group_abkrs,
  aufk.kstar AS settlement_cost_elem_kstar,
  aufk.kostl AS cost_center_kostl,
  aufk.saknr AS gl_account_saknr,
  aufk.setnm AS allocation_set_setnm,
  aufk.cycle AS cost_center_true_postings_cycle,
  aufk.sdate AS start_date_sdate,
  aufk.seqnr AS sequence_number_seqnr,
  aufk.user0 AS applicant_user0,
  aufk.user1 AS telephone_user1,
  aufk.user2 AS person_responsible_user2,
  aufk.user3 AS telephone_user3,
  ${currency.amountWithDecimalShift("aufk.user4", "currency_decimal_waers")} AS estimated_costs_user4,
  aufk.user5 AS application_date_user5,
  aufk.user6 AS department_user6,
  aufk.user7 AS work_start_user7,
  aufk.user8 AS end_of_work_user8,
  aufk.user9 AS work_approval_user9,
  aufk.objnr AS object_number_objnr,
  aufk.prctr AS profit_center_prctr,
  aufk.pspel AS wbs_element_pspel,
  aufk.awsls AS variance_key_awsls,
  aufk.abgsl AS results_analysis_key_abgsl,
  aufk.txjcd AS tax_jurisdiction_txjcd,
  aufk.func_area AS functional_area_func_area,
  aufk.scope AS object_class_scope,
  aufk.plint AS integrated_planning_plint,
  aufk.kdauf AS sales_order_kdauf,
  aufk.kdpos AS sales_order_item_kdpos,
  aufk.aufex AS external_order_no_aufex,
  aufk.ivpro AS investment_profile_ivpro,
  aufk.logsystem AS logical_system_logsystem,
  aufk.flg_mltps AS multiple_items_flg_mltps,
  aufk.abukr AS requesting_co_code_abukr,
  aufk.akstl AS request_cost_center_akstl,
  aufk.sizecl AS scale_sizecl,
  aufk.izwek AS investment_reason_izwek,
  aufk.umwkz AS envir_investment_umwkz,
  aufk.kstempf AS cost_collector_kstempf,
  aufk.zschm AS interest_profile_zschm,
  aufk.pkosa AS cost_collector_pkosa,
  aufk.anfaufnr AS requesting_order_anfaufnr,
  aufk.procnr AS production_process_no_procnr,
  aufk.proty AS process_category_proty,
  aufk.rsord AS refurbishment_order_rsord,
  aufk.bemot AS accounting_indicator_bemot,
  aufk.adrnra AS address_number_adrnra,
  aufk.erfzeit AS time_created_erfzeit,
  aufk.aezeit AS changed_at_aezeit,
  aufk.cstg_vrnt AS costing_variant_cstg_vrnt,
  aufk.costestnr AS cost_estimate_number_costestnr,
  aufk.veraa_user AS person_responsible_veraa_user,
  aufk.vname AS joint_venture_vname,
  aufk.recid AS recovery_indicator_recid,
  aufk.etype AS equity_type_etype,
  aufk.otype AS joint_venture_object_type_otype,
  aufk.jv_jibcl AS jib_jibe_class_jv_jibcl,
  aufk.jv_jibsa AS jib_jibe_subclass_a_jv_jibsa,
  aufk.jv_oco AS orig_cost_object_jv_oco,
  aufk.vaplz AS main_work_center_vaplz,
  aufk.wawrk AS plant_for_workcenter_wawrk,
  aufk.ferc_ind AS regulatory_indicator_ferc_ind,
  aufk.claim_control AS claim_creation_control_indicator_claim_control,
  aufk.update_needed AS claim_inconsistent_with_order_update_needed,
  aufk.update_control AS claim_update_trigger_update_control,
  IFNULL(
    aufk.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "aufk")} AS aufk
LEFT JOIN currency_decimal AS currency_decimal_waers
  ON aufk.waers = currency_decimal_waers.currkey
LEFT JOIN date_dimension AS dimensional_date_erdat
  ON aufk.erdat = dimensional_date_erdat.date
${sql_helper.buildDynamicWhere([
    incremental.getFilter(ctx, ["aufk"])
  ])}
`
);
