```python
import json
import logging
import os
import pathlib
import pytest

logger = logging.getLogger(__name__)

# Replace '<target_table_name>' with the expected physical table name of the data product (e.g. custom_test_customers)
TARGET_TABLE_NAME = "<target_table_name>"

def test_data_product_sql_logic(generated_workspace):
    """Verifies that the compiled SQL query for the data product meets the design assumptions and logic."""
    manifest_path = pathlib.Path(generated_workspace) / "manifest.json"
    if not manifest_path.exists():
        pytest.skip("Dataform manifest.json not found. Compile step likely failed.")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Find the target query in the compiled tables or operations list
    target_query = None
    target_fileName = None
    
    for table in manifest.get("tables", []):
        name = table.get("target", {}).get("name")
        if name == TARGET_TABLE_NAME:
            target_query = table.get("query")
            target_fileName = table.get("fileName")
            break

    if not target_query:
        for operation in manifest.get("operations", []):
            name = operation.get("target", {}).get("name")
            if name == TARGET_TABLE_NAME:
                # Use first query if operations has multiple
                queries = operation.get("queries", [])
                if queries:
                    target_query = queries[0]
                    target_fileName = operation.get("fileName")
                break

    assert target_query is not None, f"Query for target '{TARGET_TABLE_NAME}' not found in compiled workspace manifest."

    sql_upper = target_query.upper()

    # 1. Assert correct tables are joined
    # Example: Assert we are joining KNA1 and ADRC
    assert "KNA1" in sql_upper, f"Source table KNA1 missing from query in {target_fileName}"
    assert "ADRC" in sql_upper, f"Source table ADRC missing from query in {target_fileName}"

    # 2. Assert key join condition columns are present
    assert "KUNNR" in sql_upper, "Join/filter key 'KUNNR' missing from compiled SQL query"

    # 3. Assert filtering logic (e.g., client/mandt filter)
    # Check that a client filter is applied in the WHERE/ON clause
    assert "MANDT" in sql_upper, "Client filter 'MANDT' missing from compiled SQL query"

    # 4. Assert specific transformed/coalesced fields exist
    # Example: Check for coalesced postal codes
    assert "COALESCE" in sql_upper, "Coalescing logic for nullable fields missing from compiled SQL query"

    # 5. Assert key/important fields are selected/projected
    # Example: Check that the final customer name field and ID are selected
    assert "CUSTOMER_NUMBER_KUNNR" in sql_upper, "Projected field 'customer_number_kunnr' missing from SELECT statement"
    assert "NAME1_NAME1" in sql_upper, "Projected field 'name1_name1' missing from SELECT statement"
```
