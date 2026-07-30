---
name: update-data-product
description: Detailed steps and quality gates for updating or modifying existing data products in Cortex Framework V7.
---

# Modifying/Updating an Existing Data Product

This skill governs the end-to-end workflow for researching, planning, implementing, and validating changes to an existing Cortex data product (in either standard or custom namespaces). 

Because modifying existing products carries risk of breaking downstream dependencies or replication chains, you **MUST** perform thorough impact research and obtain user approval on the plan **BEFORE** modifying any files.

---

## Phase 1: Impact Research & Analysis (MANDATORY 4 STEPS)

Before writing any code, you must execute the following research steps and present an **Impact Analysis Report** to the user.

### 1. Target Discovery & Namespace Auditing
*   Locate the target data product under `src/data_modules/<namespace>/<source>/products/<type>/`.
*   Identify the namespace. If it is in the standard `cortex` namespace, you **MUST** warn the user that modifying standard modules directly is against best practices and risks being overwritten during future framework updates. You **MUST** recommend using the **Clone & Modify** strategy (copying the core product folder to your custom namespace under `src/data_modules/<custom_namespace>/<source>/products/<type>/` and registering it in `config.yaml` as an override) to ensure upgrade safety and isolation.


### 2. Downstream Dependency Analysis
*   Use grep search or glob tools to identify all models, views, Dataform definitions, or BI configs across the repository that query or depend on the tables and columns of this target data product.
*   Document all dependencies in the impact report to prevent breaking downstream transformations.

### 3. GCP & BI Deployed Assets Impact Analysis (BigQuery, Data Catalog & Looker MCP)
*   If MCP access to GCP BigQuery, GCP Knowledge/Data Catalog, and/or Looker BI is available, you **MUST** use it to trace and understand if your changes impact already deployed assets in GCP or Looker:
    *   **Read Config Targets**: Parse the active `.cortex/config.yaml` (or active profile config) to extract target environment details, specifically:
        *   `buildEnvironment.buildProjectId` (Target Google Cloud Project)
        *   `data.targets.<foundation_target>.datasetId` (Foundation dataset)
        *   `data.targets.<product_target>.datasetId` (Product dataset)
    *   **Query View Definitions**: Use the available BigQuery MCP tools (e.g. view retrieval, metadata search, or table inspection tools) to check definitions of existing active views or scheduled queries in BigQuery to identify any external dependencies (e.g., other projects, dashboards, or reporting tools) that query this table/view.
    *   **Inspect Lineage**: If a GCP Knowledge/Data Catalog MCP is configured, use it to lookup metadata records or trace lineages to discover downstream cloud assets.
    *   **Trace Looker Dependencies**: If a Looker MCP is available, use it to search for Looker views, LookML Explores, dimensions, measures, or active dashboards that reference the target tables/columns being updated to prevent breaking downstream business intelligence dashboards.

### 4. Source Foundation & Schema Alignment
*   Identify if the proposed updates require new source fields or tables from the data foundation.
*   Verify that all required columns exist in the foundation annotations (`src/data_modules/<namespace>/<source>/foundations/sap/annotations/`).
*   If source tables are from SAP, use the `query-sap-ddic` skill (via the `cortex-framework-core/.venv/bin/python external-skills/.agents/skills/query_sap_ddic/scripts/query_sap_ddic.py` script) to query and verify the exact field schemas, data types, and check table relations directly from the replicated SAP Data Dictionary (DDIC) tables in BigQuery.
*   **Custom Z-Fields Check:** If any new fields are custom SAP fields (prefixed with `ZZ` or `YY`), retrieve their exact technical structure from the DDIC and ensure they are added to the mapping plan following the standard naming convention (converting to description-original aliasing).


### 5. Formulate the Impact Analysis Report
*   Summarize your research (including repository mapping and GCP deployed assets) using the [impact_report_template.md](assets/impact_report_template.md) template.

---

## Phase 2: Propose Implementation Plan (MANDATORY USER APPROVAL GATING)

Once the impact has been documented, you must formulate a detailed **Implementation Plan** and wait for explicit user approval.

