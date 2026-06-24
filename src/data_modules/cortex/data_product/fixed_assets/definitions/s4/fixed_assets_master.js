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
  ["client_mandt", "company_code_bukrs", "asset_number_anln1", "asset_subnumber_anln2", "language_key_spras"]
);

publish('fixed_assets_master', publishConfig).query(
  (ctx) => `
SELECT
  anla.mandt AS client_mandt,
  anla.bukrs AS company_code_bukrs,
  anla.anln1 AS asset_number_anln1,
  anla.anln2 AS asset_subnumber_anln2,
  ankt.spras AS language_key_spras,
  anlh.luntn AS last_sno_assigned_luntn,
  anlh.lanep AS last_line_item_no__lanep,
  anlh.anupd AS change_type_of_asset_main_number_anupd,
  anlh.funtn AS first_sub_no_assignd_funtn,
  anlh.anlhtxt AS asset_main_no_text_anlhtxt,
  anla.anlkl AS asset_class_anlkl,
  ankt.txk20 AS short_text_txk20,
  ankt.txk50 AS description_txk50,
  ankt.txt50 AS asset_class_description_txt50,
  ankt.txa50 AS asset_class_description_txa50,
  ankt.xltxid AS long_text_exists_of_asset_class_xltxid,
  anla.gegst AS tech_asset_gegst,
  anla.anlar AS asset_type_anlar,
  anla.ernam AS created_by_ernam,
  anla.erdat AS created_on_erdat,
  anla.aenam AS changed_by_aenam,
  anla.aedat AS changed_on_aedat,
  anla.xloev AS mark_for_deletion_xloev,
  anla.xspeb AS locked_to_acquis__xspeb,
  anla.felei AS screen_layout_rule_felei,
  anla.ktogr AS acct_determination_ktogr,
  anla.xopvw AS line_item_settlement_xopvw,
  anla.anltp AS asset_category_anltp,
  anla.zujhr AS acquisition_year_zujhr,
  anla.zuper AS first_acquis_period_zuper,
  anla.zugdt AS first_acquisition_on_zugdt,
  anla.aktiv AS capitalized_on_aktiv,
  anla.abgdt AS last_retmt_on_abgdt,
  anla.deakt AS deactivation_on_deakt,
  anla.gplab AS plnd_retirement_on_gplab,
  anla.bstdt AS ordered_on_bstdt,
  anla.ord41 AS evaluation_group_1_ord41,
  anla.ord42 AS evaluation_group_2_ord42,
  anla.ord43 AS evaluation_group_3_ord43,
  anla.ord44 AS evaluation_group_4_ord44,
  anla.anlue AS asset_super_number_anlue,
  anla.zuawa AS sort_key_zuawa,
  anla.aneqk AS manage_historically_aneqk,
  anla.aneqs AS compl_ind__aneqs,
  anla.lifnr AS vendor_lifnr,
  anla.land1 AS country_of_origin_land1,
  anla.liefe AS supplier_name_liefe,
  anla.herst AS manufacturer_herst,
  anla.eigkz AS property_indicator_eigkz,
  anla.aibn1 AS original_asset_aibn1,
  anla.aibn2 AS asset_subnumber_auc_aibn2,
  anla.aibdt AS acq_orig_asset_on_aibdt,
  anla.urjhr AS org_acquisition_year_urjhr,
  anla.urwrt AS original_value_urwrt,
  anla.antei AS in_house_prod_perc__antei,
  anla.projn AS not_in_use_projn,
  anla.eaufn AS investment_order_eaufn,
  anla.meins AS base_unit_of_measure_meins,
  anla.menge AS quantity_menge,
  anla.typbz AS type_name_typbz,
  anla.izwek AS investment_reason_izwek,
  anla.inken AS include_asset_inken,
  anla.ivdat AS last_inventory_on_ivdat,
  anla.invzu AS inventory_note_invzu,
  anla.vmgli AS classification_key_vmgli,
  anla.xvrmw AS manual_net_worth_val_xvrmw,
  anla.wrtma AS man_net_wrth_val__wrtma,
  anla.ehwrt AS assessed_val_ehwrt,
  anla.aufla AS conveyance_on_aufla,
  anla.ehwzu AS notice_on_ehwzu,
  anla.ehwnr AS assmt_notice_tax_no__ehwnr,
  anla.gruvo AS land_register_of_gruvo,
  anla.grein AS entry_by_grein,
  anla.grbnd AS vol_page_ser_no_grbnd,
  anla.grblt AS land_register_page_grblt,
  anla.grlfd AS landregentry_seqno__grlfd,
  anla.flurk AS ld_reg_map_plot_flurk,
  anla.flurn AS plot_number_flurn,
  anla.fiamt AS tax_office_fiamt,
  anla.stadt AS municipality_stadt,
  anla.grund AS reason_for_man_val__grund,
  anla.feins AS area_unit_feins,
  anla.grufl AS area_grufl,
  anla.invnr AS inventory_number_invnr,
  anla.vbund AS trading_partner_vbund,
  anla.spras AS language_key_of_asset_master_spras,
  anla.txt50 AS description_of_asset_master_txt50,
  anla.txa50 AS additional_description_of_asset_master_txaa50,
  anla.xltxid AS long_text_exists_of_asset_master_xltxid,
  anla.xverid AS long_text_exists_xverid,
  anla.xtchid AS techn_view_long_text_xtchid,
  anla.xkalid AS longtxt_c_acc_view_xkalid,
  anla.xherid AS long_text_exists_xherid,
  anla.xleaid AS long_text_exists_xleaid,
  anla.leafi AS leasing_company_leafi,
  anla.lvdat AS agreement_date_lvdat,
  anla.lkdat AS notice_date_lkdat,
  anla.leabg AS lease_start_date_leabg,
  anla.lejar AS lease_length_lejar,
  anla.leper AS lease_in_periods_leper,
  anla.lryth AS payment_cycle_lryth,
  anla.legeb AS lease_payment_legeb,
  anla.lbasw AS base_value_as_new_lbasw,
  anla.lkauf AS purchase_price_lkauf,
  anla.lmzin AS monthly_int_rate_lmzin,
  anla.lzins AS annual_interest_rate_lzins,
  anla.ltzbw AS last_posting_date_ltzbw,
  anla.lkuza AS posted_payments_lkuza,
  anla.lkuzi AS interest_posted_lkuzi,
  anla.llavb AS long_term_liability_llavb,
  anla.leanz AS no_lease_payments_leanz,
  anla.lvtnr AS agreement_number_lvtnr,
  anla.letxt AS supplementary_text_letxt,
  anla.xaktiv AS capitalize_fixed_asset_xaktiv,
  anla.anupd AS change_type_of_asset_master_anupd,
  anla.lblnr AS last_document_number_lblnr,
  anla.xv0dt AS maintain_date_view0_xv0dt,
  anla.xv0nm AS view0_changed_by_xv0nm,
  anla.xv1dt AS maintain_date_v1_xv1dt,
  anla.xv1nm AS v1_changed_by_xv1nm,
  anla.xv2dt AS maintain_date_v2_xv2dt,
  anla.xv2nm AS view2_changed_by_xv2nm,
  anla.xv3dt AS maintain_date_v3_xv3dt,
  anla.xv3nm AS view3_changed_by_xv3nm,
  anla.xv4dt AS maintain_date_view4_xv4dt,
  anla.xv4nm AS view4_changed_by_xv4nm,
  anla.xv5dt AS maintain_date_v5_xv5dt,
  anla.xv5nm AS view5_changed_by_xv5nm,
  anla.xv6dt AS maintain_date_v6_xv6dt,
  anla.xv6nm AS view6_changed_by_xv6nm,
  anla.aimmo AS connection_to_sap_real_estate_managment_aimmo,
  anla.objnr AS object_number_objnr,
  anla.leart AS type_leart,
  anla.lvors AS advance_payments_lvors,
  anla.gdlgrp AS evaluation_group_5_gdlgrp,
  anla.posnr AS wbs_element_posnr,
  anla.xerwrt AS do_not_take_memo_value_into_account_xerwrt,
  anla.xafabch AS purchased_used_xafabch,
  anla.xanlgr AS group_asset_xanlgr,
  anla.mcoa1 AS description_mcoa1,
  anla.xinvm AS investment_measure_xinvm,
  anla.sernr AS serial_number_sernr,
  anla.umwkz AS envir_investment_umwkz,
  anla.lrvdat AS last_reval_on_lrvdat,
  anla.act_change_pm AS change_asset_master_record_from_equipmen_act_change_pm,
  anla.has_tddp AS time_dependent_parameters_exist_has_tddp,
  anla.last_reorg_date AS reorganization_date_last_reorg_date,
  anla.internal_code AS internal_code,
  anla.approval_number AS approval_document_number_approval_number,
  anla.approval_version AS approval_version,
  anla.bogus_anln1 AS investment_asset_number_bogus_anln1,
  anla.asset_version AS asset_version,
  t095t.ktgrtx AS account_determination_description_ktgrtx,
  t098t.grdtx AS reason_for_manual_valuation_description_grdtx,
  GREATEST(
    IFNULL(anla.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(anlh.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(ankt.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t095t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t098t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anla")} AS anla
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "anlh")} AS anlh
  ON anla.mandt = anlh.mandt AND anla.bukrs = anlh.bukrs AND anla.anln1 = anlh.anln1
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "ankt")} AS ankt
  ON anla.mandt = ankt.mandt AND anla.anlkl = ankt.anlkl
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t095t")} AS t095t
  ON anla.mandt = t095t.mandt AND anla.ktogr = t095t.ktogr AND ankt.spras = t095t.spras
LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t098t")} AS t098t
  ON anla.mandt = t098t.mandt AND anla.grund = t098t.grund AND ankt.spras = t098t.spras
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["anla", "anlh", "ankt", "t095t", "t098t"])
])}
`
);
