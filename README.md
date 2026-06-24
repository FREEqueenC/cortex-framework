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

### Data foundation modules:

* SAP ECC 
* SAP S/4HANA

### Data products:

* Find all available data products and their corresponding data assets on the [public documentation](https://docs.cloud.google.com/cortex/docs/data-product) site.

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