1.  Create the plan using the [implementation_plan_template.md](assets/implementation_plan_template.md) template.
2.  **CRITICAL GATE**: You **MUST** present the plan to the user and request explicit permission to proceed. **DO NOT** edit or write any code until the user has reviewed and confirmed the plan in writing.

---

## Phase 3: Implement the Changes

Once approved, modify the files by applying the changes cleanly. Follow all conventions defined in the [style_guide.md](../create_data_product/references/style_guide.md).

### 1. Annotations Update
*   Modify files in `src/data_modules/<namespace>/<source>/products/<type>/annotations/` (e.g., `ecc/` or `s4/` directories if they differ).
*   **Do NOT overwrite** existing annotations or user-added descriptions. Add new fields cleanly or update description blocks non-destructively.

### 2. Dataform Definitions Update (`.js` / `.sqlx` files)
*   Update the Dataform models in `src/data_modules/<namespace>/<source>/products/<type>/definitions/`.
*   Ensure all aliasing conforms to standard `snake_case`.
*   Ensure all database, schema, and table targets are dynamically resolved from `moduleConfig` per standard V7 modularity.
*   Include namespaced `require` imports at the top of `.js` files for includes.
*   **Data Modeling Standards (CRITICAL):** For any standard data patterns modified or introduced—such as currency decimal shifts, date dimension breakdowns, audit columns (`source_last_updated_at`, `bq_loaded_at`), incremental filtering, and validity timestamps—you **MUST** refer to and follow the [Data Modeling Standards](../data_modeling_standards/SKILL.md) guide.

### 3. Settings & Configuration Update
*   If custom partition settings, parameters, or variables are added, update `src/data_modules/<namespace>/<source>/products/<type>/table_settings.default.yaml` (or custom `table_settings.yaml` if explicitly configured in `config.yaml`) or `config.yaml` as appropriate. Note that `tableSettings` entry in `config.yaml` is optional.
*   **Custom Namespace Registration:** If the data product uses a new or custom namespace, ensure that this custom namespace is registered under the `data.namespaces` block inside `config/config.yaml` and the active configuration file (if not already present).

### 4. Python Unit Tests Update (`tests/unit/<namespace>/test_<type>.py`)
*   **MANDATORY:** Whenever the user provides new requirements or changes to the data model (e.g., modified SQL transformation logic, joins, filtering criteria, or projected fields), you **MUST** update or expand the corresponding Python unit tests.


---

## Phase 4: The Quality Gate (MANDATORY EXECUTION)

Immediately after making the modifications, execute the Quality Gate checks without asking for permission. You cannot mark the task complete until all checks pass.

1.  **EXECUTE BUILD**: Run `uv run cortex-build --config <active_config_file_path.yaml>`. Fix any compilation, JS syntax, or YAML parsing errors immediately.
2.  **TRIGGER VALIDATION SKILL**: Run the `validate-data-product` skill to ensure:
    *   All referenced source fields exist in the data foundation.
    *   Fields conform to naming conventions.
    *   Reference integrity across schemas is perfectly maintained.
3.  **UPDATE/CREATE PYTHON UNIT TESTS:** If the user provided new requirements or if SQL transformation logic, joins, or filtering criteria were modified, use the `create-python-tests` skill to update or create Python unit tests validating the changes. Execute the full test suite using `uv run pytest` (without targeting a single file) to ensure both custom and baseline tests pass.
4.  **REPORT RESULTS**: Provide the user with a structured Quality Report outlining build, validation, and Python test execution status.


---

## Phase 5: Update Documentation

*   Update the `README.md` inside the target data product directory (`src/data_modules/<namespace>/<source>/products/<type>/README.md`).
*   **Do NOT overwrite** the existing documentation. Read it first and integrate your changes, design decisions, and logical flows cleanly into the existing document.

## Phase 6: Propose ER Diagram Generation

*   After updating the documentation, you **MUST** explicitly ask the user if they would like to generate or update the ER diagrams for the modified data product using the following script:
    `cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <type> -f mermaid`
    > "Would you like to generate or update the Entity-Relationship (ER) diagrams for this modified data product? (Supported formats: Mermaid, Graphviz DOT, draw.io XML)"

