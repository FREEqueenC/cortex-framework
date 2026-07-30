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

import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET
import yaml

def get_sap_suffix(field_name):
    """
    Extract the raw SAP field suffix (e.g., matnr from material_number_matnr).
    """
    if not field_name:
        return ""
    parts = field_name.split("_")
    suffix = parts[-1].lower()
    
    # Suffixes that should not be mapped to relationships.
    # We filter out specific suffixes for the following reasons:
    # 1. Preventing Spaghetti Graphs (Multi-Tenant Client Keys):
    #    SAP systems use tenant columns like "mandt" or "client" to partition data.
    #    Since almost every database table contains these columns, treating them as
    #    relational keys would create dynamic connections between every single table.
    #    This would result in an unreadable "spaghetti" network of connections, ruining
    #    the visual layout.
    # 2. Technical Metadata Filtering:
    #    Suffixes like "recordstamp", "bq_loaded_at", "last_updated_at", "timestamp",
    #    "at", "on", and "by" are technical columns appended for auditing, data ingestion,
    #    or change-tracking. They do not carry domain-level entity relationship semantics.
    # 3. Generic Suffixes (Noise / False-Positives):
    #    Suffixes like "row", "id", "uuid" are generic identifiers. Without filtering them,
    #    we risk matching unrelated entities simply because they share a common technical identifier
    #    suffix name (e.g., matching a "customer_id" with a completely unrelated "order_row_id").
    # 4. Date Bounds & Miscellaneous Flags:
    #    "date_to", "date_from", and "nation" are temporal indicators or administrative flags
    #    rather than logical join columns.
    ignore_suffixes = {
        "mandt", "recordstamp", "bq_loaded_at", "client", "date_to", "date_from",
        "nation", "last_updated_at", "row", "id", "uuid", "timestamp", "at", "on", "by"
    }
    if suffix in ignore_suffixes:
        return ""
    return suffix

def is_inferred_pk(table_name, field_name):
    # Standard SAP table keys dictionary (using suffixes/raw column names)
    sap_table_keys = {
        "adrc": ["addrnumber", "date_from", "nation"],
        "adr6": ["addrnumber", "persnumber", "consnumber"],
        "adrct": ["addrnumber", "langu", "date_from", "nation"],
        "kna1": ["kunnr"],
        "lfa1": ["lifnr"],
        "mara": ["matnr"],
        "vbak": ["vbeln"],
        "vbap": ["vbeln", "posnr"],
        "ekko": ["ebeln"],
        "ekpo": ["ebeln", "ebelp"],
        "t001": ["bukrs"],
        "t001w": ["werks"],
        "likp": ["vbeln"],
        "lips": ["vbeln", "posnr"],
        "vbrk": ["vbeln"],
        "vbrp": ["vbeln", "posnr"],
    }
    
    tbl_lower = table_name.lower()
    suffix = field_name.split("_")[-1].lower() if field_name else ""
    if not suffix:
        return False
        
    # Check if table has predefined keys
    if tbl_lower in sap_table_keys:
        return suffix in sap_table_keys[tbl_lower]
        
    # General fallback for other tables: check common key suffix names
    common_keys = {
        "addrnumber", "kunnr", "lifnr", "matnr", "vbeln", "ebeln", 
        "werks", "bukrs", "persnumber", "consnumber", "posnr", "ebelp"
    }
    return suffix in common_keys

def find_data_product_dir(search_name_or_path):
    """
    Find the data product directory based on a name or partial path.
    """
    if os.path.isdir(search_name_or_path):
        return os.path.abspath(search_name_or_path)
    
    # Search current workspace directories
    cwd = os.getcwd()
    for root, dirs, files in os.walk(cwd):
        if "products" in root.split(os.sep):
            # Check if directory name matches the search term
            if os.path.basename(root) == search_name_or_path:
                return os.path.abspath(root)
            # Also check subdirectories of products
            for d in dirs:
                if d == search_name_or_path:
                    return os.path.abspath(os.path.join(root, d))
                    
    return None

