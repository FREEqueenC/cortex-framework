# Google Cloud Cortex Framework

[**Cortex Framework v7**](https://docs.cloud.google.com/cortex/docs/overview) introduces a highly modular deployment architecture, simplified data orchestration via [Dataform](https://cloud.google.com/dataform), and enhanced support for the next generation of AI-ready data products with [BigQuery](https://cloud.google.com/bigquery) \- enabling enterprises to build, extend, and deploy robust data models and pipelines for advanced analytics and AI/agentic use cases.

---

## Key features

* **Modular deployment and smart dependency resolution**: Deploy exactly what you need. Simply select the desired data products, and the framework will automatically identify, retrieve, and transform the necessary tables to the data foundation layer, ensuring no unnecessary data is processed. Easily add custom fields or logic without breaking standard models.

* **Native dependency graph generation:** Automatically handle the order of operations for complex data models, ensuring prerequisite tables are ready before deploying data foundations and data products.

* **Bring your own CDC (External data foundation):** A flexible architecture allows you to bypass built-in Change Data Capture processing and connect your own existing CDC pipelines directly to the foundation layer.

* **Serverless BigQuery-native execution:** Orchestration relies entirely on Google Cloud **Dataform**, enabling easy data transformation and processing using version-controlled SQL. No standing compute clusters or Airflow VMs are required, minimizing infrastructure overhead. 

* **Incremental loading:** Native, incremental loading configurations ensure highly efficient processing of large enterprise datasets. Significantly reduce BigQuery processing time and costs by processing only new or changed data since the last execution.

* **High data fidelity & semantics:** Features dynamic discovery and ingestion of custom fields, robust semantic mapping (e.g. translating cryptic table names to business-friendly terms), AI-ready metadata, and advanced logic handling (e.g. integrating the SAP TCURX table for exact currency decimal shifts).

* **Multi-system SAP support:** Built-in dynamic dependency resolution and logic differentiation allows seamless compilation and parallel deployment for both SAP ECC and SAP S/4HANA source systems. Seamlessly bring in data from multiple SAP ERP systems.

* **Extensibility framework:** Maintain a clean separation between your custom data products and Cortex Data Products using namespaces. This ensures you can benefit from the latest Cortex updates without impacting your custom work.

Please refer to the [public documentation](https://docs.cloud.google.com/cortex/docs/overview) for more information. 

---

## Available modules and data products

Cortex Framework v7 comes packaged with a comprehensive set of BigQuery data models for both SAP ECC and SAP S/4HANA source systems. 

* Data foundation modules:  
  * SAP ECC   
  * SAP S/4HANA

* Data products:  
  * The following table outlines the catalog of data products available for SAP ERP (ECC and S/4HANA) within Cortex Framework, detailing their functional descriptions, source tables, and supported source systems. 

| Data Product | Data Asset | Description | Source tables | Source Systems |  |
| :---- | :---- | :---- | :---- | ----- | ----- |
|  |  |  |  | SAP ECC | SAP S/4HANA |
| Customers | Customers | Customer master data, customer number, name of customer, location, address, and similar information at the granularity of Client(System) and Customer number, Version ID for International Addresses and Valid from date. | `kna1, adrc` | ✅ | ✅ |
| Delivery Blocking Reasons | Delivery Blocking Reasons | Delivery blocking reasons at the granularity of Client(System) and Language Key. | `tvlst` | ✅ | ✅ |
| Delivery Documents | Delivery Document Headers | Delivery documents at the header level at the granularity of Client(System) and Delivery document number. | `tcurx, likp` | ✅ | ✅ |
|  | Delivery Document Items | Delivery document items at the granularity of Client(System), Delivery document number and Item number of delivery document. | `tcurx, likp, lips` | ✅ | ✅ |
| Material Batches | Material Cross Plant Batches | Material cross-plant batches at the granularity of Client(System), Material Number and Batch Number. | `mch1` | ✅ | ✅ |
| Material Groups | Material Groups | Material groups at the granularity of Client(System), Material Group, and Language Key. | `t023, t023t` | ✅ | ✅ |
| Material Plants | Material Plants | Material plants at the granularity of Client(System), Material Number and Plant. | `marc` | ✅ | ✅ |
| Material Types | Material Types | Material types at the granularity of Client(System), Material Type and Language Key. | `t134, t134t` | ✅ | ✅ |
| Materials | Materials\_MD | Materials at the granularity of Client(System) and Material Number. | `mara, makt` | ✅ | ✅ |
| Materials Movements | Material Documents | Material documents at the granularity of Client(System), Document Number, Document Year and Document Item. | `tcurx, mseg` | ✅ |  |
|  | Material Movement Types | Material movement types at the granularity of Client(System), Language Key, Movement Type, Special Stock Indicator, Movement Indicator, Receipt Indicator and Consumption Related Movement Type. | `t156, t156t` | ✅ |  |
| Materials Movements | Material Documents | Material documents at the granularity of Client(System), Document Number, Document Year and Document Item. | `tcurx, matdoc` |  | ✅ |
|  | Material Movement Types | Material movement types at the granularity of Client(System), Language Key, Movement Type, Special Stock Indicator, Movement Indicator, Receipt Indicator and Consumption Related Movement Type. | `t156, t156t` |  | ✅ |
| Purchasing Documents | Purchasing Document Headers | Provides details about purchase orders at the header level. This view is at the granularity of Client(System) and Purchasing document number. | `ekko` | ✅ | ✅ |
|  | Purchasing Document Items | Details about purchase order items. This view is at the granularity of Client(System), Purchasing document number and Item number of purchasing document. | `tcurx, ekpo, ekko` | ✅ | ✅ |
|  | Purchasing Document Schedule Lines | Details about purchase documents at schedule line level, including KPIs such as Open Quantity.. The granularity of this view is Client(System), Purchasing Document Number, Item Number of Purchasing Document and Delivery Schedule Line Counter. | `tcurx, ekpo, ekko, eket` | ✅ | ✅ |
| Purchasing Organizations | Purchasing Organizations | Purchasing organization master data at the granularity of Client(System) and purchasing organization. | `t024e` | ✅ | ✅ |
| Sales Documents | Sales Document Headers | Sales documents at the header level, at the granularity of Client(System), and Sales document number. | `vbak` | ✅ | ✅ |
|  | Sales Document Items | Sales document items, at the granularity of Client(System), Sales document number and Item number of sales document. | `tcurx, vbap` | ✅ | ✅ |
|  | Sales Document Schedule Lines | Sales documents at schedule line level, including KPIs such as Open Quantity and In-Transit Quantity. The granularity of this view is Client(System), Sales Document Number, Item Number of Sales Document and Delivery Schedule Line Counter. | `tcurx, vbep` | ✅ | ✅ |
| Sales Organizations | Sales Organizations | Sales organizations at the granularity of Client(System), Sales Organization and Language Key. | `tvko, tvkot` | ✅ | ✅ |
|  | Distribution Channel | Distribution channels at the granularity of Client(System), Distribution Channel and Language Key. | `tvtw, tvtwt` | ✅ | ✅ |
|  | Divisions | Divisions at the granularity of Client(System), Division and Language Key. | `tspa, tspat` | ✅ | ✅ |
| Vendors | Vendors | Vendor master data, vendor number, name of vendor, location, address, and similar at the granularity of Client(System) and Vendor number, Version ID for International Addresses and Valid from date. | `lfa1, adrc` | ✅ | ✅ |

Please refer to the [public documentation](https://docs.cloud.google.com/cortex/docs/overview) for more information. 

---

## Getting Started

We recommend using Cloud Shell for the interaction with the Cortex Framework
command line interface as it contains all the required tools pre-installed.

### Demo deployment

To quickly spin up a demo deployment with automated sample data for PoC evaluations:

```shell
uv run cortex-demo --project_id=<PROJECT_ID>
```

For detailed instructions on deployment and configuration, please refer to our [public documentation](https://docs.cloud.google.com/cortex/docs/overview).
