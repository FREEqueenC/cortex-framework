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

from google.api_core.exceptions import NotFound
from google.cloud import bigquery

logger = logging.getLogger(__name__)


class BigQueryManager:
    """Manages operations for BigQuery."""

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
                except NotFound:
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
        except NotFound:
            return None
        except Exception as e:
            logger.error(
                "Could not verify dataset %s.%s due to error: %s",
                project_id,
                dataset_id,
                e,
            )
            raise

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
            tables = client.list_tables(source_dataset_ref)
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
