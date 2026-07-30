## Implementation Plan (Data Product Update)

> [!IMPORTANT]
> You MUST obtain explicit user approval on this plan BEFORE proceeding with any file changes.

### 1. Proposed Code & Definition Changes
- **Annotations**:
  * `<file_path>`: Add fields `<list of fields>`
- **Dataform SQL Definitions (`.js`)**:
  * `<file_path>`: Detail the logical transformations, joins, or filters to be added/modified (e.g., currency decimal shifts, date dimension joins, audit columns, or incremental filtering adhering to [Data Modeling Standards](../../data_modeling_standards/SKILL.md)).
- **Configuration**:
  * Update settings or custom variables in `table_settings.default.yaml` (or custom `table_settings.yaml`) or `config.yaml`

### 2. Field Mappings & Logic Reasoning
| Source Foundation Table | Source Field | Target Product Table | Target Field | Transformation Logic / Business Reasoning |
|:---|:---|:---|:---|:---|
| | | | | |

### 3. Verification & Quality Gate Plan
- **Build Check**: Confirm `uv run cortex-build` will be executed immediately.
- **Validation Suite**: Verify `validate-data-product` check will run after build success.
