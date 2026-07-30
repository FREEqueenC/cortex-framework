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

"""
configure_cortex.py
Interactive slot-filling and validation tool for Cortex config.yaml configuration.

Usage:
    python3 configure_cortex.py show [--config <path>]
    python3 configure_cortex.py set <key> <value> [--config <path>]
    python3 configure_cortex.py wizard [--config <path>]
    python3 configure_cortex.py validate [--config <path>]
"""

import sys
import os
import argparse
import yaml
import re

# GCP Project ID validation helper
def validate_gcp_project_id(project_id):
    if not project_id:
        return False, "Value cannot be empty."
    if project_id.startswith("YOUR_") or "placeholder" in project_id.lower():
        return False, "Value must not be a placeholder."
    if not re.match(r"^[a-z][a-z0-9-]{4,29}$", project_id):
        return False, "GCP Project ID must be 6-30 characters, start with a lowercase letter, and contain only lowercase letters, numbers, or hyphens."
    if project_id.endswith("-"):
        return False, "GCP Project ID cannot end with a hyphen."
    return True, ""

# BigQuery Dataset ID validation helper
def validate_dataset_id(dataset_id):
    if not dataset_id:
        return False, "Dataset ID cannot be empty."
    if not re.match(r"^[a-zA-Z0-9_]+$", dataset_id):
        return False, "BigQuery Dataset ID must contain only alphanumeric characters or underscores."
    return True, ""

# BigQuery Location validation helper
def validate_location(location):
    if not location:
        return False, "Location cannot be empty."
    valid_locations = [
        "US", "EU",
        "africa-south1",
        "asia-east1", "asia-east2", "asia-northeast1", "asia-northeast2", "asia-northeast3",
        "asia-south1", "asia-south2", "asia-southeast1", "asia-southeast2", "asia-southeast3",
        "australia-southeast1", "australia-southeast2",
        "europe-central2", "europe-north1", "europe-north2", "europe-southwest1",
        "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6",
        "europe-west8", "europe-west9", "europe-west10", "europe-west12",
        "me-central1", "me-central2", "me-west1",
        "northamerica-northeast1", "northamerica-northeast2", "northamerica-south1",
        "southamerica-east1", "southamerica-west1",
        "us-central1", "us-east1", "us-east4", "us-east5", "us-south1",
        "us-west1", "us-west2", "us-west3", "us-west4"
    ]
    if location.upper() in [loc.upper() for loc in valid_locations]:
        return True, ""
    return True, f"Warning: Location '{location}' is not in the standard BigQuery locations list, but it may be valid."

def load_yaml_config(config_path):
    if not os.path.exists(config_path):
        return None
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"Error parsing existing configuration YAML: {e}", file=sys.stderr)
        return None

def save_yaml_config(config_path, data):
    try:
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(os.path.abspath(config_path)), exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(data, f, sort_keys=False, default_flow_style=False)
        print(f"\n[SUCCESS] Configuration successfully saved to: {config_path}")
        return True
    except Exception as e:
        print(f"Error saving configuration: {e}", file=sys.stderr)
        return False

def get_nested_val(data, path):
    keys = path.split(".")
    curr = data
    for k in keys:
        if isinstance(curr, dict) and k in curr:
            curr = curr[k]
        elif isinstance(curr, list):
            try:
                # Handle indexing like sources.0.projectId or sources[0]
                idx = int(k)
                if idx < len(curr):
                    curr = curr[idx]
                else:
                    return None
            except ValueError:
                return None
        else:
            return None
    return curr

def set_nested_val(data, path, val):
    keys = path.split(".")
    curr = data
    for i, k in enumerate(keys[:-1]):
        if isinstance(curr, dict):
            if k not in curr:
                # Lookahead to see if next key is integer for a list
                next_k = keys[i+1]
                if next_k.isdigit():
                    curr[k] = []
                else:
                    curr[k] = {}
            curr = curr[k]
        elif isinstance(curr, list):
            idx = int(k)
            while len(curr) <= idx:
                curr.append({})
            curr = curr[idx]
    
    last_key = keys[-1]
    if isinstance(curr, dict):
        curr[last_key] = val
    elif isinstance(curr, list):
        idx = int(last_key)
        while len(curr) <= idx:
            curr.append(None)
        curr[idx] = val

