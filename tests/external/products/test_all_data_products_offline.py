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

"""Offline unit tests for the entire compiled Dataform workspace."""

import json
import logging
import os

import pytest

logger = logging.getLogger(__name__)


def test_syntax_validation_all_compiled_queries(zetasql_validator, generated_workspace):
    """Test syntax validation for every compiled query in the generated workspace."""
    if not os.path.exists(generated_workspace / "manifest.json"):
        pytest.skip("Manifest not found. Previous compile step likely skipped or failed.")

    with open(generated_workspace / "manifest.json") as f:
        manifest = json.load(f)

    validated_count = 0
    failed_queries = []

    # Collect all actions that have queries
    actions_with_queries = []

    for action in manifest.get("tables", []):
        if action.get("query"):
            actions_with_queries.append(action)

    for action in manifest.get("operations", []):
        if action.get("queries"):
            # Operations can have multiple queries
            for q in action.get("queries"):
                actions_with_queries.append(
                    {"target": action.get("target"), "fileName": action.get("fileName"), "query": q}
                )

    for action in actions_with_queries:
        table_name = action.get("target", {}).get("name", "Unknown")
        file_name = action.get("fileName", "Unknown")

        # Restrict testing strictly to Data Products, ignoring the Data Foundation
        if "products" not in file_name.lower():
            continue

        sql = action.get("query")

        logger.info(f"\n{'=' * 60}\nValidating target: {table_name}\nFile: {file_name}\n{'=' * 60}")
        logger.info(f"SQL statement:\n{sql}\n{'-' * 60}")

        is_valid, error = zetasql_validator.validate_syntax(sql)
        if not is_valid:
            failed_queries.append(f"Target '{table_name}' in '{file_name}': {error}")
            logger.error(f"[FAIL] {table_name} syntax is invalid: {error}\n")
        else:
            validated_count += 1
            logger.info(f"[OK] {table_name} syntax is valid.\n")

    if failed_queries:
        failures_str = "\n".join(failed_queries)
        pytest.fail(
            f"ZetaSQL syntax errors found in {len(failed_queries)} queries:\n{failures_str}"
        )

    assert validated_count > 0, "No compiled queries found in the manifest."
