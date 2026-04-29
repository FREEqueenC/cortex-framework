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

from unittest import mock

from google.cloud import bigquery

from data_modules.cortex.data_foundation.sap.metadata_provider import BigQueryMetadataProvider


def test_fetch_with_sap_namespace_logic():
    # Arrange
    mock_client = mock.MagicMock(spec=bigquery.Client)

    # Setup mock query results to avoid exceptions during fetch
    mock_query_job = mock.MagicMock()
    mock_query_job.result.return_value = []
    mock_client.query.return_value = mock_query_job

    provider = BigQueryMetadataProvider(
        project_id="test_project",
        dataset_id="test_dataset",
        tables=["/OPT/Z_TABLE", "MARA"],
        client=mock_client,
    )

    # Act
    provider.fetch()

    # Assert
    # Collect all queries executed
    executed_queries = [call.args[0] for call in mock_client.query.call_args_list]
    assert len(executed_queries) > 0, "Queries should have been executed"

    # We expect schema_query, pk_query, and potentially pk_query_upper to be executed.
    schema_query = next((q for q in executed_queries if "INFORMATION_SCHEMA" in q), None)
    assert schema_query is not None
    assert "UPPER(table_name) IN ('/OPT/Z_TABLE', 'MARA')" in schema_query

    pk_query = next((q for q in executed_queries if "dd03l" in q), None)
    assert pk_query is not None

    # Verify that the replace logic for sap naming is in the query
    expected_replace_logic_table = (
        'REPLACE(  IF(SUBSTR(tabname, 1, 1) = "/", SUBSTR(tabname, 2), tabname),  "/",  "_")'
    )
    expected_replace_logic_field = (
        'REPLACE(  IF(SUBSTR(fieldname, 1, 1) = "/", SUBSTR(fieldname, 2), fieldname),  "/",  "_")'
    )

    assert expected_replace_logic_table in pk_query
    assert expected_replace_logic_field in pk_query

    # Check that table filter uses the transformed bq_table_name
    assert f"UPPER({expected_replace_logic_table}) IN ('/OPT/Z_TABLE', 'MARA')" in pk_query


def test_fetch_populates_results_correctly():
    # Arrange
    mock_client = mock.MagicMock(spec=bigquery.Client)

    # Setup mock query results
    def mock_query_side_effect(query):
        mock_job = mock.MagicMock()
        if "INFORMATION_SCHEMA.COLUMNS" in query:
            mock_job.result.return_value = [
                {"table_name": "OPT_Z_TABLE", "column_name": "mandt", "data_type": "STRING"},
                {"table_name": "OPT_Z_TABLE", "column_name": "opt_field", "data_type": "STRING"},
            ]
        elif "dd03l" in query or "DD03L" in query:
            mock_job.result.return_value = [{"tabname": "OPT_Z_TABLE", "fieldname": "mandt"}]
        return mock_job

    mock_client.query.side_effect = mock_query_side_effect

    provider = BigQueryMetadataProvider(
        project_id="test_project",
        dataset_id="test_dataset",
        client=mock_client,
    )

    # Act
    provider.fetch()

    # Assert
    columns, pks, types = provider.get_schema_and_keys(
        "test_project", "test_dataset", "OPT_Z_TABLE"
    )
    assert columns == ["mandt", "opt_field"]
    assert pks == ["mandt"]
    assert types == {"mandt": "STRING", "opt_field": "STRING"}
