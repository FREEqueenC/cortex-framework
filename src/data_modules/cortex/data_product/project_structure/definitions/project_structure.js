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

const incremental = require("includes/cortex/incremental.js");
const publish_config = require("includes/cortex/publish_config.js");
const sql_helper = require("includes/cortex/sql_helper.js");

const materializationType = tableConfig.materializationType || "incremental";

const publishConfig = publish_config.getPublishConfig(
  materializationType,
  tableConfig,
  moduleConfig,
  ["client_mandt", "project_internal_id_pspnr", "wbs_element_internal_id_pspnr"]
);

publish("project_structure", publishConfig).query(
  (ctx) => `
    SELECT
      proj.mandt AS client_mandt,
      proj.pspnr AS project_internal_id_pspnr,
      proj.pspid AS project_id_pspid,
      proj.post1 AS project_description_post1,
      proj.ernam AS created_by_ernam,
      proj.erdat AS created_on_erdat,
      proj.aenam AS changed_by_aenam,
      proj.aedat AS changed_on_aedat,
      proj.vernr AS responsible_person_number_vernr,
      proj.verna AS responsible_person_name_verna,
      proj.astnr AS applicant_number_astnr,
      proj.astna AS applicant_name_astna,
      proj.vbukr AS company_code_vbukr,
      proj.vgsbr AS business_area_vgsbr,
      proj.vkokr AS controlling_area_vkokr,
      proj.prctr AS profit_center_prctr,
      proj.pwhie AS project_currency_pwhie,
      proj.werks AS plant_werks,
      proj.profl AS project_profile_profl,
      proj.bprof AS budget_profile_bprof,
      proj.kostl AS cost_center_kostl,
      proj.loevm AS deletion_indicator_loevm,
      proj.xstat AS is_statistical_xstat,
      proj.func_area AS functional_area_func_area,
      proj.vkorg AS sales_organization_vkorg,
      proj.vtweg AS distribution_channel_vtweg,
      proj.spart AS division_spart,
      prps.pspnr AS wbs_element_internal_id_pspnr,
      prps.posid AS wbs_element_id_posid,
      prps.post1 AS wbs_description_post1,
      prps.ernam AS wbs_created_by_ernam,
      prps.erdat AS wbs_created_on_erdat,
      prps.aenam AS wbs_changed_by_aenam,
      prps.aedat AS wbs_changed_on_aedat,
      prps.vernr AS wbs_responsible_person_number_vernr,
      prps.verna AS wbs_responsible_person_name_verna,
      prps.astnr AS wbs_applicant_number_astnr,
      prps.astna AS wbs_applicant_name_astna,
      prps.pbukr AS wbs_company_code_pbukr,
      prps.pgsbr AS wbs_business_area_pgsbr,
      prps.pkokr AS wbs_controlling_area_pkokr,
      prps.prctr AS wbs_profit_center_prctr,
      prps.prart AS wbs_project_type_prart,
      prps.stufe AS wbs_level_stufe,
      prps.plakz AS is_planning_element_plakz,
      prps.belkz AS is_account_assignment_element_belkz,
      prps.fakkz AS is_billing_element_fakkz,
      prps.werks AS wbs_plant_werks,
      prps.kostl AS wbs_cost_center_kostl,
      prps.loevm AS wbs_deletion_indicator_loevm,
      prps.xstat AS wbs_is_statistical_xstat,
      prps.func_area AS wbs_functional_area_func_area,
      prhi.up AS wbs_superior_element_internal_id_up,
      prhi.down AS wbs_subordinate_element_internal_id_down,
      prhi.left AS wbs_left_element_internal_id_left,
      prhi.right AS wbs_right_element_internal_id_right,
      prte.pstrt AS scheduled_start_date_pstrt,
      prte.pende AS scheduled_finish_date_pende,
      prte.estrt AS forecast_start_date_estrt,
      prte.eende AS forecast_finish_date_eende,
      prte.istrt AS actual_start_date_istrt,
      prte.iende AS actual_finish_date_iende,
      prte.pdaur AS basic_duration_pdaur,
      prte.edaur AS forecast_duration_edaur,
      prte.idaur AS actual_duration_idaur,
      prte.peinh AS basic_duration_unit_peinh,
      prte.eeinh AS forecast_duration_unit_eeinh,
      prte.ieinh AS actual_duration_unit_ieinh,
      GREATEST(
        IFNULL(proj.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00")),
        IFNULL(prps.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00")),
        IFNULL(prte.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00")),
        IFNULL(prhi.recordstamp, TIMESTAMP("1900-01-01 00:00:00+00"))
      ) AS source_last_updated_at,
      CURRENT_TIMESTAMP() AS bq_loaded_at
    FROM ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "proj")} AS proj
    LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "prps")} AS prps
      ON proj.mandt = prps.mandt
      AND proj.pspnr = prps.psphi
    LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "prte")} AS prte
      ON prps.mandt = prte.mandt
      AND prps.pspnr = prte.posnr
    LEFT JOIN ${ctx.ref(moduleConfig.sources.sapModule.datasetId, "prhi")} AS prhi
      ON prps.mandt = prhi.mandt
      AND prps.pspnr = prhi.posnr
    ${sql_helper.buildDynamicWhere([
      incremental.getFilter(ctx, ["proj", "prps", "prte", "prhi"])
    ])}
  `
);
