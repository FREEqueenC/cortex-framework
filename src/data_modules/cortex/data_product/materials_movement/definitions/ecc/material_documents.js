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
    "document_number_mblnr",
    "document_year_mjahr",
    "document_item_zeile"
  ]
);

publish("material_documents", publishConfig).query(
  (ctx) => `
WITH date_dimension AS (
  ${date.getDateDimension()}
),
currency_decimal AS (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  mseg.mandt AS client_mandt,
  mseg.mblnr AS document_number_mblnr,
  mseg.mjahr AS document_year_mjahr,
  mseg.zeile AS document_item_zeile,
  mseg.matnr AS material_number_matnr,
  mseg.charg AS batch_number_charg,
  mseg.werks AS plant_werks,
  mseg.lgort AS storage_location_lgort,
  mseg.bwart AS movement_type_bwart,
  mseg.insmk AS stock_type_insmk,
  mseg.shkzg AS debit_credit_indicator_shkzg,
  mseg.menge AS quantity_menge,
  mseg.meins AS base_unit_of_measure_meins,
  mseg.waers AS currency_key_waers,
  ${currency.amountWithDecimalShift("mseg.dmbtr", "currency_decimal")} AS amount_in_local_currency_dmbtr,
  mseg.ebeln AS purchase_order_number_ebeln,
  mseg.lifnr AS vendors_account_number_lifnr,
  mseg.kdauf AS sales_order_number_kdauf,
  mseg.kunnr AS account_number_of_customer_kunnr,
  mseg.ummat AS receiving_issuing_material_ummat,
  mseg.umcha AS receiving_issuing_batch_umcha,
  mseg.ebelp AS item_number_of_purchasing_document_ebelp,
  mseg.lfbnr AS document_number_of_a_reference_document_lfbnr,
  mseg.lfpos AS item_of_a_reference_document_lfpos,
  mseg.aufnr AS order_number_aufnr,
  mseg.bukrs AS company_code_bukrs,
  mseg.umwrk AS receiving_plant_umwrk,
  mseg.umlgo AS receiving_issuing_storage_location_umlgo,
  mseg.lgnum AS warehouse_number_lgnum,
  mseg.bwlvs AS movement_type_for_warehouse_management_bwlvs,
  mseg.xblvs AS indicator_posting_in_warehouse_management_system_xblvs,
  mseg.bestq AS stock_category_in_the_warehouse_management_system_bestq,
  mseg.sobkz AS special_stock_indicator_sobkz,
  mseg.kzbew AS movement_indicator_kzbew,
  mseg.grund AS reason_for_movement_grund,
  mseg.weunb AS goods_receipt_non_valuated_weunb,
  mseg.lgtyp AS storage_type_lgtyp,
  mseg.equnr AS equipment_number_equnr,
  mseg.gsber AS business_area_gsber,
  mseg.kostl AS cost_center_kostl,
  mseg.prctr AS profit_center_prctr,
  mseg.ps_psp_pnr AS work_breakdown_structure_element_ps_psp_pnr,
  mseg.sakto AS gl_account_number_sakto,
  mseg.shkum AS debit_credit_indicator_in_revaluation_shkum,
  mseg.bwtar AS valuation_type_bwtar,
  mseg.kzzug AS receipt_indicator_kzzug,
  mseg.budat_mkpf AS posting_date_budat_mkpf,
  dimensional_date_budat_mkpf.cal_year AS year_of_posting_date_budat_mkpf,
  dimensional_date_budat_mkpf.cal_month AS month_of_posting_date_budat_mkpf,
  dimensional_date_budat_mkpf.cal_quarter AS quarter_of_posting_date_budat_mkpf,
  dimensional_date_budat_mkpf.cal_week AS week_of_posting_date_budat_mkpf,
  IFNULL(
    mseg.recordstamp,
    TIMESTAMP('1900-01-01 00:00:00+00')
  ) AS source_last_updated_at,
  CURRENT_TIMESTAMP() AS bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "mseg")} AS mseg
LEFT JOIN currency_decimal
  ON mseg.waers = currency_decimal.currkey
LEFT JOIN date_dimension AS dimensional_date_budat_mkpf
  ON mseg.budat_mkpf = dimensional_date_budat_mkpf.date
${sql_helper.buildDynamicWhere([
  incremental.getFilter(ctx, ["mseg"])
])}
`
);
