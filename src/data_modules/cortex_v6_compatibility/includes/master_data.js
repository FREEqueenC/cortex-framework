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

// Shared Master Data queries to avoid cross-referencing other Data Products

function getMaterialsMD(ctx, datasetId) {
  return `
    SELECT
      mara.MANDT AS Client_MANDT,
      mara.MATNR AS MaterialNumber_MATNR,
      makt.MAKTX AS MaterialText_MAKTX,
      makt.SPRAS AS Language_SPRAS,
      mara.MHDHB AS TotalShelfLife_MHDHB,
      mara.MTART AS MaterialType_MTART,
      mara.MATKL AS MaterialGroup_MATKL,
      mara.MEINS AS BaseUnitOfMeasure_MEINS,
      mara.PRDHA AS ProductHierarchy_PRDHA
    FROM
      ${ctx.ref(datasetId, 'mara')} AS mara
    LEFT JOIN
      ${ctx.ref(datasetId, 'makt')} AS makt
      ON
        mara.MANDT = makt.MANDT
        AND mara.MATNR = makt.MATNR
  `;
}

function getMaterialTypesMD(ctx, datasetId) {
  return `
    SELECT
      t134.MANDT AS Client_MANDT,
      t134.MTART AS MaterialType_MTART,
      t134t.MTBEZ AS DescriptionOfMaterialType_MTBEZ,
      t134t.MTBEZ AS MaterialTypeDescription_MTBEZ,
      t134t.SPRAS AS LanguageKey_SPRAS
    FROM
      ${ctx.ref(datasetId, 't134')} AS t134
    LEFT JOIN
      ${ctx.ref(datasetId, 't134t')} AS t134t
      ON
        t134.MANDT = t134t.MANDT
        AND t134.MTART = t134t.MTART
  `;
}

function getMaterialGroupsMD(ctx, datasetId) {
  return `
    SELECT
      t023.MANDT AS Client_MANDT,
      t023.MATKL AS MaterialGroup_MATKL,
      t023t.WGBEZ AS MaterialGroupName_WGBEZ,
      t023t.SPRAS AS Language_SPRAS
    FROM
      ${ctx.ref(datasetId, 't023')} AS t023
    LEFT JOIN
      ${ctx.ref(datasetId, 't023t')} AS t023t
      ON
        t023.MANDT = t023t.MANDT
        AND t023.MATKL = t023t.MATKL
  `;
}

function getVendorsMD(ctx, datasetId) {
  return `
    SELECT
      LFA1.MANDT AS Client_MANDT,
      LFA1.LIFNR AS AccountNumberOfVendorOrCreditor_LIFNR,
      LFA1.NAME1 AS NAME1,
      LFA1.NAME1 AS VendorName,
      LFA1.LAND1 AS CountryKey_LAND1,
      LFA1.LAND1 AS VendorCountry,
      LFA1.ORT01 AS VendorCity,
      LFA1.SPRAS AS Language_LANGU,
      ADRC.DATE_TO AS ValidToDate_DATE_TO,
      ADRC.NATION AS VersionIdForInternationalAddresses_NATION
    FROM
      ${ctx.ref(datasetId, 'lfa1')} AS LFA1
    LEFT JOIN
      ${ctx.ref(datasetId, 'adrc')} AS ADRC
      ON LFA1.MANDT = ADRC.CLIENT
        AND LFA1.ADRNR = ADRC.ADDRNUMBER
  `;
}

function getCompaniesMD(ctx, datasetId) {
  return `
    SELECT
      MANDT AS Client_MANDT,
      BUKRS AS CompanyCode_BUKRS,
      BUTXT AS CompanyText_BUTXT,
      LAND1 AS CompanyCountry,
      ORT01 AS CompanyCity,
      PERIV AS FiscalyearVariant_PERIV,
      PERIV AS CompanyFiscalyearVariant
    FROM
      ${ctx.ref(datasetId, 't001')}
  `;
}

function getPlantsMD(ctx, datasetId) {
  return `
    SELECT
      MANDT AS Client_MANDT,
      WERKS AS Plant_WERKS,
      NAME1 AS Name_NAME1,
      NAME2 AS Name2_NAME2,
      NAME2 AS PlantName_NAME2,
      LAND1 AS CountryKey_LAND1,
      REGIO AS Region_County__REGIO,
      SPRAS AS Language_SPRAS,
      SPART AS DivisionForIntercompanyBilling_SPART,
      BWKEY AS ValuationArea_BWKEY
    FROM
      ${ctx.ref(datasetId, 't001w')}
  `;
}

