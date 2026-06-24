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
const sql_helper = require("includes/cortex/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
   
    "client_mandt",
    "condition_contract_num"

  ]
);

publish("condition_contracts_header", publishConfig).query(
  (ctx) => `
WITH
  date_dimension AS (
    ${date.getDateDimension()}
  )
SELECT
  wcocoh.client AS client_mandt,
  wcocoh.num AS condition_contract_num,
  wcocoh.contract_type AS condition_contract_type,
  wcocoh.vend_owner AS supplier_vend_owner,
  wcocoh.cust_owner AS customer_cust_owner,
  wcocoh.reference AS reference,
  wcocoh.assignment AS assignment,
  wcocoh.ext_partner AS external_partner_ext_partner,
  wcocoh.created_by AS created_by,
  wcocoh.created_on AS created_on,
  wcocoh.rec_time AS created_at_rec_time,
  wcocoh.ekorg AS purch_organization_ekorg,
  wcocoh.ekgrp AS purchasing_group_ekgrp,
  wcocoh.vkorg AS sales_organization_vkorg,
  wcocoh.vtweg AS distribution_channel_vtweg,
  wcocoh.spart AS division_spart,
  wcocoh.zterm AS payment_terms_zterm,
  wcocoh.zbd1t AS payment_in_zbd1t,
  wcocoh.zbd1p AS disc_percent_1_zbd1p,
  wcocoh.zbd2t AS days_2_zbd2t,
  wcocoh.zbd2p AS disc_percent_2_zbd2p,
  wcocoh.zbd3t AS days_net_zbd3t,
  wcocoh.zlsch AS payment_method_zlsch,
  wcocoh.guid AS condition_contract_guid,
  wcocoh.deact AS inactive_cc_partner_deact,
  wcocoh.date_from AS valid_from_date_from,
  wcocoh.date_to AS valid_to_date_to,
  wcocoh.zonlo AS time_zone_zonlo,
  wcocoh.ext_num AS external_identifier_ext_num,
  wcocoh.cc_curr AS contract_currency_cc_curr,
  wcocoh.rate AS exchange_rate,
  wcocoh.rate_date AS conversion_date_rate_date,
  wcocoh.rate_type AS exchange_rate_type,
  wcocoh.vkgrp AS sales_group_vkgrp,
  wcocoh.vkbur AS sales_office_vkbur,
  wcocoh.access_type AS access_type,
  wcocoh.settl_matnr AS settlement_material_settl_matnr,
  wcocoh.settl_type_vend AS settlement_type_supplier_settl_type_vend,
  wcocoh.settl_cal_final AS final_settlement_calendar_settl_cal_final,
  wcocoh.settl_cal_part AS partial_settlement_calendar_settl_cal_part,
  wcocoh.bukrs AS company_code_bukrs,
  wcocoh.settl_type_cust AS settlement_type_customer_settl_type_cust,
  wcocoh.ch_name AS last_changed_by_ch_name,
  wcocoh.ch_date AS last_changed_on_ch_date,
  wcocoh.ch_time AS last_changed_at_ch_time,
  wcocoh.extension_cal AS contract_extension_calendar_extension_cal,
  wcocoh.pred_cc AS predecessor_pred_cc,
  wcocoh.category AS condition_contract_category,
  wcocoh.cc_purpose AS purpose_cc_purpose,
  wcocoh.ext_ref_cat AS external_reference_category_ext_ref_cat,
  wcocoh.ext_ref AS external_reference_ext_ref,
  wcocoh.kolif AS prior_supplier_kolif,
  wcocoh.settl_cal_delta AS delta_settlement_calendar_settl_cal_delta,
  wcocoh.bvtab_group AS business_volume_table_group_bvtab_group,
  wcocoh.settl_cal_accr AS delta_accruals_calendar_settl_cal_accr,
  wcocoh.af_group AS amount_fields_group_af_group,
  wcocoh.settl_meins AS settlement_unit_of_measure_settl_meins,
  wcocoh.settl_gewei AS settlement_unit_of_weight_settl_gewei,
  wcocoh.settl_voleh AS settlement_unit_of_volume_settl_voleh,
  wcocoh.settl_punei AS settlement_points_unit_settl_punei,
  wcocoh.accruals_upd_req AS accruals_update_required_accruals_upd_req,
  wcocoh.settl_cal_accr_rollo AS accruals_deferral_calendar_settl_cal_accr_rollo,
  wcocoh.created_on_tstmp AS created_on_time_stamp_created_on_tstmp,
  wcocoh.ch_tstmp AS changed_on_time_stamp_ch_tstmp,
  wcocoh.stceg AS vat_registration_no_stceg,
  wcocoh.person_owner AS personnel_number_person_owner,
  wcocoh.afsc_group AS amount_fields_split_criteria_group_afsc_group,
  wcocoh.tax_country AS partner_tax_country,
  wcocoh.process_variant AS contract_process_variant,
  wcocoh.ext_ref_item AS external_reference_item_ext_ref_item,
  wcocoh.coco_det_rel_contr AS relevant_for_contract_determination_coco_det_rel_contr,
  wcocoh.tax_reporting_country AS tax_country_tax_reporting_country,
  wcocoh.settl_variant AS settlement_variant_settl_variant,
  wcocoh.dummy_wcocoh_incl_eew_ps AS dummy_dummy_wcocoh_incl_eew_ps,
  wcocoh.ext_guid AS external_cc_guid_ext_guid,
  dimensional_date_created_on.cal_year AS year_of_created_on,
  dimensional_date_created_on.cal_quarter AS quarter_of_created_on,
  dimensional_date_created_on.cal_month AS month_of_created_on,
  dimensional_date_created_on.cal_week AS week_of_created_on,
  dimensional_date_date_from.cal_year AS year_of_valid_from_date_from,
  dimensional_date_date_from.cal_quarter AS quarter_of_valid_from_date_from,
  dimensional_date_date_from.cal_month AS month_of_valid_from_date_from,
  dimensional_date_date_from.cal_week AS week_of_valid_from_date_from,
  dimensional_date_date_to.cal_year AS year_of_valid_to_date_to,
  dimensional_date_date_to.cal_quarter AS quarter_of_valid_to_date_to,
  dimensional_date_date_to.cal_month AS month_of_valid_to_date_to,
  dimensional_date_date_to.cal_week AS week_of_valid_to_date_to,
  dimensional_date_rate_date.cal_year AS year_of_conversion_date_rate_date,
  dimensional_date_rate_date.cal_quarter AS quarter_of_conversion_date_rate_date,
  dimensional_date_rate_date.cal_month AS month_of_conversion_date_rate_date,
  dimensional_date_rate_date.cal_week AS week_of_conversion_date_rate_date,
  dimensional_date_ch_date.cal_year AS year_of_last_changed_on_ch_date,
  dimensional_date_ch_date.cal_quarter AS quarter_of_last_changed_on_ch_date,
  dimensional_date_ch_date.cal_month AS month_of_last_changed_on_ch_date,
  dimensional_date_ch_date.cal_week AS week_of_last_changed_on_ch_date,
  IFNULL(
    wcocoh.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "wcocoh")} AS wcocoh
LEFT JOIN date_dimension AS dimensional_date_created_on
  ON wcocoh.created_on = dimensional_date_created_on.date
LEFT JOIN date_dimension AS dimensional_date_date_from
  ON wcocoh.date_from = dimensional_date_date_from.date
LEFT JOIN date_dimension AS dimensional_date_date_to
  ON wcocoh.date_to = dimensional_date_date_to.date
LEFT JOIN date_dimension AS dimensional_date_rate_date
  ON wcocoh.rate_date = dimensional_date_rate_date.date
LEFT JOIN date_dimension AS dimensional_date_ch_date
  ON wcocoh.ch_date = dimensional_date_ch_date.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["wcocoh"])
])}
`
);
