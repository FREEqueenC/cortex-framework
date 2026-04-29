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
const po_helper = require("includes/cortex/po_helper.js");
const publish_config = require("includes/cortex/publish_config.js");

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  [
    "client_mandt",
    "purchasing_document_number_ebeln",
    "item_number_of_purchasing_document_ebelp",
    "delivery_schedule_line_counter_etenr"
  ]
);

publish("purchasing_document_schedule_lines", publishConfig).query(
  (ctx) => `
WITH date_dim as (
  ${date.getDateDimension()}
), currency_decimal as (
  ${currency.currencyDecimalShift(ctx.ref(moduleConfig.sources.sapModule.datasetId, "tcurx"))}
)
SELECT
  ekpo.mandt as client_mandt,
  eket.ebeln as purchasing_document_number_ebeln,
  eket.ebelp as item_number_of_purchasing_document_ebelp,
  eket.etenr as delivery_schedule_line_counter_etenr,
  ekpo.matnr as material_number_matnr,
  ekpo.meins as uo_m_meins,
  ekpo.werks as plant_werks,
  ekpo.lgort as storage_location_lgort,
  ekpo.bukrs as company_code_bukrs,
  eket.eindt as item_delivery_date_eindt,
  dimensional_date_eindt.cal_year as year_of_item_delivery_date_eindt,
  dimensional_date_eindt.cal_month as month_of_item_delivery_date_eindt,
  dimensional_date_eindt.cal_quarter as quarter_of_item_delivery_date_eindt,
  dimensional_date_eindt.cal_week as week_of_item_delivery_date_eindt,
  eket.slfdt as statistics_relevant_delivery_date_slfdt,
  dimensional_date_slfdt.cal_year as year_of_statistics_relevant_delivery_date_slfdt,
  dimensional_date_slfdt.cal_month as month_of_statistics_relevant_delivery_date_slfdt,
  dimensional_date_slfdt.cal_quarter as quarter_of_statistics_relevant_delivery_date_slfdt,
  dimensional_date_slfdt.cal_week as week_of_statistics_relevant_delivery_date_slfdt,
  eket.lpein as category_of_delivery_date_lpein,
  eket.menge as scheduled_quantity_menge,
  eket.ameng as previous_quantity_ameng,
  eket.wemng as quantity_of_goods_received_wemng,
  eket.wamng as issued_quantity_wamng,
  eket.mahnz as number_of_reminders_for_schedule_line_mahnz,
  eket.mng02 as committed_quantity_mng02,
  eket.dat01 as committed_date_dat01,
  ekko.bsart as purchasing_document_type_bsart,
  ekko.aedat as date_on_which_record_was_created_aedat,
  dimensional_date_aedat.cal_year as year_of_date_on_which_record_was_created_aedat,
  dimensional_date_aedat.cal_month as month_of_date_on_which_record_was_created_aedat,
  dimensional_date_aedat.cal_quarter as quarter_of_date_on_which_record_was_created_aedat,
  dimensional_date_aedat.cal_week as week_of_date_on_which_record_was_created_aedat,
  ekko.lifnr as vendor_account_number_lifnr,
  ekko.ekorg as purchasing_organization_ekorg,
  ekko.ekgrp as purchasing_group_ekgrp,
  ekko.bedat as purchasing_document_date_bedat,
  dimensional_date_bedat.cal_year as year_of_purchasing_document_date_bedat,
  dimensional_date_bedat.cal_month as month_of_purchasing_document_date_bedat,
  dimensional_date_bedat.cal_quarter as quarter_of_purchasing_document_date_bedat,
  dimensional_date_bedat.cal_week as week_of_purchasing_document_date_bedat,
  ekko.reswk as supplying_plant_in_case_of_stock_transport_order_reswk,
  ekpo.loekz as deletion_indicator_in_purchasing_document_loekz,
  ekpo.elikz as delivery_completed_indicator_elikz,
  ekpo.bstyp as purchasing_document_category_bstyp,
  ekpo.banfn as purchase_requisition_number_banfn,
  ekpo.bnfpo as item_number_of_purchase_requisition_bnfpo,
  ekpo.retpo as returns_item_retpo,
  ekpo.reslo as issuing_storage_location_for_stock_transport_order_reslo,
  ${po_helper.getOpenQuantity(
    "eket.menge",
    "eket.wemng",
    "ekpo.elikz"
  )} as open_quantity,
  ${currency.amountWithDecimalShift(
    `${po_helper.getOpenQuantity(
      "eket.menge",
      "eket.wemng",
      "ekpo.elikz"
    )} * ekpo.netpr`,
    "currency_decimal"
  )} as open_quantity_amount,
  eket.wamng - eket.wemng as in_transit_quantity,
  GREATEST(
    IFNULL(eket.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(ekpo.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00')),
    IFNULL(ekko.recordstamp, TIMESTAMP('1900-01-01 00:00:00+00'))
  ) as source_last_updated_at,
  CURRENT_TIMESTAMP() as bq_loaded_at
FROM
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'eket')} as eket
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ekpo')} as ekpo
  ON eket.ebeln = ekpo.ebeln
  AND eket.ebelp = ekpo.ebelp
  AND eket.mandt = ekpo.mandt
INNER JOIN
  ${ctx.ref(moduleConfig.sources.sapModule.datasetId, 'ekko')} as ekko
  ON eket.ebeln = ekko.ebeln
  AND eket.mandt = ekko.mandt
LEFT JOIN date_dim as dimensional_date_eindt
  ON eket.eindt = dimensional_date_eindt.date
LEFT JOIN date_dim as dimensional_date_slfdt
  ON eket.slfdt = dimensional_date_slfdt.date
LEFT JOIN date_dim as dimensional_date_aedat
  ON ekko.aedat = dimensional_date_aedat.date
LEFT JOIN date_dim as dimensional_date_bedat
  ON ekko.bedat = dimensional_date_bedat.date
LEFT JOIN currency_decimal
  ON ekko.waers = currency_decimal.currkey
${incremental.getWhere(ctx, ["eket.recordstamp", "ekpo.recordstamp", "ekko.recordstamp"])}
`,
);
