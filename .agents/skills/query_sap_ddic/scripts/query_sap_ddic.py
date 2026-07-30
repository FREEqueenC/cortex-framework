#!/usr/bin/env python3
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import os
import sys
import yaml
from google.cloud import bigquery

def parse_args():
    args = {
        "table": None,
        "config": "cortex-framework-core/config/config.yaml",
        "dataset": None,
        "format": "markdown",
        "include_structural": False,
        "output_file": None,
        "output_dir": None
    }
    
    idx = 1
    while idx < len(sys.argv):
        arg = sys.argv[idx]
        if arg in ("-h", "--help"):
            print('''usage: query_sap_ddic.py [-h] [--config CONFIG] [--dataset DATASET] [--format {markdown,json,yaml}] [--include-structural] table

Fetch SAP table schemas from BigQuery DDIC tables.

positional arguments:
  table                 SAP Table Name (e.g., VBAK, LFA1)

options:
  -h, --help            show this help message and exit
  --config CONFIG       Path to active config file
  --dataset DATASET     Dataset path override (format: project_id.dataset_id)
  --format {markdown,json,yaml}
                        Output format
  --include-structural  Include structural metadata rows (like .INCLUDE or .INCLUDE-AP)''')
            sys.exit(0)
        elif arg == "--config" and idx + 1 < len(sys.argv):
            args["config"] = sys.argv[idx + 1]
            idx += 1
        elif arg == "--dataset" and idx + 1 < len(sys.argv):
            args["dataset"] = sys.argv[idx + 1]
            idx += 1
        elif arg == "--format" and idx + 1 < len(sys.argv):
            args["format"] = sys.argv[idx + 1]
            idx += 1
        elif arg == "--include-structural":
            args["include_structural"] = True
        elif arg == "--output_file" and idx + 1 < len(sys.argv):
            args["output_file"] = sys.argv[idx + 1]
            idx += 1
        elif arg == "--output_dir" and idx + 1 < len(sys.argv):
            args["output_dir"] = sys.argv[idx + 1]
            idx += 1
        elif not arg.startswith("-"):
            args["table"] = arg
        idx += 1
    return args

def resolve_dataset(config_path, dataset_arg):
    if dataset_arg:
        if "." in dataset_arg:
            parts = dataset_arg.split(".")
            return parts[0], parts[1]
        return None, dataset_arg

    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
                sources = cfg.get("data", {}).get("sources", [])
                modules = cfg.get("data", {}).get("modules", {}).get("foundations", [])
                
                sap_mod = next((m for m in modules if m.get("modulePath") == "cortex.sap.foundations.sap"), None)
                src_id = sap_mod.get("dataSourceId", "sap_raw") if sap_mod else "sap_raw"
                
                src = next((s for s in sources if s.get("id") == src_id), None)
                if src and src.get("projectId") and src.get("datasetId"):
                    return src.get("projectId"), src.get("datasetId")
        except Exception:
            pass
            
    proj_id = os.environ.get("PROJECT_ID")
    raw_ds = os.environ.get("RAW_DATASET")
    if proj_id and raw_ds:
        return proj_id, raw_ds
        
    return None, None

