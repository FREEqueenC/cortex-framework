# Changelog

All notable changes to Cortex Framework will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

## [7.0.0-beta] - Major Release

This release marks a fundamental architectural shift for the Cortex Framework. It is a complete rewrite and establishes a new, independent repository distinct from Cortex v6. 

### Added
- **New Repository & Codebase:** Established a fresh, GitOps-native repository architecture built specifically for serverless deployments, entirely separate from the Cortex v6 Airflow-based repository.
- **Dataform Orchestration CLI:** Introduced a new intelligent Python CLI (`cortex-build`, `cortex-deploy`, `cortex-build-and-deploy`, and `cortex-demo`) via `pyproject.toml` entry points to compile and deploy Dataform workspaces.
- **External Data Foundation (BYO-CDC):** Added a configuration flag to skip built-in Change Data Capture processing, allowing users to connect their own CDC pipelines directly to the foundation layer.
- **Modular Deployments:** Added the ability to deploy selected data products; the framework now automatically resolves and deploys only the required underlying raw and foundation base tables.
- **Incremental Loading:** Introduced native incremental loading configurations across all data layers on a per-table basis.
- **Dual-System SAP Support:** Added dynamic dependency resolution and logic differentiation for compiling SAP ECC and S/4HANA source environments.
- **SAP Data Products:** Added Master Data models including `Customers`, `Vendors`, `Materials`, `Material Groups`, `Material Types`, `Material Plants`, `Material Cross Plant Batches`, and `Material Classification`.
- **SAP Sales & Logistics Products:** Added models for `Sales Organizations`, `Sales Documents`, `Delivery Documents`, `Delivery Blocking Reasons`, `Purchasing Organizations`, `Purchasing Documents`, and `Materials Movement`.
- **Pydantic Validation:** Added strict Pydantic schemas for `config.yaml` and annotation files to validate configurations and mitigate BigQuery overwrite risks before deployment.
- **Sample Data Seeding:** Added automated sample data generation to the Demo process to accelerate PoC evaluations.
- **Governance Metadata:** BigQuery table descriptions are now automatically populated upon deployment to assist with Dataplex cataloging and lineage tracking.
- **Enhanced Currency Handling:** Integrated the `TCURX` table directly into Sales Document Schedule Lines for exact currency decimal shifts out-of-the-box.
- **Deployment Safeguards:** Implemented SAP version validation to halt deployments that would cause cross-system table overwrites.

### Changed
- **Architecture Migration:** Shifted the primary execution architecture from Apache Airflow (Cortex v6) to a serverless, BigQuery-native model using Google Cloud Dataform.
- **Configuration Structure:** Centralized overarching environment settings into a unified `config.yaml` while keeping source parameters in granular YAML files.
- **Dependency Management:** Replaced manual Airflow DAG dependencies with automatic graph building using standard SQL `ref()` functions.
- **Naming Conventions:** Standardized column and field names to `snake_case` globally across all data product definitions and annotations.
- **Testing Framework:** Consolidated unit testing logic for data products into reusable code blocks to simplify developer contributions.