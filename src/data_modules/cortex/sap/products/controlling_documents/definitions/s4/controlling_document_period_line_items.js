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
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "controlling_area_kokrs",
    "document_number_belnr",
    "posting_row_buzei",
    "period_perio",
    "ledger_lednr",
    "object_number_objnr",
    "fiscal_year_gjahr",
    "version_versn",
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  coep.mandt AS client_mandt,
  coep.kokrs AS controlling_area_kokrs,
  coep.belnr AS document_number_belnr,
  coep.buzei AS posting_row_buzei,
  coep.perio AS period_perio,
  coep.lednr AS ledger_lednr,
  coep.objnr AS object_number_objnr,
  coep.gjahr AS fiscal_year_gjahr,
  coep.versn AS version_versn,
  coep.wtgbtr AS value_transaction_currency_wtgbtr,
  coep.wogbtr AS value_in_object_currency_wogbtr,
  coep.wkgbtr AS value_controlling_area_currency_wkgbtr,
  coep.wkfbtr AS fixvalue_controlling_area_currency_wkfbtr,
  coep.pagbtr AS price_variance_pagbtr,
  coep.pafbtr AS price_variance_fixed_pafbtr,
  coep.megbtr AS total_quantity_megbtr,
  coep.mefbtr AS fixed_quantity_mefbtr,
  coep.mbgbtr AS total_quantity_mbgbtr,
  coep.mbfbtr AS fix_quantity_entered_mbfbtr,
  coep.wrttp AS value_type_wrttp,
  coep.kstar AS cost_element_kstar,
  coep.hrkft AS controlling_subkey_hrkft,
  coep.vrgng AS business_transaction_vrgng,
  coep.parob AS partner_object_parob,
  coep.parob1 AS partner_object_parob1,
  coep.uspob AS source_object_uspob,
  coep.vbund AS trading_partner_number_vbund,
  coep.pargb AS trading_partner_business_area_pargb,
  coep.beknz AS debit_credit_indicator_beknz,
  coep.twaer AS transaction_currency_twaer,
  coep.owaer AS object_currency_owaer,
  coep.meinh AS unit_of_measure_meinh,
  coep.meinb AS posted_unit_of_measure_meinb,
  coep.mvflg AS quantity_complete_incomplete_mvflg,
  coep.sgtxt AS name_sgtxt,
  coep.refbz AS posting_row_refbz,
  coep.zlenr AS document_item_zlenr,
  coep.bw_refbz AS row_in_op_version_bw_refbz,
  coep.gkont AS offsetting_account_gkont,
  coep.gkoar AS offsetting_account_type_gkoar,
  coep.werks AS plant_werks,
  coep.matnr AS material_matnr,
  coep.rbest AS po_category_rbest,
  coep.ebeln AS purchasing_document_ebeln,
  coep.ebelp AS item_ebelp,
  coep.zekkn AS seq_no_of_account_assignment_zekkn,
  coep.erlkz AS completion_indicator_erlkz,
  coep.pernr AS personnel_number_pernr,
  coep.btrkl AS amount_class_btrkl,
  coep.objnr_n1 AS auxiliary_account_assignment_1_objnr_n1,
  coep.objnr_n2 AS auxiliary_account_assignment_2_objnr_n2,
  coep.objnr_n3 AS auxiliary_account_assignment_3_objnr_n3,
  coep.paobjnr AS profitability_segment_no_paobjnr,
  coep.beltp AS debit_credit_type_beltp,
  coep.bukrs AS company_code_bukrs,
  coep.gsber AS business_area_gsber,
  coep.fkber AS functional_area_fkber,
  coep.scope AS object_class_scope,
  coep.logsyso AS logical_system_logsyso,
  coep.pkstar AS partner_cost_element_pkstar,
  coep.pbukrs AS partner_company_code_pbukrs,
  coep.pfkber AS partner_functional_area_pfkber,
  coep.pscope AS partner_object_class_pscope,
  coep.logsysp AS logical_system_logsysp,
  coep.dabrz AS reference_date_dabrz,
  coep.bwstrat AS valuation_strategy_bwstrat,
  coep.objnr_hk AS origin_object_objnr_hk,
  coep.timestmp AS time_created_timestmp,
  coep.qmnum AS notification_qmnum,
  coep.geber AS fund_geber,
  coep.pgeber AS partner_fund_pgeber,
  coep.grant_nbr AS grant_grant_nbr,
  coep.pgrant_nbr AS partner_grant_pgrant_nbr,
  coep.refbz_fi AS fi_posting_item_refbz_fi,
  coep.segment AS segment,
  coep.psegment AS partner_segment_psegment,
  coep.posnr AS position_posnr,
  coep.prctr AS profit_center_prctr,
  coep.pprct AS partner_profit_center_pprct,
  coep.budget_pd AS budget_period_budget_pd,
  coep.pbudget_pd AS partner_budget_period_pbudget_pd,
  coep.prodper AS production_month_prodper,
  coep.awtyp AS reference_procedure_awtyp,
  coep.awkey AS object_key_awkey,
  coep.awsys AS logical_system_source_awsys,
  coep.kwaer AS controlling_area_currency_kwaer,
  coep.accas AS account_assignment_accas,
  coep.accasty AS object_type_accasty,
  coep.kostl AS cost_center_kostl,
  coep.lstar AS activity_type_lstar,
  coep.aufnr AS order_aufnr,
  coep.autyp AS order_category_autyp,
  coep.pspnr AS wbs_element_pspnr,
  coep.pspid AS project_definition_pspid,
  coep.vbeln AS sales_document_vbeln,
  coep.vbposnr AS sales_document_item_vbposnr,
  coep.ce4key AS key_ce4xxxx_ce4key,
  coep.erkrs AS operating_concern_erkrs,
  coep.paccas AS partner_account_assignment_paccas,
  coep.paccasty AS partner_object_type_paccasty,
  coep.pkostl AS partner_cost_center_pkostl,
  coep.plstar AS partner_activity_type_plstar,
  coep.paufnr AS partner_order_number_paufnr,
  coep.pautyp AS partner_order_category_pautyp,
  coep.ppspnr AS partner_wbs_element_ppspnr,
  coep.ppspid AS partner_project_definition_ppspid,
  coep.pvbeln AS partner_sales_order_number_pvbeln,
  coep.pvbposnr AS partner_sales_order_item_pvbposnr,
  coep.pce4key AS partner_key_ce4_pce4key,
  coep.quant1 AS additional_quantity_1_quant1,
  coep.quant2 AS additional_quantity_2_quant2,
  coep.quant3 AS additional_quantity_3_quant3,
  coep.qunit1 AS add_unit_of_measure1_qunit1,
  coep.qunit2 AS add_unit_of_measure2_qunit2,
  coep.qunit3 AS add_unit_of_measure3_qunit3,
  IFNULL(coep.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "coep")} AS coep
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["coep"])
])}
`
);
