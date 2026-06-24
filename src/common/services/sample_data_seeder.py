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
import uuid
from collections.abc import Iterable
from typing import Any

from common.clients import bigquery, resource_manager, storage
from common.schemas.config_schema import GlobalConfig, SAPModuleConfig

logger = logging.getLogger(__name__)


class SampleDataSeeder:
    """Provides sample data seeding from public GCS parquet files via ephemeral buckets."""

    _PUBLIC_BUCKET = "cortex-framework-public"
    _PUBLIC_PREFIX = "demo-sample-data/rel700"

    def __init__(self, global_config: GlobalConfig):
        """Initializes the SampleDataSeeder.

        Args:
            global_config: The global configuration object.

        Returns:
            None
        """
        self.global_config = global_config
        self.bq_client = bigquery.BigQueryManager()
        self.resource_manager_client = resource_manager.ResourceManagerClient()
        self.storage_client: storage.StorageManager | None = None

    def _get_ephemeral_bucket_name(self, project_id: str, location: str) -> str:
        """Generates a deterministic, globally unique, and valid GCS bucket name."""
        try:
            # Use project number for consistency and anonymity
            proj_identifier = self.resource_manager_client.get_project_number(project_id)
            return f"cortex-demo-seed-{proj_identifier}-{location.lower()}"
        except Exception as e:
            logger.warning("Failed to fetch project number for %s", project_id, exc_info=e)
            raise ValueError(f"Failed to fetch project number for {project_id}") from e

    def _ensure_ephemeral_bucket(
        self,
        bucket_name: str,
        location: str,
        storage_client: storage.StorageManager,
    ) -> bool:
        """Ensures that the ephemeral bucket exists in the target region.

        Args:
            bucket_name: The GCS bucket name.
            location: The location (region) where the bucket should be created.
            storage_client: The StorageManager client to use.

        Returns:
            True if the bucket exists or was successfully created, False otherwise.
        """
        logger.info("Ensuring ephemeral bucket %s exists...", bucket_name)
        try:
            if not storage_client.bucket_exists(bucket_name):
                if not storage_client.create_bucket(bucket_name, location=location):
                    logger.error("Failed to create ephemeral bucket %s", bucket_name)
                    return False
            else:
                logger.info(
                    "Ephemeral bucket %s already exists. Skipping creation.",
                    bucket_name,
                )
            return True
        except Exception as e:
            logger.error("Error ensuring ephemeral bucket %s exists: %s", bucket_name, e)
            return False

    def _extract_table_names(self, blobs: Iterable[Any], prefix: str) -> list[str]:
        """Extracts sorted unique table names from a list of GCS blobs.

        Args:
            blobs: The list of GCS blob objects.
            prefix: The GCS folder prefix (e.g. 'run-id/sap/s4').

        Returns:
            A sorted list of unique table names.
        """
        table_names = set()
        prefix_len = len(prefix.strip("/")) + 1
        for blob in blobs:
            # blob.name looks like: {run_id}/sap/s4/{table_name}/xxx.parquet
            relative_name = blob.name[prefix_len:]
            if "/" in relative_name:
                table_name = relative_name.split("/")[0]
                table_names.add(table_name)
        return sorted(list(table_names))

    def seed_sample_data(self) -> bool:
        """Seeds sample data to all applicable target datasets defined in config."""
        bq_location = self.global_config.data.big_query_location
        all_modules = list(self.global_config.data.modules.foundation)
        all_successful = True

        for module in all_modules:
            if not module.enabled:
                continue

            source_config = self.global_config.get_data_source(module.data_source_id)
            if not source_config:
                logger.error("Failed to resolve data source %s", module.data_source_id)
                all_successful = False
                continue

            dest_project = source_config.project_id
            dest_dataset = source_config.dataset_id
            module_type = module.type
            sap_version = "s4"  # Default to s4 if not specified
            if isinstance(module, SAPModuleConfig):
                sap_version = module.module_settings.sap_version

            if module_type != "sap":
                logger.warning("Module type %s not supported for GCS seeding.", module_type)
                continue

            if not dest_project or not dest_dataset:
                logger.error("Destination project or dataset not fully configured.")
                all_successful = False
                continue

            run_id = uuid.uuid4().hex
            ephemeral_bucket = self._get_ephemeral_bucket_name(dest_project, bq_location)
            storage_client = self.storage_client or storage.StorageManager(project_id=dest_project)

            try:
                # Step 1: Ensure Ephemeral Bucket in target region
                if not self._ensure_ephemeral_bucket(
                    ephemeral_bucket, location=bq_location, storage_client=storage_client
                ):
                    all_successful = False
                    continue

                # Step 2: Copy public GCS files selective folder to Ephemeral Bucket
                source_prefix = f"{self._PUBLIC_PREFIX}/sap/{sap_version}"
                dest_prefix = f"{run_id}/sap/{sap_version}"

                logger.info("Copying seed files to ephemeral bucket...")
                if not storage_client.copy_objects(
                    source_bucket_name=self._PUBLIC_BUCKET,
                    source_prefix=source_prefix,
                    dest_bucket_name=ephemeral_bucket,
                    dest_prefix=dest_prefix,
                ):
                    logger.error("Failed to copy objects from public bucket to ephemeral bucket.")
                    all_successful = False
                    continue

                # Step 3: Load tables concurrently from ephemeral bucket to BigQuery
                # Path format: sap/{sap_version}/{table_id}/xxx.parquet
                try:
                    blobs = storage_client._client.list_blobs(ephemeral_bucket, prefix=dest_prefix)
                    # Extract unique table folders under sap/{sap_version}/
                    tables_to_load = self._extract_table_names(blobs, prefix=dest_prefix)
                except Exception as list_err:
                    logger.error(
                        "Failed to dynamically list tables in ephemeral bucket: %s",
                        list_err,
                    )
                    all_successful = False
                    continue

                logger.info(
                    "Loading %d dynamically discovered SAP tables into BigQuery...",
                    len(tables_to_load),
                )

                def _load_single_table(
                    table: str,
                    bucket: str = ephemeral_bucket,
                    prefix: str = dest_prefix,
                    proj: str = dest_project,
                    dataset: str = dest_dataset,
                ) -> bool:
                    # Files inside the folder follow specific pattern
                    # 'sap/<sap_version>/<table_id>/<sequence>.parquet'
                    gcs_uris = [f"gs://{bucket}/{prefix}/{table}/*.parquet"]
                    logger.info("Loading table %s...", table)
                    return self.bq_client.load_table_from_parquet(
                        project_id=proj,
                        dataset_id=dataset,
                        table_id=table,
                        gcs_uris=gcs_uris,
                        write_disposition="WRITE_TRUNCATE",
                    )

                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                    results = list(executor.map(_load_single_table, tables_to_load))

                if not all(results):
                    logger.error("One or more BigQuery table loads failed.")
                    all_successful = False

            except Exception as e:
                logger.exception("An error occurred during seeding: %s", e)
                all_successful = False
            finally:
                # Step 4: Ensure ephemeral bucket is deleted on completion/error
                logger.info(
                    "Cleaning up ephemeral bucket %s...",
                    ephemeral_bucket,
                )
                try:
                    storage_client.delete_bucket(ephemeral_bucket, force=True)
                except Exception as cleanup_err:
                    logger.warning(
                        "Failed to clean up ephemeral bucket %s: %s",
                        ephemeral_bucket,
                        cleanup_err,
                    )

        return all_successful