def get_default_template():
    # Return a clean starting dictionary based on config.yaml.example
    return {
        "buildEnvironment": {
            "buildProjectId": "YOUR_BUILD_PROJECT_ID"
        },
        "data": {
            "bigQueryLocation": "US",
            "namespaces": [
                {"name": "cortex", "path": "cortex"}
            ],
            "sources": [
                {
                    "id": "sap_raw",
                    "projectId": "YOUR_SOURCE_PROJECT_ID",
                    "datasetId": "cortex_sap_raw"
                }
            ],
            "targets": [
                {
                    "id": "sap_foundation",
                    "projectId": "YOUR_TARGET_PROJECT_ID",
                    "datasetId": "cortex7_sap_data_foundation"
                },
                {
                    "id": "product_target",
                    "projectId": "YOUR_TARGET_PROJECT_ID",
                    "datasetId": "cortex7_data_products"
                }
            ],
            "modules": {
                "foundations": [
                    {
                        "moduleId": "erp",
                        "modulePath": "cortex.sap.foundations.sap",
                        "dataSourceId": "sap_raw",
                        "dataTargetId": "sap_foundation",
                        "moduleSettings": {
                            "sapVersion": "ecc",
                            "mandt": "100"
                        }
                    }
                ],
                "products": [
                    {
                        "moduleId": "sap_purchasing_organizations",
                        "modulePath": "cortex.sap.products.purchasing_organizations",
                        "dependencyBindings": {"sapModule": "erp"},
                        "dataTargetId": "product_target"
                    }
                ]
            }
        },
        "deployment": {
            "targets": [
                {
                    "type": "dataform",
                    "enabled": True,
                    "targetSettings": {
                        "repositoryProjectId": "YOUR_REPO_PROJECT_ID",
                        "repositoryRegion": "us-central1",
                        "repositoryName": "cortex-repository",
                        "workspaceName": "dev"
                    }
                }
            ]
        }
    }

def show_config(config_path):
    config = load_yaml_config(config_path)
    if not config:
        print(f"Config file not found or empty at {config_path}")
        return
    
    print(f"\n========================================")
    print(f"  CORTEX CONFIGURATION: {config_path}")
    print(f"========================================")
    print(yaml.dump(config, sort_keys=False, default_flow_style=False))

def validate_config(config_path, verbose=True):
    config = load_yaml_config(config_path)
    if not config:
        print(f"[FAIL] Configuration file '{config_path}' not found or is empty.")
        return False

    errors = []
    warnings = []

    # 1. Build Project ID
    build_proj = get_nested_val(config, "buildEnvironment.buildProjectId")
    ok, msg = validate_gcp_project_id(build_proj)
    if not ok:
        errors.append(f"buildEnvironment.buildProjectId: {msg} (Current: {build_proj})")

    # 2. Location
    loc = get_nested_val(config, "data.bigQueryLocation")
    ok, msg = validate_location(loc)
    if not ok:
        errors.append(f"data.bigQueryLocation: {msg} (Current: {loc})")
    elif msg:
        warnings.append(f"data.bigQueryLocation: {msg}")

    # 3. Sources
    sources = get_nested_val(config, "data.sources")
    if not sources or not isinstance(sources, list):
        errors.append("data.sources must be a list with at least one entry.")
    else:
        for idx, src in enumerate(sources):
            p_id = src.get("projectId")
            ok, msg = validate_gcp_project_id(p_id)
            if not ok:
                errors.append(f"data.sources[{idx}] ({src.get('id')}): projectId: {msg} (Current: {p_id})")
            
            d_id = src.get("datasetId")
            ok, msg = validate_dataset_id(d_id)
            if not ok:
                errors.append(f"data.sources[{idx}] ({src.get('id')}): datasetId: {msg} (Current: {d_id})")

    # 4. Targets
    targets = get_nested_val(config, "data.targets")
    if not targets or not isinstance(targets, list):
        errors.append("data.targets must be a list with at least two entries (foundations and products).")
    else:
        for idx, tgt in enumerate(targets):
            p_id = tgt.get("projectId")
            ok, msg = validate_gcp_project_id(p_id)
            if not ok:
                errors.append(f"data.targets[{idx}] ({tgt.get('id')}): projectId: {msg} (Current: {p_id})")
            
            d_id = tgt.get("datasetId")
            ok, msg = validate_dataset_id(d_id)
            if not ok:
                errors.append(f"data.targets[{idx}] ({tgt.get('id')}): datasetId: {msg} (Current: {d_id})")

    # 5. Deployment targets
    dep_targets = get_nested_val(config, "deployment.targets")
    if not dep_targets or not isinstance(dep_targets, list):
        errors.append("deployment.targets must be a list containing at least one target.")
    else:
        for idx, tgt in enumerate(dep_targets):
            if tgt.get("type") == "dataform":
                settings = tgt.get("targetSettings", {})
                repo_proj = settings.get("repositoryProjectId")
                ok, msg = validate_gcp_project_id(repo_proj)
                if not ok:
                    errors.append(f"deployment.targets[{idx}].targetSettings.repositoryProjectId: {msg} (Current: {repo_proj})")
                
                repo_region = settings.get("repositoryRegion")
                if not repo_region or "YOUR_" in repo_region:
                    errors.append(f"deployment.targets[{idx}].targetSettings.repositoryRegion is invalid or placeholder (Current: {repo_region})")
                
                repo_name = settings.get("repositoryName")
                if not repo_name or "YOUR_" in repo_name:
                    errors.append(f"deployment.targets[{idx}].targetSettings.repositoryName is invalid or placeholder (Current: {repo_name})")

    if verbose:
        print(f"\n--- Configuration Validation Results for '{config_path}' ---")
        if errors:
            print(f"\n[FAIL] Found {len(errors)} validation error(s):")
            for err in errors:
                print(f"  ❌ {err}")
        else:
            print("\n[PASS] All required configurations are valid.")
        
        if warnings:
            print(f"\n[WARNING] Found {len(warnings)} warnings:")
            for wrn in warnings:
                print(f"  ⚠️ {wrn}")

    return len(errors) == 0

