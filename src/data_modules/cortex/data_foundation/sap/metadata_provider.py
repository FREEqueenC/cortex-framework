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

"""Provides metadata retrieval functionality for BigQuery tables."""

import logging

from google.api_core import exceptions as google_exceptions
from google.cloud import bigquery

logger = logging.getLogger(__name__)


class MetadataProvider:
    """Base class for retrieving database schemas and keys."""

    def get_schema_and_keys(
        self, project_id: str, dataset_id: str, table: str
    ) -> tuple[list[str], list[str], dict[str, str]]:
        raise NotImplementedError


class BigQueryMetadataProvider(MetadataProvider):
    """Provider for retrieving table schemas and primary keys from BigQuery."""

    def __init__(
        self,
        project_id: str,
        dataset_id: str,
        tables: list[str] | None = None,
        client: bigquery.Client | None = None,
    ):
        if client:
            self.client = client
        else:
            self.client = bigquery.Client()
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.tables = tables

        self.table_columns: dict[str, list[str]] = {}
        self.table_column_types: dict[str, dict[str, str]] = {}
        self.table_pks: dict[str, list[str]] = {}

    def fetch(self):
        """Fetches schema and primary keys from BigQuery concurrently."""
        logger.info("Fetching metadata from %s.%s...", self.project_id, self.dataset_id)

        # Custom tables and fields in SAP have the prefix "/NAMESPACE/",
        # which are renamed to "NAMESPACE_" (or other character, per SLT settings)
        # when replicated to BigQuery, but retain their original naming in DD03L
        # table. So we need to mirror the replacement logic in the query to
        # get records for such tables.
        #
        # For example, "/OPT/Z_TABLE" is replicated to "OPT_Z_TABLE" in BigQuery.
        replace_char = "_"
        sap_naming_replace_logic = (
            "REPLACE("
            '  IF(SUBSTR({FIELD}, 1, 1) = "/", SUBSTR({FIELD}, 2), {FIELD}),'
            '  "/",'
            f'  "{replace_char}"'
            ")"
        )
        bq_field_name = sap_naming_replace_logic.format(FIELD="fieldname")
        bq_table_name = sap_naming_replace_logic.format(FIELD="tabname")

        # 1. Fetch Columns and Types
        table_filter = ""
        table_filter_dd03l = ""
        if self.tables:
            formatted_tables = ", ".join([f"'{t.upper()}'" for t in self.tables])
            table_filter = f" WHERE UPPER(table_name) IN ({formatted_tables})"
            table_filter_dd03l = f" AND UPPER({bq_table_name}) IN ({formatted_tables})"

        schema_query = f"""
            SELECT table_name, column_name, data_type
            FROM `{self.project_id}.{self.dataset_id}.INFORMATION_SCHEMA.COLUMNS`
            {table_filter}
        """

        # 2. Fetch Keys from DD03L
        pk_query = f"""
            SELECT DISTINCT {bq_table_name} as tabname, {bq_field_name} as fieldname
            FROM `{self.project_id}.{self.dataset_id}.dd03l`
            WHERE (keyflag = 'X' OR keyflag = 'TRUE')
              AND fieldname != '.INCLUDE'
              {table_filter_dd03l}
        """

        pk_query_upper = f"""
            SELECT DISTINCT {bq_table_name} as tabname, {bq_field_name} as fieldname
            FROM `{self.project_id}.{self.dataset_id}.DD03L`
            WHERE (keyflag = 'X' OR keyflag = 'TRUE')
              AND fieldname != '.INCLUDE'
              {table_filter_dd03l}
        """

        def fetch_schema():
            try:
                results = self.client.query(schema_query).result()
                for row in results:
                    t = row["table_name"].upper()
                    c = row["column_name"].lower()
                    d_type = row["data_type"].upper()
                    if t not in self.table_columns:
                        self.table_columns[t] = []
                        self.table_column_types[t] = {}
                    if c not in self.table_columns[t]:
                        self.table_columns[t].append(c)
                    self.table_column_types[t][c] = d_type
                logger.info(
                    "Fetched %s schema columns across %d tables from INFORMATION_SCHEMA.",
                    getattr(results, "total_rows", "unknown number of"),
                    len(self.table_columns),
                )
            except google_exceptions.GoogleAPIError as e:
                logger.warning("Failed to fetch schema from Information Schema: %s", e)

        def fetch_pks():
            # First try lowercase table query
            try:
                results = list(self.client.query(pk_query).result())
                logger.info(
                    "Fetched %d primary key records from lowercase dd03l table.", len(results)
                )
            except google_exceptions.NotFound as e:
                logger.info("Lowercase dd03l not found. Trying uppercase DD03L fallback...")
                try:
                    results = list(self.client.query(pk_query_upper).result())
                    logger.info(
                        "Fetched %d primary key records from uppercase DD03L table.",
                        len(results),
                    )
                except google_exceptions.NotFound:
                    # Both tables are missing
                    raise ValueError(
                        f"Neither lowercase 'dd03l' nor uppercase 'DD03L' tables "
                        f"were found in dataset {self.project_id}.{self.dataset_id}."
                    ) from e

            for row in results:
                t = row["tabname"].upper()
                c = row["fieldname"].lower()
                if t not in self.table_pks:
                    self.table_pks[t] = []
                if c not in self.table_pks[t]:
                    self.table_pks[t].append(c)
            logger.info(
                "Loaded primary key definitions for %d tables from DD03L.",
                len(self.table_pks),
            )

        fetch_schema()
        fetch_pks()

    def get_schema_and_keys(
        self, project_id: str, dataset_id: str, table: str
    ) -> tuple[list[str], list[str], dict[str, str]]:
        t = table.upper()

        columns = self.table_columns.get(t, [])
        column_types = self.table_column_types.get(t, {})
        pks = self.table_pks.get(t, [])

        if not columns:
            columns = ["mandt", "recordstamp", "operation_flag"]
            column_types = {
                "mandt": "STRING",
                "recordstamp": "TIMESTAMP",
                "operation_flag": "STRING",
            }

        if not pks:
            raise ValueError(
                f"Could not determine primary keys for table {t} in"
                f" {project_id}.{dataset_id}. Ensure DD03L is populated correctly and"
                " the table has key fields defined."
            )

        return columns, pks, column_types
