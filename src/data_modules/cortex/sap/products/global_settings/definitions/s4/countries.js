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
const materializationType = tableConfig.materializationType || "view";
const incremental = require("includes/incremental.js");
const publish_config = require("includes/publish_config.js");
const sql_helper = require("includes/sql_helper.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "country_key_land1",
    "language_spras"
  ]
);

publish(moduleContext.moduleId + "_" + tableConfig.tableName, publishConfig).query(
  (ctx) => `
SELECT
  t005.mandt AS client_mandt,
  t005.land1 AS country_key_land1,
  t005t.landx AS country_name_landx,
  t005t.spras AS language_spras,
  t005t.natio AS nationality_natio,
  t005t.landx50 AS country_name_max50_landx50,
  t005t.natio50 AS nationality_max50_natio50,
  t005t.prq_spregt AS super_region_text_prq_spregt,
  t005.landk AS vehicle_country_key_landk,
  t005.lnplz AS postal_code_length_lnplz,
  t005.prplz AS postal_code_check_rule_prplz,
  t005.addrs AS address_routine_addrs,
  t005.xplzs AS street_postal_code_required_xplzs,
  t005.xplpf AS po_box_postal_code_required_xplpf,
  t005.spras AS country_language_spras,
  t005.xland AS country_version_flag_xland,
  t005.xaddr AS print_country_name_flag_xaddr,
  t005.nmfmt AS name_format_nmfmt,
  t005.xregs AS city_file_check_xregs,
  t005.xplst AS street_specific_postal_code_xplst,
  t005.intca AS country_iso_code_intca,
  t005.intca3 AS iso_country_code_3char_intca3,
  t005.intcn3 AS iso_country_code_num3_intcn3,
  t005.xegld AS eu_member_xegld,
  t005.xskfn AS discount_base_net_xskfn,
  t005.xmwsn AS tax_base_net_xmwsn,
  t005.lnbkn AS bank_account_length_lnbkn,
  t005.prbkn AS bank_account_check_rule_prbkn,
  t005.lnblz AS bank_number_length_lnblz,
  t005.prblz AS bank_number_check_rule_prblz,
  t005.lnpsk AS post_office_bank_account_length_lnpsk,
  t005.prpsk AS post_office_bank_check_rule_prpsk,
  t005.xprbk AS use_bank_check_module_xprbk,
  t005.bnkey AS bank_key_bnkey,
  t005.lnbks AS bank_key_length_lnbks,
  t005.prbks AS bank_key_check_rule_prbks,
  t005.xprso AS use_tax_check_module_xprso,
  t005.pruin AS vat_registration_check_rule_pruin,
  t005.uinln AS vat_registration_length_uinln,
  t005.lnst1 AS tax_number_1_length_lnst1,
  t005.prst1 AS tax_number_1_check_rule_prst1,
  t005.lnst2 AS tax_number_2_length_lnst2,
  t005.prst2 AS tax_number_2_check_rule_prst2,
  t005.lnst3 AS tax_number_3_length_lnst3,
  t005.prst3 AS tax_number_3_check_rule_prst3,
  t005.lnst4 AS tax_number_4_length_lnst4,
  t005.prst4 AS tax_number_4_check_rule_prst4,
  t005.lnst5 AS tax_number_5_length_lnst5,
  t005.prst5 AS tax_number_5_check_rule_prst5,
  t005.landd AS duevo_nationality_landd,
  t005.kalsm AS procedure_pricing_kalsm,
  t005.landa AS alternative_country_key_landa,
  t005.wechf AS bill_of_exchange_period_wechf,
  t005.lkvrz AS short_name_foreign_trade_lkvrz,
  t005.intcn AS intrastat_code_intcn,
  t005.xdezp AS decimal_point_format_xdezp,
  t005.datfm AS date_format_datfm,
  t005.curin AS index_based_currency_curin,
  t005.curha AS hard_currency_curha,
  t005.waers AS country_currency_waers,
  t005.kurst AS exchange_rate_type_kurst,
  t005.afapl AS chart_of_depreciation_afapl,
  t005.gwgwrt AS max_low_value_asset_amount_gwgwrt,
  t005.umrwrt AS net_book_value_changeover_umrwrt,
  t005.kzrbwb AS post_net_book_value_flag_kzrbwb,
  t005.xanzum AS transfer_down_payments_flag_xanzum,
  t005.ctnconcept AS withholding_tax_concepts_ctnconcept,
  t005.kzsrv AS taxes_individual_service_level_kzsrv,
  t005.xxinve AS display_capital_goods_flag_xxinve,
  t005.sureg AS super_region_per_country_sureg,
  GREATEST(
    IFNULL(t005.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(t005t.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM 
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t005")} AS t005
LEFT JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "t005t")} AS t005t
  ON t005.mandt = t005t.mandt
  AND t005.land1 = t005t.land1
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["t005", "t005t"])
])}
`
);