def extract_values_from_dict(d, target_key=None):
    """
    Recursively extract all values (or specific key values) from a nested dict/list structure.
    """
    values = []
    if isinstance(d, dict):
        for k, v in d.items():
            if target_key is None or k == target_key:
                if isinstance(v, str):
                    values.append(v)
                elif isinstance(v, (list, dict)):
                    values.extend(extract_values_from_dict(v))
            else:
                values.extend(extract_values_from_dict(v, target_key))
    elif isinstance(d, list):
        for item in d:
            if isinstance(item, str):
                values.append(item)
            elif isinstance(item, (list, dict)):
                values.extend(extract_values_from_dict(item, target_key))
    return values

def find_foundation_annotations_dirs(dp_dir):
    """
    Find foundation annotations directories for the data product's namespace and standard fallback.
    """
    # dp_dir is: .../src/data_modules/<namespace>/<source>/products/<product_name>
    parent_dir = os.path.dirname(dp_dir)
    if os.path.basename(parent_dir) != "products":
        return []
    
    source_dir = os.path.dirname(parent_dir)
    source_name = os.path.basename(source_dir)
    namespace_dir = os.path.dirname(source_dir)
    data_modules_dir = os.path.dirname(namespace_dir)
    
    namespaces_to_check = [os.path.basename(namespace_dir)]
    if "cortex" not in namespaces_to_check:
        namespaces_to_check.append("cortex")
        
    found_dirs = []
    for ns in namespaces_to_check:
        ns_path = os.path.join(data_modules_dir, ns)
        df_path = os.path.join(ns_path, source_name, "foundations", "sap")
        if os.path.exists(df_path):
            ann_path = os.path.join(df_path, "annotations")
            if os.path.exists(ann_path) and os.path.isdir(ann_path):
                found_dirs.append(ann_path)
    return found_dirs

