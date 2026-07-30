## Impact Analysis Report

### 1. Target Data Product Details
- **Data Product Name**: `<type>`
- **Active Namespace**: `<namespace>` (cortex | custom | other)
- **Current State**: (Working | Broken | New Field Request)

### 2. Downstream Dependency Mapping
Detail any other models, views, or configurations that reference the tables/columns being changed.
| Downstream File/Model | Columns Referenced | Potential Impact / Risk | Mitigation Strategy |
|:---|:---|:---|:---|
| | | | |

### 3. GCP & BI Deployed Assets Impact (BigQuery, Data Catalog & Looker)
*This section is required if MCP tools are available to inspect the GCP and Looker BI environments.*
- **Target GCP Project**: `<buildProjectId>`
- **Target Datasets Inspected**: `<foundationTarget.datasetId>` / `<productTarget.datasetId>`
- **GCP Inspect Results**:
  * List any external GCP views, scheduled queries, or downstream GCP resources found referencing these tables/columns:
  | GCP Resource Path | Column(s) Referenced | Impact / Action Required |
  |:---|:---|:---|
  | | | |
- **Looker BI Inspect Results**:
  * List any Looker views, LookML explores, dimensions/measures, or active dashboards found referencing these tables/columns:
  | LookML File / Explore | Field(s) Referenced | Impact / Action Required |
  |:---|:---|:---|
  | | | |

### 4. Foundation & SAP Schema Alignment
Verify if raw source tables and foundation columns exist to support the new change.
- **New Foundation Tables Needed**: (None | Yes, specify tables)
- **New Foundation Fields Needed**: (None | Yes, specify fields & SAP version ECC/S4HANA)
- **Field Existence in Foundation config**: (Verified | Missing - action required)

### 5. Potential Risks & Breaking Changes
- **Backward Compatibility**: (Fully Compatible | Breaking Change, specify)
- **Incremental Merge Strategy Impact**: (No impact | Key changes require full refresh, specify)
