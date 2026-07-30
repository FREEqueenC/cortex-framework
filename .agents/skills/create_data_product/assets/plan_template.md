## Plan Template

- Goals & Requirements:
  - Custom Namespace: <Specify the custom namespace selected (e.g. `custom`), or warning obtained for `cortex` namespace>
  - Requirements: from the user, other tools, and target goals
  - Use of legacy specifications or models or not
  - List your planned use of other tools
- Proposed Changes:
  - Missing Foundations (if applicable): List any missing SAP tables from the active foundation manifests and detail the proposed sub-plan to scaffold and implement them first.
  - Configuration: Detail the config files that will be updated
  - Data Product Scaffolding: Detail the directory structure and files to be created.
    - Annotations (ECC & S4 if relevant): Detail the fields and their descriptions.
  - Documentation:
    - Create or update the `README.md` file inside the data product directory (`src/data_modules/<namespace>/data_product/<type>/README.md`) using the template: [readme.md.md](assets/readme.md.md). If the file already exists, do **NOT** overwrite it; instead, append/update the existing content with your new additions and decisions.
- Field Mappings & Reasoning:
  - Detail the mapping between data foundation and data product fields with reasoning.
  | Source Table | Source Field | Target Table | Target Field | Reasoning / Logic |
  |---|---|---|---|---|
  | | | | | |

- Verification Plan:
  - Explicitly state that you will run the build and validation tools immediately after file creation.
  - Custom Python Unit Tests: Detail the path of the proposed `pytest` unit test file (`tests/unit/<namespace>/test_<type>.py`) and the specific assertions you plan to write to verify the SQL joins, filters, and important projected fields.

