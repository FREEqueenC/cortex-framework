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
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "purchasing_document_ebeln",
    "item_ebelp",
    "sequence_number_of_account_assignment_zekkn"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
WITH currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  ekkn.mandt AS client_mandt,
  ekkn.ebeln AS purchasing_document_ebeln,
  ekkn.ebelp AS item_ebelp,
  ekkn.zekkn AS sequence_number_of_account_assignment_zekkn,
  ekkn.loekz AS deletion_indicator_loekz,
  ekkn.aedat AS created_on_aedat,
  ekkn.menge AS quantity_menge,
  ekkn.vproz AS distribution_vproz,
  ${currency.amountWithDecimalShift("ekkn.netwr", "currency_decimal_waers")} AS net_order_value_netwr,
  ekkn.sakto AS general_ledger_account_sakto,
  ekkn.gsber AS business_area_gsber,
  ekkn.kostl AS cost_center_kostl,
  ekkn.vbeln AS sales_document_vbeln,
  ekkn.vbelp AS sales_document_item_vbelp,
  ekkn.veten AS schedule_line_number_veten,
  ekkn.kzbrb AS gross_requirements_ind_kzbrb,
  ekkn.anln1 AS asset_anln1,
  ekkn.anln2 AS sub_number_anln2,
  ekkn.aufnr AS order_aufnr,
  ekkn.wempf AS goods_recipient_wempf,
  ekkn.ablad AS unloading_point_ablad,
  ekkn.kokrs AS controlling_area_kokrs,
  ekkn.xbkst AS posting_to_cost_center_xbkst,
  ekkn.xbauf AS post_to_order_xbauf,
  ekkn.xbpro AS post_to_project_xbpro,
  ekkn.erekz AS final_invoice_erekz,
  ekkn.kstrg AS cost_object_kstrg,
  ekkn.paobjnr AS profitability_segment_number_paobjnr,
  ekkn.prctr AS profit_center_prctr,
  ekkn.ps_psp_pnr AS wbs_element_ps_psp_pnr,
  ekkn.nplnr AS network_nplnr,
  ekkn.aufpl AS opertn_task_list_number_aufpl,
  ekkn.imkey AS real_estate_key_imkey,
  ekkn.aplzl AS counter_aplzl,
  ekkn.vptnr AS partner_vptnr,
  ekkn.fipos AS commitment_item_fipos,
  ekkn.recid AS recovery_indicator_recid,
  ekkn.fistl AS funds_center_fistl,
  ekkn.geber AS fund_geber,
  ekkn.fkber AS functional_area_fkber,
  ekkn.dabrz AS reference_date_dabrz,
  ekkn.aufpl_ord AS operation_task_list_number_aufpl_ord,
  ekkn.aplzl_ord AS counter_aplzl_ord,
  ekkn.mwskz AS tax_code_mwskz,
  ekkn.txjcd AS tax_jurisdiction_txjcd,
  ${currency.amountWithDecimalShift("ekkn.navnw", "currency_decimal_waers")} AS non_deductible_navnw,
  ekkn.kblnr AS earmarked_funds_kblnr,
  ekkn.kblpos AS document_item_kblpos,
  ekkn.lstar AS activity_type_lstar,
  ekkn.prznr AS business_process_prznr,
  ekkn.grant_nbr AS grant_grant_nbr,
  ekkn.budget_pd AS budget_period_budget_pd,
  ekkn.fm_split_batch AS distribution_batch_number_fm_split_batch,
  ekkn.fm_split_begru AS authorization_group_fm_split_begru,
  ekkn.aa_final_ind AS final_account_assignment_aa_final_ind,
  ekkn.aa_final_reason AS final_account_assignment_reason_aa_final_reason,
  ekkn.aa_final_qty AS final_account_assignment_quantity_aa_final_qty,
  ekkn.aa_final_qty_f AS final_account_assignment_quantity_float_number_aa_final_quantity_f,
  ekkn.menge_f AS quantity_float_number_menge_f,
  ekkn.fmfgus_key AS us_government_fields_fmfgus_key,
  ekkn.egrup AS equity_group_egrup,
  ekkn.vname AS joint_venture_vname,
  ekkn.tcobjnr AS object_number_tcobjnr,
  ekkn.dateofservice AS date_of_service_dateofservice,
  ekkn.notaxcorr AS do_not_correct_notaxcorr,
  ekkn.diffoptrate AS option_rate_diffoptrate,
  ekkn.hasdiffoptrate AS use_diff_option_rate_hasdiffoptrate,
  GREATEST(
    IFNULL(ekkn.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(ekko.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ekkn")} AS ekkn
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ekko")} AS ekko
  ON
    ekkn.mandt = ekko.mandt
    AND ekkn.ebeln = ekko.ebeln
LEFT JOIN currency_decimal AS currency_decimal_waers
  ON ekko.waers = currency_decimal_waers.currkey
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["ekkn", "ekko"])
])}
`
);