def parse_data_product(dp_dir, include_siblings=True):
    """
    Parse a data product directory's manifest, annotations, and definitions.
    Optionally includes sibling data products to infer cross-product relationships.
    Also includes foundation tables that the data product depends on.
    """
    manifest_path = os.path.join(dp_dir, "manifest.yaml")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            try:
                manifest = yaml.safe_load(f)
            except Exception as e:
                print(f"Warning: Failed to parse manifest: {e}", file=sys.stderr)

    # Extract target product's foundation dependencies from manifest
    target_foundation_dependencies = set()
    if manifest and "dependencies" in manifest:
        dep_values = extract_values_from_dict(manifest["dependencies"])
        for val in dep_values:
            target_foundation_dependencies.add(val.lower())

    # Find parent directory to locate sibling data products
    parent_dir = os.path.dirname(dp_dir)
    target_name = os.path.basename(dp_dir)
    
    dp_dirs = [dp_dir]
    if include_siblings and os.path.basename(parent_dir) == "products":
        # Scan parent directory for sibling data products
        for name in os.listdir(parent_dir):
            full_path = os.path.join(parent_dir, name)
            if os.path.isdir(full_path) and name != target_name:
                dp_dirs.append(full_path)

    # Registry of all tables from all scanned products and foundations
    tables = {}
    
    # Parse data foundation annotations that are dependencies of target or siblings
    foundation_dirs = find_foundation_annotations_dirs(dp_dir)
    all_foundation_dependencies = set(target_foundation_dependencies)
    for d in dp_dirs:
        if d == dp_dir:
            continue
        sibling_manifest_path = os.path.join(d, "manifest.yaml")
        if os.path.exists(sibling_manifest_path):
            with open(sibling_manifest_path, "r") as f:
                try:
                    sib_manifest = yaml.safe_load(f)
                    if sib_manifest and "dependencies" in sib_manifest:
                        for val in extract_values_from_dict(sib_manifest["dependencies"]):
                            all_foundation_dependencies.add(val.lower())
                except Exception:
                    pass

    # Parse required foundation annotations
    for f_dir in foundation_dirs:
        for file in os.listdir(f_dir):
            if file.endswith((".yaml", ".yml")):
                table_name = os.path.splitext(file)[0].lower()
                if table_name in all_foundation_dependencies and table_name not in tables:
                    file_path = os.path.join(f_dir, file)
                    with open(file_path, "r") as f:
                        try:
                            data = yaml.safe_load(f)
                            if data and "fields" in data:
                                fields = []
                                pks = []
                                for field in data["fields"]:
                                    name = field.get("name")
                                    desc = field.get("description", "")
                                    is_pk = (
                                        "pk" in desc.lower() 
                                        or "primary key" in desc.lower()
                                        or is_inferred_pk(table_name, name)
                                    )
                                    fields.append({
                                        "name": name,
                                        "description": desc,
                                        "is_pk": is_pk,
                                        "sap_suffix": get_sap_suffix(name)
                                    })
                                    if is_pk:
                                        pks.append(name)
                                tables[table_name] = {
                                    "description": data.get("description", ""),
                                    "fields": fields,
                                    "pks": pks,
                                    "data_product": "foundation"
                                }
                        except Exception as e:
                            print(f"Warning: Failed to parse foundation annotation file {file_path}: {e}", file=sys.stderr)

    # Parse data product tables (target & siblings)
    for d in dp_dirs:
        dp_name = os.path.basename(d)
        annotations_dir = os.path.join(d, "annotations")
        
        if os.path.exists(annotations_dir):
            for root, _, files in os.walk(annotations_dir):
                for file in files:
                    if file.endswith((".yaml", ".yml")):
                        file_path = os.path.join(root, file)
                        table_name = os.path.splitext(file)[0].lower()
                        with open(file_path, "r") as f:
                            try:
                                data = yaml.safe_load(f)
                                if data and "fields" in data:
                                    fields = []
                                    pks = []
                                    for field in data["fields"]:
                                        name = field.get("name")
                                        desc = field.get("description", "")
                                        is_pk = (
                                            "pk" in desc.lower()
                                            or "primary key" in desc.lower()
                                            or is_inferred_pk(table_name, name)
                                        )
                                        fields.append({
                                            "name": name,
                                            "description": desc,
                                            "is_pk": is_pk,
                                            "sap_suffix": get_sap_suffix(name)
                                        })
                                        if is_pk:
                                            pks.append(name)
                                    tables[table_name] = {
                                        "description": data.get("description", ""),
                                        "fields": fields,
                                        "pks": pks,
                                        "data_product": dp_name
                                    }
                            except Exception as e:
                                print(f"Warning: Failed to parse annotation file {file_path}: {e}", file=sys.stderr)
                                
        # Parse definitions for tables without annotations
        definitions_dir = os.path.join(d, "definitions")
        if os.path.exists(definitions_dir):
            for root, _, files in os.walk(definitions_dir):
                for file in files:
                    if file.endswith(".js"):
                        table_name = os.path.splitext(file)[0].lower()
                        if table_name not in tables:
                            tables[table_name] = {
                                "description": f"Dataform table defined in {table_name}.js",
                                "fields": [],
                                "pks": [],
                                "data_product": dp_name
                            }

    # Infer relationships based on SAP suffix name matching
    relationships = []
    table_names = list(tables.keys())
    
    for i in range(len(table_names)):
        for j in range(len(table_names)):
            if i == j:
                continue
            t1 = table_names[i]
            t2 = table_names[j]
            
            # Look for a PK in T1 and match its SAP suffix with any field in T2
            for pk_field in tables[t1]["fields"]:
                if not pk_field["is_pk"]:
                    continue
                s1 = pk_field["sap_suffix"]
                if not s1:
                    continue
                    
                # Check if this suffix matches any field in T2
                for f2 in tables[t2]["fields"]:
                    s2 = f2["sap_suffix"]
                    if s1 == s2:
                        # Establish the link from T1 (holding the PK) to T2 (holding the FK)
                        relationships.append({
                            "from_table": t1,
                            "to_table": t2,
                            "from_field": pk_field["name"],
                            "to_field": f2["name"],
                            "type": "one_to_many"
                        })
                        
    # Deduplicate relationships and enforce clean direction (foundation -> data product)
    unique_relationships = []
    seen = set()
    for r in relationships:
        t1, t2 = r["from_table"], r["to_table"]
        f1, f2 = r["from_field"], r["to_field"]
        
        # Enforce direction: foundation always acts as "from_table" (parent)
        is_f1_foundation = tables[t1]["data_product"] == "foundation"
        is_f2_foundation = tables[t2]["data_product"] == "foundation"
        
        if is_f1_foundation and not is_f2_foundation:
            dir_from, dir_to = t1, t2
            dir_f1, dir_f2 = f1, f2
        elif not is_f1_foundation and is_f2_foundation:
            dir_from, dir_to = t2, t1
            dir_f1, dir_f2 = f2, f1
        else:
            if t1 < t2:
                dir_from, dir_to = t1, t2
                dir_f1, dir_f2 = f1, f2
            else:
                dir_from, dir_to = t2, t1
                dir_f1, dir_f2 = f2, f1
                
        key = (dir_from, dir_to, dir_f1, dir_f2)
        if key not in seen:
            seen.add(key)
            unique_relationships.append({
                "from_table": dir_from,
                "to_table": dir_to,
                "from_field": dir_f1,
                "to_field": dir_f2,
                "type": "one_to_many"
            })
            
    # Filter Registry: Keep only the target product's tables, its foundation dependencies, and their direct relatives
    target_tables = {t: info for t, info in tables.items() if info["data_product"] == target_name}
    
    related_table_names = set(target_tables.keys())
    for t in target_foundation_dependencies:
        if t in tables:
            related_table_names.add(t)
            
    filtered_relationships = []
    for r in unique_relationships:
        f_in_target = r["from_table"] in related_table_names
        t_in_target = r["to_table"] in related_table_names
        if f_in_target or t_in_target:
            related_table_names.add(r["from_table"])
            related_table_names.add(r["to_table"])
            filtered_relationships.append(r)
            
    filtered_tables = {t: tables[t] for t in related_table_names}
            
    return {
        "manifest": manifest,
        "tables": filtered_tables,
        "relationships": filtered_relationships
    }