def run_wizard(config_path):
    print("\n================================================")
    print("  CORTEX CONFIGURATION SLOT-FILLING WIZARD")
    print("================================================")
    print("Let's configure your Cortex Framework parameters.")
    print("Press Enter to keep the current value if shown in brackets [].\n")

    # Step 1: Load existing config, or load example from repo if possible, or fallback to defaults
    config = load_yaml_config(config_path)
    if not config:
        # Try to find cortex-framework-core/config/config.yaml.example
        example_path = "cortex-framework-core/config/config.yaml.example"
        if os.path.exists(example_path):
            print(f"Initializing from example template: {example_path}")
            config = load_yaml_config(example_path)
        else:
            print("Initializing from embedded default configuration template.")
            config = get_default_template()

    # Step 2: Run prompts
    
    # 1. Build Project
    curr_build_proj = get_nested_val(config, "buildEnvironment.buildProjectId") or "YOUR_BUILD_PROJECT_ID"
    while True:
        val = input(f"1. GCP Build Project ID (project where build actions run) [{curr_build_proj}]: ").strip()
        if not val:
            val = curr_build_proj
        ok, msg = validate_gcp_project_id(val)
        if ok:
            set_nested_val(config, "buildEnvironment.buildProjectId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    # 2. Location
    curr_loc = get_nested_val(config, "data.bigQueryLocation") or "US"
    while True:
        val = input(f"2. BigQuery Dataset Location [{curr_loc}]: ").strip()
        if not val:
            val = curr_loc
        ok, msg = validate_location(val)
        if ok:
            set_nested_val(config, "data.bigQueryLocation", val.upper())
            if msg:
                print(f"   ⚠️ {msg}")
            break
        print(f"   ❌ Invalid input: {msg}")

    # 3. Source Dataset
    curr_src_proj = get_nested_val(config, "data.sources.0.projectId") or "YOUR_SOURCE_PROJECT_ID"
    while True:
        val = input(f"3. GCP Source Project ID (where raw SAP datasets reside) [{curr_src_proj}]: ").strip()
        if not val:
            val = curr_src_proj
        ok, msg = validate_gcp_project_id(val)
        if ok:
            set_nested_val(config, "data.sources.0.projectId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    curr_src_ds = get_nested_val(config, "data.sources.0.datasetId") or "cortex_sap_raw"
    while True:
        val = input(f"4. BigQuery Source Dataset ID (raw replicated tables) [{curr_src_ds}]: ").strip()
        if not val:
            val = curr_src_ds
        ok, msg = validate_dataset_id(val)
        if ok:
            set_nested_val(config, "data.sources.0.datasetId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    # 4. Target Foundation Dataset
    curr_tgt_f_proj = get_nested_val(config, "data.targets.0.projectId") or "YOUR_TARGET_PROJECT_ID"
    while True:
        val = input(f"5. GCP Target Foundation Project ID (where clean models reside) [{curr_tgt_f_proj}]: ").strip()
        if not val:
            val = curr_tgt_f_proj
        ok, msg = validate_gcp_project_id(val)
        if ok:
            set_nested_val(config, "data.targets.0.projectId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    curr_tgt_f_ds = get_nested_val(config, "data.targets.0.datasetId") or "cortex7_sap_data_foundation"
    while True:
        val = input(f"6. BigQuery Target Foundation Dataset ID [{curr_tgt_f_ds}]: ").strip()
        if not val:
            val = curr_tgt_f_ds
        ok, msg = validate_dataset_id(val)
        if ok:
            set_nested_val(config, "data.targets.0.datasetId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    # 5. Target Product Dataset
    curr_tgt_p_proj = get_nested_val(config, "data.targets.1.projectId") or "YOUR_TARGET_PROJECT_ID"
    while True:
        val = input(f"7. GCP Target Product Project ID (where business insights reside) [{curr_tgt_p_proj}]: ").strip()
        if not val:
            val = curr_tgt_p_proj
        ok, msg = validate_gcp_project_id(val)
        if ok:
            set_nested_val(config, "data.targets.1.projectId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    curr_tgt_p_ds = get_nested_val(config, "data.targets.1.datasetId") or "cortex7_data_products"
    while True:
        val = input(f"8. BigQuery Target Product Dataset ID [{curr_tgt_p_ds}]: ").strip()
        if not val:
            val = curr_tgt_p_ds
        ok, msg = validate_dataset_id(val)
        if ok:
            set_nested_val(config, "data.targets.1.datasetId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    # 6. Dataform Settings
    curr_repo_proj = get_nested_val(config, "deployment.targets.0.targetSettings.repositoryProjectId") or "YOUR_REPO_PROJECT_ID"
    while True:
        val = input(f"9. GCP Dataform Repository Project ID [{curr_repo_proj}]: ").strip()
        if not val:
            val = curr_repo_proj
        ok, msg = validate_gcp_project_id(val)
        if ok:
            set_nested_val(config, "deployment.targets.0.targetSettings.repositoryProjectId", val)
            break
        print(f"   ❌ Invalid input: {msg}")

    curr_repo_region = get_nested_val(config, "deployment.targets.0.targetSettings.repositoryRegion") or "us-central1"
    while True:
        val = input(f"10. GCP Dataform Repository Region [{curr_repo_region}]: ").strip()
        if not val:
            val = curr_repo_region
        if val and not val.startswith("YOUR_"):
            set_nested_val(config, "deployment.targets.0.targetSettings.repositoryRegion", val)
            break
        print("   ❌ Value cannot be empty or placeholder.")

    curr_repo_name = get_nested_val(config, "deployment.targets.0.targetSettings.repositoryName") or "cortex-repository"
    while True:
        val = input(f"11. Dataform Repository Name [{curr_repo_name}]: ").strip()
        if not val:
            val = curr_repo_name
        if val and not val.startswith("YOUR_"):
            set_nested_val(config, "deployment.targets.0.targetSettings.repositoryName", val)
            break
        print("   ❌ Value cannot be empty or placeholder.")

    curr_workspace = get_nested_val(config, "deployment.targets.0.targetSettings.workspaceName") or "dev"
    while True:
        val = input(f"12. Dataform Workspace Name [{curr_workspace}]: ").strip()
        if not val:
            val = curr_workspace
        if val and not val.startswith("YOUR_"):
            set_nested_val(config, "deployment.targets.0.targetSettings.workspaceName", val)
            break
        print("   ❌ Value cannot be empty or placeholder.")

    # Save configuration
    save_yaml_config(config_path, config)
    validate_config(config_path, verbose=True)

def set_config_key(config_path, key, value):
    config = load_yaml_config(config_path)
    if not config:
        # fallback to default template
        config = get_default_template()

    # Coerce boolean types if possible
    if value.lower() == "true":
        value = True
    elif value.lower() == "false":
        value = False
    elif value.isdigit():
        value = int(value)

    set_nested_val(config, key, value)
    save_yaml_config(config_path, config)
    print(f"Updated '{key}' to '{value}' in '{config_path}'")

def main():
    parser = argparse.ArgumentParser(description="Cortex configuration manager tool.")
    parser.add_argument("action", choices=["show", "set", "wizard", "validate"], help="Action to perform")
    parser.add_argument("key", nargs="?", help="Key to set (required for 'set')")
    parser.add_argument("value", nargs="?", help="Value to set (required for 'set')")
    parser.add_argument("--config", default="config/config.yaml", help="Path to active config file (default: config/config.yaml)")

    args = parser.parse_args()

    if args.action == "show":
        show_config(args.config)
    elif args.action == "set":
        if not args.key or not args.value:
            parser.error("Action 'set' requires both 'key' and 'value' arguments.")
        set_config_key(args.config, args.key, args.value)
    elif args.action == "wizard":
        run_wizard(args.config)
    elif args.action == "validate":
        validate_config(args.config, verbose=True)

if __name__ == "__main__":
    main()
