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

import concurrent.futures
import logging

from google.api_core import exceptions as api_exceptions
from google.api_core import retry
from google.cloud import bigquery

from common.clients.bq.model import TableInfo
from common.clients.model import exception as exceptions

logger = logging.getLogger(__name__)


class BigQueryManager:
    """Manages operations for BigQuery."""

    _bigquery_read_retry = retry.Retry(
        predicate=retry.if_exception_type(
            api_exceptions.ResourceExhausted,
            api_exceptions.ServiceUnavailable,
            api_exceptions.DeadlineExceeded,
        ),
        initial=3.0,
        maximum=60.0,
        multiplier=2.0,
        deadline=300.0,
    )

    def __init__(
        self,
        clients: dict[str, bigquery.Client] | None = None,
    ):
        """Initializes the BigQueryManager.

        Args:
            clients: A dictionary of pre-configured BigQuery clients keyed by
              project ID. This is intended for testing purposes only (e.g.,
              injecting mock clients).
        """
        self._clients = clients or {}

    def _get_client(self, project_id: str) -> bigquery.Client:
        """Gets or creates a BigQuery client for the given project."""
        if project_id not in self._clients:
            self._clients[project_id] = bigquery.Client(project=project_id)
        return self._clients[project_id]

    def ensure_datasets(
        self,
        datasets: list[tuple[str, str]],
        location: str = "US",
    ) -> bool:
        """Ensures that all datasets in the list exist."""
        all_successful = True

        for project_id, dataset_id in datasets:
            logger.info("Ensuring dataset %s:%s exists...", project_id, dataset_id)
            try:
                client = self._get_client(project_id)
                dataset_ref = f"{project_id}.{dataset_id}"
                try:
                    client.get_dataset(dataset_ref)
                except api_exceptions.NotFound:
                    logger.info(
                        "Creating dataset %s:%s in location %s",
                        project_id,
                        dataset_id,
                        location,
                    )
                    dataset = bigquery.Dataset(dataset_ref)
                    dataset.location = location
                    client.create_dataset(dataset, timeout=30)
            except Exception as e:
                logger.error(
                    "Failed to ensure dataset %s:%s: %s",
                    project_id,
                    dataset_id,
                    e,
                )
                all_successful = False

        return all_successful

    def create_dataset(self, project_id: str, dataset_id: str, location: str = "US") -> bool:
        """Creates a dataset without checking if it exists."""
        logger.info("Creating dataset %s:%s in location %s", project_id, dataset_id, location)
        try:
            client = self._get_client(project_id)
            dataset_ref = f"{project_id}.{dataset_id}"
            dataset = bigquery.Dataset(dataset_ref)
            dataset.location = location
            client.create_dataset(dataset, timeout=30)
            return True
        except Exception as e:
            logger.error("Failed to create dataset %s:%s: %s", project_id, dataset_id, e)
            return False

    def get_dataset(self, project_id: str, dataset_id: str) -> bigquery.Dataset | None:
        """Retrieves a dataset, returns None if not found."""
        try:
            client = self._get_client(project_id)
            dataset_ref = f"{project_id}.{dataset_id}"
            return client.get_dataset(dataset_ref)
        except api_exceptions.NotFound:
            return None
        except Exception as e:
            logger.error(
                "Could not verify dataset %s.%s due to error: %s",
                project_id,
                dataset_id,
                e,
            )
            raise

    def is_dataset_in_location(self, project_id: str, dataset_id: str, location: str) -> bool:
        """Checks if a dataset exists in the specified location (primary location or replica).

        Args:
            project_id: GCP project ID.
            dataset_id: BigQuery dataset ID.
            location: Expected BigQuery location.

        Returns:
            bool: True if dataset primary location or replica matches the expected location.
        """
        dataset = self.get_dataset(project_id, dataset_id)
        if not dataset:
            return False

        actual_location = getattr(dataset, "location", None)
        if actual_location and actual_location.upper() == location.upper():
            return True

        try:
            client = self._get_client(project_id)
            query = (
                "SELECT 1 FROM INFORMATION_SCHEMA.SCHEMATA "
                "WHERE schema_name = @dataset_id AND LOWER(location) = LOWER(@location)"
            )
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("dataset_id", "STRING", dataset_id),
                    bigquery.ScalarQueryParameter("location", "STRING", location),
                ]
            )
            results = list(client.query(query, location=location, job_config=job_config).result())
            return len(results) > 0
        except Exception as e:
            logger.warning(
                "Could not check replica dataset location for %s.%s in %s: %s",
                project_id,
                dataset_id,
                location,
                e,
            )
            return False

    def copy_tables(
        self,
        *,  # Enforce keyword arguments
        source_project: str,
        source_dataset: str,
        source_location: str,
        dest_project: str,
        dest_dataset: str,
        dest_location: str,
        write_disposition: str = "WRITE_TRUNCATE",
    ) -> bool:
        """Copies all tables from source dataset to destination dataset.

        Args:
            source_project: Source GCP Project ID.
            source_dataset: Source Dataset ID.
            source_location: Source Dataset Location.
            dest_project: Destination GCP Project ID.
            dest_dataset: Destination Dataset ID.
            dest_location: Destination Dataset Location.
            write_disposition: BigQuery WriteDisposition.

        Returns:
            bool: True if all tables copied successfully, False otherwise.
        """
        if source_location != dest_location:
            logger.error(
                "Cross-region copy is not supported via copy_table. Source: %s, Dest: %s",
                source_location,
                dest_location,
            )
            return False

        client = self._get_client(dest_project)
        source_dataset_ref = f"{source_project}.{source_dataset}"
        dest_dataset_ref = f"{dest_project}.{dest_dataset}"

        try:
            tables = client.list_tables(source_dataset_ref, retry=self._bigquery_read_retry)
        except Exception as e:
            logger.error("Failed to list tables in %s: %s", source_dataset_ref, e)
            return False

        all_successful = True

        def _copy_single_table(source_ref: str, dest_ref: str, t_id: str) -> bool:
            logger.info("Creating seed data for %s in %s...", t_id, dest_dataset_ref)
            try:
                _job_config = bigquery.CopyJobConfig()
                _job_config.write_disposition = write_disposition
                _job = client.copy_table(source_ref, dest_ref, job_config=_job_config)
                _job.result()
                logger.info("Created seed data for %s successfully.", t_id)
                return True
            except Exception as e:
                logger.error("Failed to create seed data for %s: %s", t_id, e)
                return False

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_table = {
                executor.submit(
                    _copy_single_table,
                    f"{source_dataset_ref}.{table.table_id}",
                    f"{dest_dataset_ref}.{table.table_id}",
                    table.table_id,
                ): table.table_id
                for table in tables
            }

            for future in concurrent.futures.as_completed(future_to_table):
                if not future.result():
                    all_successful = False

        return all_successful

    def delete_dataset(
        self,
        project_id: str,
        dataset_id: str,
        delete_contents: bool = True,
        not_found_ok: bool = True,
    ) -> bool:
        """Deletes a BigQuery dataset."""
        logger.info("Deleting dataset %s:%s", project_id, dataset_id)
        try:
            client = self._get_client(project_id)
            dataset_ref = f"{project_id}.{dataset_id}"
            client.delete_dataset(
                dataset_ref, delete_contents=delete_contents, not_found_ok=not_found_ok
            )
            logger.info("Dataset %s:%s deleted successfully.", project_id, dataset_id)
            return True
        except Exception as e:
            logger.warning("Failed to delete dataset %s:%s: %s", project_id, dataset_id, e)
            return False

    def load_table_from_parquet(
        self,
        *,
        project_id: str,
        dataset_id: str,
        table_id: str,
        gcs_uris: list[str],
        write_disposition: str = "WRITE_TRUNCATE",
    ) -> bool:
        """Loads GCS Parquet files directly into a BigQuery table with schema auto-detection.

        Args:
            project_id: Target GCP Project ID.
            dataset_id: Target Dataset ID.
            table_id: Target Table ID.
            gcs_uris: List of GCS URIs containing the Parquet files.
            write_disposition: BigQuery WriteDisposition.

        Returns:
            bool: True if the load job finished successfully, False otherwise.
        """
        dest_table_ref = f"{project_id}.{dataset_id}.{table_id}"
        logger.info("Loading parquet data from %s into %s...", gcs_uris, dest_table_ref)
        try:
            client = self._get_client(project_id)
            job_config = bigquery.LoadJobConfig(
                source_format=bigquery.SourceFormat.PARQUET,
                write_disposition=write_disposition,
                autodetect=True,
            )
            load_job = client.load_table_from_uri(gcs_uris, dest_table_ref, job_config=job_config)
            load_job.result()  # Wait for the job to complete
            logger.info("Loaded table %s successfully.", dest_table_ref)
            return True
        except Exception as e:
            logger.error("Failed to load table %s from Parquet: %s", dest_table_ref, e)
            return False

    def validate_tables_existence(
        self, *, project_id: str, dataset_id: str, table_ids: tuple[str, ...]
    ) -> list[str]:
        """Validates that all tables in the list exist in the given dataset.

        Args:
            project_id: BigQuery project ID.
            dataset_id: BigQuery dataset ID.
            table_ids: Tuple of BigQuery table IDs.

        Returns:
            list[str]: List of missing table IDs.

        Raises:
            IllegalArgumentError: If project_id or dataset_id is empty.
        """
        if not table_ids:
            logger.info("Empty table ids list, nothing to check")
            return []

        if not dataset_id:
            raise exceptions.IllegalArgumentError("Dataset id cannot be empty")

        if not project_id:
            raise exceptions.IllegalArgumentError("Project id cannot be empty")

        client = self._get_client(project_id)
        dataset_name = f"{project_id}.{dataset_id}"

        try:
            tables = client.list_tables(dataset_name, retry=self._bigquery_read_retry)
        except Exception as e:
            raise exceptions.FailedOperationError(
                f"Failed to list bigquery tables in {dataset_name}"
            ) from e

        existing_tables = {table.table_id for table in tables}

        missing_tables = sorted([tid for tid in table_ids if tid not in existing_tables])

        return missing_tables

    def list_dataset_tables(self, *, project_id: str, dataset_id: str) -> list[TableInfo]:
        """Lists all tables in a BigQuery dataset with their metadata (labels).

        Args:
            project_id: BigQuery project ID.
            dataset_id: BigQuery dataset ID.

        Returns:
            list[TableInfo]: List of TableInfo dataclasses representing the tables.

        Raises:
            IllegalArgumentError: If project_id or dataset_id is empty.
            FailedOperationError: If the operation fails.
        """
        if not dataset_id:
            raise exceptions.IllegalArgumentError("Dataset id cannot be empty")

        if not project_id:
            raise exceptions.IllegalArgumentError("Project id cannot be empty")

        client = self._get_client(project_id)
        dataset_name = f"{project_id}.{dataset_id}"
        try:
            tables = list(client.list_tables(dataset_name, retry=self._bigquery_read_retry))
        except Exception as e:
            raise exceptions.FailedOperationError(
                f"Failed to list bigquery tables in {dataset_name} with cause {str(e)}"
            ) from e

        table_infos = [
            TableInfo(
                id=table.table_id,
                dataset_id=dataset_id,
                labels=table.labels or {},
            )
            for table in tables
        ]

        table_infos.sort(key=lambda t: t.id)
        return table_infos