function getStorageLocationsMD(ctx, datasetId) {
  return `
    SELECT
      MANDT AS Client_MANDT,
      WERKS AS Plant_WERKS,
      LGORT AS StorageLocation_LGORT,
      LGOBE AS StorageLocationText_LGOBE
    FROM
      ${ctx.ref(datasetId, 't001l')}
  `;
}

function getPurchasingGroupsMD(ctx, datasetId) {
  return `
    SELECT
      mandt AS Client_MANDT,
      ekgrp AS PurchasingGroup_EKGRP,
      eknam AS PurchasingGroupText_EKNAM
    FROM
      ${ctx.ref(datasetId, 't024')}
  `;
}

function getPurchasingOrganizationsMD(ctx, datasetId) {
  return `
    SELECT
      mandt AS Client_MANDT,
      ekorg AS PurchasingOrganization_EKORG,
      ekotx AS PurchasingOrganizationText_EKOTX
    FROM
      ${ctx.ref(datasetId, 't024e')}
  `;
}

function getVendorConfig(ctx, datasetId) {
  return `
    SELECT
      MANDT AS Client_MANDT,
      NAME AS NameOfVariantVariable_NAME,
      LOW AS LowField_LOW,
      HIGH AS HighField_HIGH
    FROM
      ${ctx.ref(datasetId, 'tvarvc')}
  `;
}

function getMaterialLedger(ctx, datasetId) {
  return `
    SELECT
      mbew.MANDT AS Client_MANDT,
      mbew.MATNR AS MaterialNumber_MATNR,
      mbew.BWTAR AS ValuationType_BWTAR,
      mbew.BWKEY AS ValuationArea_BWKEY,
      mbew.PEINH AS PriceUnit_PEINH,
      mbew.LFMON AS PostingPeriod,
      mbew.LFGJA AS FiscalYear,
      mbew.VPRSV AS PriceControlIndicator_VPRSV,
      COALESCE(mbew.STPRS * currency_decimal.CURRFIX, mbew.STPRS) AS StandardCost_STPRS,
      COALESCE(mbew.SALK3 * currency_decimal.CURRFIX, mbew.SALK3) AS ValueOfTotalValuatedStock_SALK3,
      COALESCE(mbew.VERPR * currency_decimal.CURRFIX, mbew.VERPR) AS MovingAveragePrice,
      t001.WAERS AS CurrencyKey_WAERS
    FROM ${ctx.ref(datasetId, 'mbew')} AS mbew
    LEFT JOIN
      ${ctx.ref(datasetId, 't001k')} AS t001k
      ON mbew.MANDT = t001k.MANDT
        AND mbew.BWKEY = t001k.BWKEY
    LEFT JOIN
      ${ctx.ref(datasetId, 't001')} AS t001
      ON t001.MANDT = t001k.MANDT
        AND t001.BUKRS = t001k.BUKRS
    LEFT JOIN
      currency_decimal AS currency_decimal
      ON t001.WAERS = currency_decimal.CURRKEY
  `;
}

function getSalesOrganizationsMD(ctx, datasetId) {
  return `
    SELECT
      TVKO.MANDT AS Client_MANDT,
      TVKO.VKORG AS SalesOrg_VKORG,
      TVKO.WAERS AS SalesOrgCurrency_WAERS,
      TVKO.KUNNR AS SalesOrgCustomer_KUNNR,
      TVKO.BUKRS AS CompanyCode_BUKRS,
      T001.LAND1 AS Country_LAND1,
      T001.WAERS AS CoCoCurrency_WAERS,
      T001.PERIV AS FiscalYrVariant_PERIV,
      T001.BUTXT AS Company_BUTXT,
      TVKOT.VTEXT AS SalesOrgName_VTEXT,
      TVKOT.SPRAS AS Language_SPRAS
    FROM
      ${ctx.ref(datasetId, 'tvko')} AS TVKO
    LEFT OUTER JOIN
      ${ctx.ref(datasetId, 't001')} AS T001
      ON
        TVKO.MANDT = T001.MANDT
        AND TVKO.BUKRS = T001.BUKRS
    INNER JOIN
      ${ctx.ref(datasetId, 'tvkot')} AS TVKOT
      ON
        TVKO.MANDT = TVKOT.MANDT
        AND TVKO.VKORG = TVKOT.VKORG
  `;
}

module.exports = {
  getMaterialsMD,
  getMaterialTypesMD,
  getMaterialGroupsMD,
  getVendorsMD,
  getCompaniesMD,
  getPlantsMD,
  getStorageLocationsMD,
  getPurchasingGroupsMD,
  getPurchasingOrganizationsMD,
  getVendorConfig,
  getMaterialLedger,
  getSalesOrganizationsMD
};