def get_ddic_schema(table_name, client, project_id, dataset_id, include_structural=False):
    existing_tables = [t.table_id.lower() for t in client.list_tables(f"{project_id}.{dataset_id}")]
    
    def resolve_casing(base_name):
        if base_name.lower() in existing_tables:
            return base_name.lower()
        if base_name.upper() in existing_tables:
            return base_name.upper()
        return None

    dd03l = resolve_casing("dd03l")
    if not dd03l:
        sys.stderr.write(f"❌ ERROR: SAP DDIC table DD03L was not found in {project_id}.{dataset_id}\n")
        sys.exit(1)

    dd04t = resolve_casing("dd04t")
    if not dd04t:
        sys.stderr.write(f"⚠️ WARNING: SAP DDIC table DD04T was not found in {project_id}.{dataset_id}\n")

    dd08l = resolve_casing("dd08l")
    if not dd08l:
        sys.stderr.write(f"⚠️ WARNING: SAP DDIC table DD08L was not found in {project_id}.{dataset_id}\n")

    dd01l = resolve_casing("dd01l")
    if not dd01l:
        sys.stderr.write(f"⚠️ WARNING: SAP DDIC table DD01L was not found in {project_id}.{dataset_id}\n")

    dd07l = resolve_casing("dd07l")
    dd07t = resolve_casing("dd07t")
    has_domain_vals = bool(dd07l and dd07t)
    if not has_domain_vals:
        sys.stderr.write(f"ℹ️ NOTE: SAP DDIC table DD07L or DD07T was not found in {project_id}.{dataset_id}\n")

    desc_col = "TRIM(t.ddtext)" if dd04t else "TRIM(f.fieldname)"
    long_desc_col = "TRIM(t.scrtext_l)" if dd04t else "TRIM(f.fieldname)"
    check_col = "TRIM(f.checktable)" if dd08l else "CAST(NULL AS STRING)"
    conv_col = "TRIM(d.convexit)" if dd01l else "CAST(NULL AS STRING)"
    domain_col = "TRIM(v.value_list)" if has_domain_vals else "CAST(NULL AS STRING)"

    structural_clause = "AND NOT STARTS_WITH(TRIM(f.fieldname), '.')" if not include_structural else ""

    query = f"""
    SELECT
        TRIM(f.fieldname) AS Field,
        TRIM(f.keyflag) AS KEYFLAG,
        TRIM(f.datatype) AS Datatype,
        f.leng AS Length,
        f.decimals AS Decimals,
        {check_col} AS Checktable,
        {desc_col} AS Description,
        {long_desc_col} AS Long_Description,
        TRIM(f.rollname) AS Rollname,
        TRIM(f.domname) AS Domname,
        TRIM(f.reftable) AS Ref_Table,
        TRIM(f.reffield) AS Ref_Field,
        {conv_col} AS Convexit,
        {domain_col} AS Domain_Values
    FROM `{project_id}.{dataset_id}.{dd03l}` f
    """
    
    if dd04t:
        query += f"""
        LEFT JOIN `{project_id}.{dataset_id}.{dd04t}` t
            ON f.rollname = t.rollname
            AND t.ddlanguage = 'E'
            AND t.as4local = 'A'
        """
    if dd01l:
        query += f"""
        LEFT JOIN `{project_id}.{dataset_id}.{dd01l}` d
            ON f.domname = d.domname
            AND d.as4local = 'A'
        """
    if has_domain_vals:
        query += f"""
        LEFT JOIN (
            SELECT
                v_val.domname,
                STRING_AGG(CONCAT(TRIM(v_val.domvalue_l), ': ', TRIM(v_txt.ddtext)), ' | ' ORDER BY v_val.valpos) AS value_list
            FROM `{project_id}.{dataset_id}.{dd07l}` v_val
            LEFT JOIN `{project_id}.{dataset_id}.{dd07t}` v_txt
                ON v_val.domname = v_txt.domname
                AND v_val.valpos = v_txt.valpos
                AND v_val.as4local = v_txt.as4local
                AND v_txt.ddlanguage = 'E'
            WHERE v_val.as4local = 'A'
            GROUP BY v_val.domname
        ) v ON f.domname = v.domname
        """

    query += f"""
    WHERE f.tabname = '{table_name.upper()}'
      AND f.as4local = 'A'
      {structural_clause}
    ORDER BY
        CASE WHEN f.keyflag = 'X' THEN 0 ELSE 1 END,
        f.fieldname ASC
    """

    job = client.query(query)
    results = job.result()
    
    columns = []
    for row in results:
        cols = {
            "Field": row.Field,
            "KEYFLAG": row.KEYFLAG,
            "Datatype": row.Datatype,
            "Length": str(row.Length) if row.Length is not None else "",
            "Decimals": str(row.Decimals) if row.Decimals is not None else "",
            "Checktable": row.Checktable or "",
            "Description": row.Description or "",
            "Long_Description": row.Long_Description or "",
            "Rollname": row.Rollname or "",
            "Domname": row.Domname or "",
            "Ref_Table": row.Ref_Table or "",
            "Ref_Field": row.Ref_Field or "",
            "Convexit": row.Convexit or "",
            "Domain_Values": row.Domain_Values or ""
        }
        columns.append(cols)
    return columns

def print_markdown_table(columns):
    print("## 🛠️ Section 1: Physical Database Columns")
    print("| Field | Key | Type | Length | Decimals | Check Table |")
    print("|---|---|---|---|---|---|")
    for col in columns:
        print(f"| {col['Field']} | {'X' if col['KEYFLAG']=='X' else ''} | {col['Datatype']} | {col['Length']} | {col['Decimals']} | {col['Checktable']} |")

    print("\n## 📋 Section 2: Data Elements & Reference Mappings")
    print("| Field | Data Element | Domain | Ref Table | Ref Field | Conv Exit |")
    print("|---|---|---|---|---|---|")
    for col in columns:
        print(f"| {col['Field']} | {col['Rollname']} | {col['Domname']} | {col['Ref_Table']} | {col['Ref_Field']} | {col['Convexit']} |")

    print("\n## 🏷️ Section 3: Business Semantic Descriptions")
    print("| Field | Description | Long Description | Domain Values |")
    print("|---|---|---|---|---|")
    for col in columns:
        print(f"| {col['Field']} | {col['Description']} | {col['Long_Description']} | {col['Domain_Values']} |")

def main():
    args = parse_args()
    if not args["table"]:
        sys.stderr.write("❌ ERROR: A SAP table name must be specified.\n")
        sys.exit(1)

    proj_id, ds_id = resolve_dataset(args["config"], args["dataset"])
    if not ds_id or not proj_id:
        sys.stderr.write("❌ ERROR: Could not resolve target BigQuery Project ID and Dataset ID.\n")
        sys.stderr.write("Please specify the target dataset explicitly using the '--dataset <project_id>.<dataset_id>' argument.\n")
        sys.stderr.write("Alternatively, ensure a valid 'config.yaml' exists in the workspace declaring the 'sap_raw' source credentials.\n")
        sys.exit(1)

    client = bigquery.Client(project=proj_id)
    columns = get_ddic_schema(args["table"], client, proj_id, ds_id, include_structural=args["include_structural"])

    if args["output_dir"]:
        os.makedirs(args["output_dir"], exist_ok=True)
        for name in [f"{args['table'].upper()}.json", f"{args['table'].lower()}.json", f"{args['table'].lower()}_ddic_data.json"]:
            path = os.path.join(args["output_dir"], name)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(columns, f, indent=2)
    elif args["output_file"]:
        os.makedirs(os.path.dirname(args["output_file"]), exist_ok=True)
        with open(args["output_file"], "w", encoding="utf-8") as f:
            json.dump(columns, f, indent=2)

    if args["format"] == "json":
        print(json.dumps(columns, indent=2))
    elif args["format"] == "yaml":
        print(yaml.dump(columns, sort_keys=False))
    else:
        print_markdown_table(columns)

if __name__ == "__main__":
    main()
