---
name: setup-cortex-config
description: Guides the setup and configuration of the Cortex Framework config.yaml file, validating GCP projects, BigQuery datasets, locations, and Dataform target settings.
---

# Setup Cortex Configuration

This skill assists in establishing, customizing, and validating the primary Cortex Framework configuration (`config.yaml`). It uses a slot-filling experience to ensure all mandatory and optional configurations are accurately populated, conforming to Google Cloud and BigQuery formatting requirements.

---

## Required vs. Optional Configuration

Cortex V7 requires accurate environment details to coordinate BigQuery transformations and orchestrate Dataform pipelines.

### **1. Mandatory Configuration Settings (Strict Validation)**

The following values **MUST** be populated with valid, non-placeholder values:

*   **`buildEnvironment.buildProjectId`**: The Google Cloud Project ID where build operations and script executions run.
*   **`data.bigQueryLocation`**: The geographical location for BigQuery datasets (e.g., `US`, `EU`, `us-central1`).
*   **`data.sources`**: Needs at least one data source (typically `id: sap_raw`) mapping the replication source:
    *   `projectId`: GCP project ID hosting the raw/replicated SAP tables.
    *   `datasetId`: BigQuery dataset ID containing the replicated tables (e.g., `cortex_sap_raw`).
*   **`data.targets`**: Needs target datasets where transformations will be materialized:
    *   **Foundation Target** (`id: sap_foundation`): Project ID and Dataset ID for processed, standard tables.
    *   **Product Target** (`id: product_target`): Project ID and Dataset ID for final data products.
*   **`deployment.targets`**: Orchestration targets (Dataform repository setup):
    *   `repositoryProjectId`: GCP Project ID hosting the Dataform repository.
    *   `repositoryRegion`: GCP region hosting the repository (e.g., `us-central1`).
    *   `repositoryName`: Unique repository name (e.g., `cortex-repository`).
    *   `workspaceName`: Dataform workspace name (e.g., `dev`).

### **2. Optional Configuration Settings**

*   **`data.namespaces`**: Custom namespaces for data foundation and products (default is `cortex`). Note: defining a custom/customer namespace is **NOT required** for standard framework setup, and is **only recommended/required** when building the customer's own new or derived data products.
*   **`modules.foundations` settings**:
    *   `sapVersion`: Target SAP version (`ecc` or `s4`).
    *   `mandt`: 3-digit SAP client identifier (defaults to `"100"`).
    *   `enabled`: Set `true` or `false` to enable/disable specific foundations.
    *   `tableSettings`: File path override for custom table listings.
*   **`modules.products` settings**:
    *   `enabled`: Set `true` or `false` to build/deploy individual data products.
    *   `tableSettings`: Custom partitioning/clustering settings file path.

---

## Using the Configuration Tool

This skill includes a dedicated validation and configuration utility located at:
`external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py`

### **1. Interactively Fill Configuration (Wizard Mode)**

Run the interactive slot-filling wizard to set up or update a configuration file step-by-step:

```bash
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py wizard --config <target_config_path.yaml>
```

*Note: If the target config file already exists, current values will be loaded as defaults in brackets `[...]`. Pressing Enter keeps the current value.*

### **2. Update Specific Fields**

You can directly modify individual fields without going through the wizard:

```bash
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py set <yaml.dot.path> <value> --config <target_config_path.yaml>
```

**Examples:**
```bash
# Update build project ID
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py set buildEnvironment.buildProjectId my-cortex-build-project --config config/config.yaml

# Change SAP Version to S4
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py set data.modules.foundations.0.moduleSettings.sapVersion s4 --config config/config.yaml
```

### **3. Validate Configuration Syntax and Settings**

Verify all project IDs, datasets, and locations conform to syntax rules and that no placeholder `YOUR_...` values remain:

```bash
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py validate --config <target_config_path.yaml>
```

### **4. View Current Configuration**

Print the clean structured configuration file:

```bash
python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py show --config <target_config_path.yaml>
```

---

## Core Operating Behaviors for Agents

When tasked with helping a user setup their configuration:

1.  **Locate / Create Configuration file**:
    *   Check if a configuration file already exists (e.g., `config/config.yaml` or `.cortex/config.yaml`).
    *   If not, copy `cortex-framework-core/config/config.yaml.example` to the path requested by the user (defaulting to `config/config.yaml`). **Never overwrite existing custom files without user consent.**
2.  **Execute Validation First**:
    *   Run the validation command to spot missing or placeholder values.
3.  **Provide a Slot-Filling Session**:
    *   Offer to run the `configure_cortex.py wizard` to guide them through setting up their GCP projects and BigQuery settings.
    *   Alternatively, request the values directly from the user and apply them using the `set` command of the tool.
4.  **Validate and Test Build**:
    *   Run `python3 external-skills/.agents/skills/setup_cortex_config/scripts/configure_cortex.py validate` to confirm the configurations.
    *   Ensure they pass successfully before attempting deployment or compiling data products.
5.  **Generate Configuration Setup Report**:
    *   At the end of a configuration action, you **MUST** generate a comprehensive **Cortex Framework Configuration Setup Report** as an artifact in the standard brain artifacts directory using the template located at:
        `assets/setup_report_template.md`
    *   Fill in all placeholders accurately (e.g. file paths, GCP parameters, validation validator outputs) based on your execution, and refer to the generated report in your final response to the user.