def get_visible_fields(table_name, info, relationships, show_all_foundation=False, limit_data_product=True):
    """
    Get the list of fields to display for a table, and the count of hidden fields.
    Returns (visible_fields_list, hidden_fields_count).
    """
    fields = info["fields"]
    is_foundation = info["data_product"] == "foundation"
    
    # Check if we should display all fields
    if (is_foundation and show_all_foundation) or (not is_foundation and not limit_data_product):
        return fields, 0
        
    # Otherwise, filter fields: keep only PKs and relationship-participating fields
    rel_fields = set()
    for rel in relationships:
        if rel["from_table"] == table_name:
            rel_fields.add(rel["from_field"])
        if rel["to_table"] == table_name:
            rel_fields.add(rel["to_field"])
            
    visible_fields = []
    hidden_count = 0
    for field in fields:
        if field["is_pk"] or field["name"] in rel_fields:
            visible_fields.append(field)
        else:
            hidden_count += 1
            
    return visible_fields, hidden_count

def generate_mermaid(dp_data, show_all_foundation=False, limit_data_product=True):
    """
    Generate Mermaid ER diagram.
    """
    lines = ["erDiagram"]
    
    for table_name, info in dp_data["tables"].items():
        lines.append(f"    {table_name} {{")
        
        visible, hidden_count = get_visible_fields(
            table_name, info, dp_data["relationships"],
            show_all_foundation, limit_data_product
        )
        
        # List PK fields first
        for field in visible:
            if field["is_pk"]:
                sanitized_name = re.sub(r"[^a-zA-Z0-9_]", "_", field["name"])
                lines.append(f"        string {sanitized_name} PK")
        # List other fields
        for field in visible:
            if not field["is_pk"]:
                sanitized_name = re.sub(r"[^a-zA-Z0-9_]", "_", field["name"])
                lines.append(f"        string {sanitized_name}")
                
        if hidden_count > 0:
            lines.append(f"        string other_fields_count_{hidden_count}")
            
        lines.append("    }")
        
    for rel in dp_data["relationships"]:
        sanitized_label = re.sub(r"[^a-zA-Z0-9_ ]", "_", rel["to_field"])
        lines.append(f"    {rel['from_table']} ||--o{{ {rel['to_table']} : \"{sanitized_label}\"")
        
    return "\n".join(lines)

