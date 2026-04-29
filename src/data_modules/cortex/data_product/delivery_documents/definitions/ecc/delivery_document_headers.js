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

const currency = require("includes/cortex/currency.js");
const date = require("includes/cortex/date.js");
const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "document_number_vbeln"
  ]
);

publish("delivery_document_headers", publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  likp.mandt AS client_mandt,
  likp.vbeln AS document_number_vbeln,
  likp.ernam AS created_by_ernam,
  likp.erzet AS creation_time_erzet,
  likp.erdat AS creation_date_erdat,
  likp.bzirk AS sales_district_bzirk,
  likp.vstel AS shipping_point_receiving_point_vstel,
  likp.vkorg AS sales_organization_vkorg,
  likp.lfart AS delivery_type_lfart,
  likp.autlf AS complete_delivery_defined_indicator_autlf,
  likp.kzazu AS order_combination_indicator_kzazu,
  likp.wadat AS planned_goods_movement_date_wadat,
  likp.lddat AS loading_date_lddat,
  likp.tddat AS transportation_planning_date_tddat,
  likp.lfdat AS delivery_date_lfdat,
  likp.kodat AS picking_date_kodat,
  likp.ablad AS unloading_point_ablad,
  likp.inco1 AS incoterms_part1_inco1,
  likp.inco2 AS incoterms_part2_inco2,
  likp.expkz AS export_indicator_expkz,
  likp.route AS route_route,
  likp.faksk AS billing_block_in_sales_document_faksk,
  likp.lifsk AS delivery_block_document_header_lifsk,
  likp.vbtyp AS sales_document_category_vbtyp,
  likp.knfak AS customer_factory_calendar_knfak,
  likp.lprio AS delivery_priority_lprio,
  likp.vsbed AS shipping_conditions_vsbed,
  likp.kunnr AS ship_to_party_kunnr,
  likp.kunag AS sold_to_party_kunag,
  likp.kdgrp AS customer_group_kdgrp,
  likp.btgew AS total_weight_btgew,
  likp.ntgew AS net_weight_ntgew,
  likp.gewei AS weight_unit_gewei,
  likp.volum AS volume_volum,
  likp.voleh AS volume_unit_voleh,
  likp.anzpk AS total_packages_anzpk,
  likp.berot AS picked_items_location_berot,
  likp.lfuhr AS delivery_time_lfuhr,
  likp.grulg AS weight_group_grulg,
  likp.lstel AS loading_point_lstel,
  likp.tragr AS transportation_group_tragr,
  likp.fkarv AS proposed_billing_type_fkarv,
  likp.fkdat AS proposed_billing_date_fkdat,
  likp.perfk AS invoice_dates_perfk,
  likp.routa AS route_routa,
  likp.stafo AS update_group_for_statistics_stafo,
  likp.kalsm AS procedure_kalsm,
  likp.knumv AS condition_number_knumv,
  likp.waerk AS sales_document_currency_waerk,
  likp.vkbur AS sales_office_vkbur,
  likp.vbeak AS shipping_processing_time_vbeak,
  likp.zukrl AS delivery_combination_criteria_zukrl,
  likp.verur AS distribution_delivery_verur,
  likp.commn AS communication_number_commn,
  likp.stwae AS statistics_currency_stwae,
  likp.stcur AS statistics_exchange_rate_stcur,
  likp.exnum AS foreign_trade_data_number_exnum,
  likp.aenam AS changed_by_aenam,
  likp.aedat AS changed_on_aedat,
  likp.lgnum AS warehouse_number_lgnum,
  likp.lispl AS delivery_within_one_warehouse_lispl,
  likp.vkoiv AS intercompany_billing_sales_organization_vkoiv,
  likp.vtwiv AS intercompany_billing_distribution_channel_vtwiv,
  likp.spaiv AS intercompany_billing_division_spaiv,
  likp.fkaiv AS intercompany_billing_type_fkaiv,
  likp.pioiv AS intercompany_billing_price_date_pioiv,
  likp.fkdiv AS intercompany_billing_date_fkdiv,
  likp.kuniv AS intercompany_billing_customer_number_kuniv,
  likp.kkber AS credit_control_area_kkber,
  likp.knkli AS credit_account_knkli,
  likp.grupp AS customer_credit_group_grupp,
  likp.sbgrp AS credit_representative_group_sbgrp,
  likp.ctlpc AS credit_management_risk_category_ctlpc,
  likp.cmwae AS credit_control_area_currency_key_cmwae,
  likp.amtbl AS released_credit_value_amtbl,
  likp.bolnr AS bill_of_lading_bolnr,
  likp.lifnr AS vendor_account_number_lifnr,
  likp.traty AS means_of_transport_type_traty,
  likp.traid AS means_of_transport_id_traid,
  likp.cmfre AS credit_release_date_cmfre,
  likp.cmngv AS next_date_cmngv,
  likp.xabln AS goods_receipt_issue_slip_number_xabln,
  likp.bldat AS document_date_bldat,
  likp.wadat_ist AS actual_goods_movement_date_wadat_ist,
  likp.trspg AS shipment_blocking_reason_trspg,
  likp.tpsid AS external_transport_system_id_tpsid,
  likp.lifex AS external_delivery_note_id_lifex,
  likp.ternr AS order_number_ternr,
  likp.kalsm_ch AS batch_search_procedure_kalsm_ch,
  likp.klief AS correction_delivery_klief,
  likp.kalsp AS shipping_pricing_procedure_kalsp,
  likp.knump AS pricing_condition_number_knump,
  ${currency.amountWithDecimalShift("likp.netwr", "currency_decimal")} AS net_value_in_document_currency_netwr,
  likp.aulwe AS route_schedule_aulwe,
  likp.werks AS receiving_plant_werks,
  likp.lcnum AS internal_financial_document_number_lcnum,
  likp.abssc AS payment_guarantee_procedure_abssc,
  likp.kouhr AS picking_time_kouhr,
  likp.tduhr AS transportation_planning_time_tduhr,
  likp.lduhr AS loading_time_lduhr,
  likp.wauhr AS goods_issue_time_wauhr,
  likp.lgtor AS warehouse_door_number_lgtor,
  likp.lgbzo AS warehouse_staging_area_lgbzo,
  likp.akwae AS foreign_trade_currency_key_akwae,
  likp.akkur AS foreign_trade_exchange_rate_akkur,
  likp.akprz AS depreciation_percentage_akprz,
  likp.proli AS dangerous_goods_management_profile_proli,
  likp.xblnr AS reference_document_number_xblnr,
  likp.handle AS worldwide_unique_key_handle,
  likp.tsegfl AS time_segment_exists_indicator_tsegfl,
  likp.tsegtp AS event_group_time_segment_delivery_header_tsegtp,
  likp.tzonis AS delivery_location_timezone_tzonis,
  likp.tzonrc AS recipient_location_timezone_tzonrc,
  likp.cont_dg AS dangerous_goods_indicator_cont_dg,
  likp.verursys AS distribution_delivery_original_system_verursys,
  likp.kzwab AS goods_movement_control_indicator_kzwab,
  likp.vlstk AS distribution_status_vlstk,
  likp.tcode AS transaction_code_tcode,
  likp.vsart AS shipping_type_vsart,
  likp.trmtyp AS means_of_transport_trmtyp,
  likp.sdabw AS special_processing_indicator_sdabw,
  likp.vbund AS company_id_vbund,
  likp.xwoff AS calculation_of_value_open_indicator_xwoff,
  likp.dirta AS automatic_transportation_order_creation_indicator_dirta,
  likp.prvbe AS production_supply_area_prvbe,
  likp.folar AS delivery_type_folar,
  likp.podat AS proof_of_delivery_date_podat,
  likp.potim AS proof_of_delivery_confirmation_time_potim,
  likp.vganz AS shipment_document_total_count_vganz,
  likp.imwrk AS goods_movement_within_company_code_indicator_imwrk,
  likp.spe_loekz AS document_deletion_indicator_spe_loekz,
  likp.spe_loc_seq AS location_sequence_number_spe_loc_seq,
  likp.spe_acc_app_sts AS delivery_confirmation_status_spe_acc_app_sts,
  likp.spe_shp_inf_sts AS shipment_information_status_spe_shp_inf_sts,
  likp.spe_ret_canc AS return_document_cancellation_indicator_spe_ret_canc,
  likp.spe_wauhr_ist AS goods_issue_time_spe_wauhr_ist,
  likp.spe_wazone_ist AS goods_issue_time_zone_spe_wazone_ist,
  likp.spe_rev_vlstk AS revenue_recognition_status_spe_rev_vlstk,
  likp.spe_le_scenario AS logistics_execution_scenario_spe_le_scenario,
  likp.spe_orig_sys AS original_system_type_spe_orig_sys,
  likp.spe_chng_sys AS last_changer_system_type_spe_chng_sys,
  likp.spe_georoute AS geographical_route_description_spe_georoute,
  likp.spe_georouteind AS route_change_indicator_spe_georouteind,
  likp.spe_carrier_ind AS carrier_change_indicator_spe_carrier_ind,
  likp.spe_gts_rel AS goods_traffic_type_spe_gts_rel,
  likp.spe_gts_rt_cde AS sap_global_trade_services_route_code_spe_gts_rt_cde,
  likp.spe_rel_tmstmp AS release_time_stamp_spe_rel_tmstmp,
  likp.spe_unit_system AS measurement_unit_system_spe_unit_system,
  likp.spe_inv_bfr_gi AS invoice_creation_before_goods_issue_spe_inv_bfr_gi,
  likp.spe_qi_status AS return_delivery_quality_inspection_status_spe_qi_status,
  likp.spe_red_ind AS redirection_indicator_spe_red_ind,
  likp.sakes AS sap_global_trade_services_delivery_storage_status_sakes,
  likp.spe_lifex_type AS external_identification_type_spe_lifex_type,
  likp.spe_ttype AS means_of_transport_spe_ttype,
  likp.spe_pro_number AS progressive_identification_number_spe_pro_number,
  likp.loc_guid AS location_guid_loc_guid,
  likp.spe_billing_ind AS ewm_billing_indicator_spe_billing_ind,
  likp.printer_profile AS printer_profile_description_printer_profile,
  likp.msr_active AS advanced_returns_management_active_indicator_msr_active,
  likp.prtnr AS confirmation_number_prtnr,
  likp.stge_loc_change AS storage_location_change_stge_loc_change,
  likp.tm_ctrl_key AS document_transfer_control_key_tm_ctrl_key,
  likp.dlv_split_initia AS delivery_split_initiator_dlv_split_initia,
  likp.dlv_version AS delivery_version_dlv_version,
  likp.handoverloc AS handover_location_handoverloc,
  likp.handoverdate AS handover_date_handoverdate,
  likp.handovertime AS handover_time_handovertime,
  likp.bev1_luleinh AS loading_unit_of_measure_bev1_luleinh,
  likp.bev1_rpfaess AS number_category_1_rpfaess,
  likp.bev1_rpkist AS number_category_2_rpkist,
  likp.bev1_rpcont AS number_category_3_rpcont,
  likp.bev1_rpsonst AS number_category_4_rpsonst,
  likp.bev1_rpflgnr AS loading_sequence_number_rpflgnr,
  likp.borgr_grp AS multi_level_goods_receipt_automotive_borgr_grp,
  dimensional_date_lfdat.cal_year AS year_of_delivery_date_lfdat,
  dimensional_date_lfdat.cal_month AS month_of_delivery_date_lfdat,
  dimensional_date_lfdat.cal_quarter AS quarter_of_delivery_date_lfdat,
  dimensional_date_lfdat.cal_week AS week_of_delivery_date_lfdat,
  dimensional_date_podat.cal_year AS year_of_proof_of_delivery_date_podat,
  dimensional_date_podat.cal_month AS month_of_proof_of_delivery_date_podat,
  dimensional_date_podat.cal_quarter AS quarter_of_proof_of_delivery_date_podat,
  dimensional_date_podat.cal_week AS week_of_proof_of_delivery_date_podat,
  dimensional_date_bldat.cal_year AS year_of_document_date_bldat,
  dimensional_date_bldat.cal_month AS month_of_document_date_bldat,
  dimensional_date_bldat.cal_quarter AS quarter_of_document_date_bldat,
  dimensional_date_bldat.cal_week AS week_of_document_date_bldat,
  IFNULL(
    likp.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at    
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "likp")} AS likp
LEFT JOIN currency_decimal
  ON likp.waerk = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_lfdat
  ON likp.lfdat = dimensional_date_lfdat.date
LEFT JOIN date_dimension AS dimensional_date_podat
  ON likp.podat = dimensional_date_podat.date
LEFT JOIN date_dimension AS dimensional_date_bldat
  ON likp.bldat = dimensional_date_bldat.date
${incremental.getWhere(ctx, "likp.recordstamp")}
`,
);