def generate_dot(dp_data, show_all_foundation=False, limit_data_product=True):
    """
    Generate Graphviz DOT diagram.
    """
    lines = [
        "digraph ERD {",
        "    graph [pad=\"0.5\", nodesep=\"0.5\", ranksep=\"1.2\"];",
        "    node [shape=plain];",
        "    rankdir=LR;",
        ""
    ]
    
    for table_name, info in dp_data["tables"].items():
        label = [
            f'<<table border="0" cellborder="1" cellspacing="0" cellpadding="4">',
            f'    <tr><td bgcolor="#2c3e50" align="center"><font color="#ffffff"><b>{table_name}</b></font></td></tr>'
        ]
        
        visible, hidden_count = get_visible_fields(
            table_name, info, dp_data["relationships"],
            show_all_foundation, limit_data_product
        )
        
        # PK fields
        for field in visible:
            if field["is_pk"]:
                label.append(f'    <tr><td port="{field["name"]}" align="left" bgcolor="#ecf0f1"><b>{field["name"]} [PK]</b></td></tr>')
                
        # All non-PK fields
        for field in visible:
            if not field["is_pk"]:
                label.append(f'    <tr><td port="{field["name"]}" align="left">{field["name"]}</td></tr>')
            
        if hidden_count > 0:
            label.append(f'    <tr><td align="left" bgcolor="#f8f9fa"><font color="#7f8c8d"><i>... + {hidden_count} more fields</i></font></td></tr>')
            
        label.append("</table>>")
        label_str = "\n".join(label)
        
        lines.append(f'    {table_name} [label={label_str}];')
        
    lines.append("")
    for rel in dp_data["relationships"]:
        lines.append(f'    {rel["from_table"]}:{rel["from_field"]} -> {rel["to_table"]}:{rel["to_field"]} [label="{rel["to_field"]}"];')
        
    lines.append("}")
    return "\n".join(lines)

def generate_drawio(dp_data, show_all_foundation=False, limit_data_product=True):
    """
    Generate draw.io mxGraph XML with a beautiful radial/circular layout and dynamic width/height calculation.
    """
    import math
    
    def estimate_table_width(info, visible_fields):
        # Start with default or table name length
        max_len = 15
        
        displayed_fields = visible_fields
        for f in displayed_fields:
            label_len = len(f["name"])
            if f["is_pk"]:
                label_len += 12 # padding for PK text and key icon
            else:
                label_len += 4 # padding for bullet icon
            max_len = max(max_len, label_len)
            
        # 1 char ~ 7.2px at font size 12
        estimated = int(max_len * 7.2) + 45
        return max(240, estimated)
        
    mxfile = ET.Element("mxfile", {
        "host": "Electron",
        "modified": "2026-06-01T00:00:00.000Z",
        "agent": "CortexERD",
        "version": "20.0.0",
        "type": "device"
    })
    diagram = ET.SubElement(mxfile, "diagram", {"id": "erd_page_1", "name": "ERD Page-1"})
    mxGraphModel = ET.SubElement(diagram, "mxGraphModel", {
        "dx": "2500", "dy": "2500", "grid": "1", "gridSize": "10",
        "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
        "fold": "1", "page": "1", "pageScale": "1", "pageWidth": "2400",
        "pageHeight": "1800", "math": "0", "shadow": "0"
    })
    root = ET.SubElement(mxGraphModel, "root")
    
    # Standard layer cells
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    
    # 1. Classify tables into columns
    target_name = dp_data.get("manifest", {}).get("type", "")
    
    left_column_tables = []
    center_column_tables = []
    right_column_tables = []
    
    # Calculate widths and heights
    table_dimensions = {}
    table_visible_fields = {}
    table_hidden_counts = {}
    
    for table_name, info in dp_data["tables"].items():
        vis, hid = get_visible_fields(
            table_name, info, dp_data["relationships"],
            show_all_foundation, limit_data_product
        )
        table_visible_fields[table_name] = vis
        table_hidden_counts[table_name] = hid
        
        w = estimate_table_width(info, vis)
        num_rows = len(vis) + (1 if hid > 0 else 0)
        h = 65 + num_rows * 20
        table_dimensions[table_name] = (w, h)
        
        dp = info.get("data_product", "")
        if dp == "foundation":
            left_column_tables.append(table_name)
        elif dp == target_name:
            center_column_tables.append(table_name)
        else:
            right_column_tables.append(table_name)
            
    # Sort tables in columns alphabetically for stability
    left_column_tables.sort()
    center_column_tables.sort()
    right_column_tables.sort()
    
    if not center_column_tables and right_column_tables:
        # Fallback: if no target table matches manifest type, treat right column tables as center
        center_column_tables = right_column_tables
        right_column_tables = []
        
    # Column configuration
    col_gap = 180
    row_gap = 60
    start_x = 100
    start_y = 100
    
    # Calculate max width of each column
    max_w_left = max([table_dimensions[t][0] for t in left_column_tables], default=0)
    max_w_center = max([table_dimensions[t][0] for t in center_column_tables], default=0)
    max_w_right = max([table_dimensions[t][0] for t in right_column_tables], default=0)
    
    # Calculate column X coordinates
    col_x = {}
    current_x = start_x
    
    if left_column_tables:
        col_x["left"] = current_x
        current_x += max_w_left + col_gap
        
    if center_column_tables:
        col_x["center"] = current_x
        current_x += max_w_center + col_gap
        
    if right_column_tables:
        col_x["right"] = current_x
        
    # Calculate total height of each column
    col_heights = {}
    if left_column_tables:
        col_heights["left"] = sum(table_dimensions[t][1] for t in left_column_tables) + (len(left_column_tables) - 1) * row_gap
    if center_column_tables:
        col_heights["center"] = sum(table_dimensions[t][1] for t in center_column_tables) + (len(center_column_tables) - 1) * row_gap
    if right_column_tables:
        col_heights["right"] = sum(table_dimensions[t][1] for t in right_column_tables) + (len(right_column_tables) - 1) * row_gap
        
    # Center columns vertically relative to the tallest column
    max_total_h = max(col_heights.values(), default=600)
    
    table_positions = {}
    
    # Place tables for each column
    def place_column_tables(tables_list, col_key, max_w):
        if not tables_list:
            return
        col_h = col_heights[col_key]
        y_offset = start_y + (max_total_h - col_h) // 2
        
        for t in tables_list:
            w, h = table_dimensions[t]
            x_pos = col_x[col_key] + (max_w - w) // 2
            table_positions[t] = (x_pos, y_offset, w, h)
            y_offset += h + row_gap
            
    place_column_tables(left_column_tables, "left", max_w_left)
    place_column_tables(center_column_tables, "center", max_w_center)
    place_column_tables(right_column_tables, "right", max_w_right)
    
    # 2. Create cells for each table
    for table_name, info in dp_data["tables"].items():
        x, y, w, h = table_positions[table_name]
        vis = table_visible_fields[table_name]
        hidden_count = table_hidden_counts[table_name]
        
        # Prepare cell HTML value
        value_parts = [f"<b>{table_name}</b>", "<div style=\"border-bottom: 1px solid #cccccc; margin-top: 4px; margin-bottom: 8px;\"></div>"]
        for field in vis:
            if field["is_pk"]:
                value_parts.append(f"🔑 <b>{field['name']}</b> (PK)")
        
        for field in vis:
            if not field["is_pk"]:
                value_parts.append(f"🔹 {field['name']}")
                
        if hidden_count > 0:
            value_parts.append(f"<i>... + {hidden_count} more fields</i>")
            
        value_html = "<br>".join(value_parts)
        
        style = (
            "rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;"
            "spacing=8;fillColor=#f5f5f5;strokeColor=#666666;fontFamily=Helvetica;"
            "fontSize=12;glass=0;shadow=0;"
        )
        
        mxCell = ET.SubElement(root, "mxCell", {
            "id": f"tbl_{table_name}",
            "value": value_html,
            "style": style,
            "vertex": "1",
            "parent": "1"
        })
        ET.SubElement(mxCell, "mxGeometry", {
            "x": str(x),
            "y": str(y),
            "width": str(w),
            "height": str(h),
            "as": "geometry"
        })
            
    # 4. Relationships / Edges
    edge_id = 0
    for rel in dp_data["relationships"]:
        edge_id += 1
        style = (
            "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;"
            "jettySize=auto;html=1;endArrow=classic;endFill=1;"
            "strokeColor=#2980b9;strokeWidth=1.5;fontColor=#2c3e50;"
        )
        mxCell = ET.SubElement(root, "mxCell", {
            "id": f"edge_{edge_id}",
            "value": f"{rel['from_field']} -> {rel['to_field']}",
            "style": style,
            "edge": "1",
            "parent": "1",
            "source": f"tbl_{rel['from_table']}",
            "target": f"tbl_{rel['to_table']}"
        })
        ET.SubElement(mxCell, "mxGeometry", {
            "relative": "1",
            "as": "geometry"
        })
        
    # Convert tree to string representation
    return ET.tostring(mxfile, encoding="utf-8").decode("utf-8")

def main():
    parser = argparse.ArgumentParser(description="Generate ER diagram for a Cortex V7 Data Product")
    parser.add_argument("-p", "--path", help="Path to or name of the data product folder")
    parser.add_argument("-f", "--format", choices=["dot", "mermaid", "drawio"], help="Diagram format")
    parser.add_argument("-o", "--output", help="Explicit path for output file")
    parser.add_argument("--all-foundation-fields", action="store_true", help="Render all fields for foundation tables (by default only keys and relationship-participating fields are shown)")
    parser.add_argument("--all-data-product-fields", action="store_true", help="Render all fields for data product tables (by default only keys and relationship-participating fields are shown)")
    parser.add_argument("--include-siblings", action="store_true", help="Include sibling data products in the same namespace to map cross-product relationships")
    
    args = parser.parse_args()
    
    # 1. Determine path
    if not args.path:
        print("Error: Data product name or path is required (--path).", file=sys.stderr)
        sys.exit(1)
        
    dp_dir = find_data_product_dir(args.path)
    if not dp_dir:
        print(f"Error: Could not locate data product directory for '{args.path}'.", file=sys.stderr)
        sys.exit(1)
        
    print(f"Analyzing data product in: {dp_dir}")
    
    # 2. Prompt format if not specified
    format_to_use = args.format
    if not format_to_use:
        print("No output format specified. Defaulting to 'mermaid'.")
        format_to_use = "mermaid"
        
    # 3. Parse data product (optionally including cross-product sibling relationships)
    dp_data = parse_data_product(dp_dir, include_siblings=args.include_siblings)
    
    if not dp_data["tables"]:
        print(f"Error: No tables or annotations found in data product: {dp_dir}", file=sys.stderr)
        sys.exit(1)
        
    # 4. Generate diagram content
    limit_dp = not args.all_data_product_fields
    if format_to_use == "mermaid":
        content = generate_mermaid(dp_data, args.all_foundation_fields, limit_dp)
        ext = "mmd"
    elif format_to_use == "dot":
        content = generate_dot(dp_data, args.all_foundation_fields, limit_dp)
        ext = "dot"
    elif format_to_use == "drawio":
        content = generate_drawio(dp_data, args.all_foundation_fields, limit_dp)
        ext = "drawio"
        
    # 5. Determine output file path
    dp_name = os.path.basename(dp_dir)
    output_path = args.output
    if not output_path:
        output_path = os.path.join(dp_dir, f"{dp_name}_erd.{ext}")
        
    # 6. Write output file
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Successfully generated {format_to_use} ER diagram at:")
    print(f"  {output_path}")

    # 7. Write Markdown preview file if format is mermaid
    if format_to_use == "mermaid":
        md_path = os.path.splitext(output_path)[0] + ".md"
        md_content = f"# {dp_name} ER Diagram\n\n```mermaid\n{content}\n```\n"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"Successfully generated markdown preview at:")
        print(f"  {md_path}")

if __name__ == "__main__":
    main()
