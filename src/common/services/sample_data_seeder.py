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
from collections.abc import Iterable
from typing import Any

from common.clients import storage
from common.clients.bq import bigquery
from common.errors import CortexGcpError
from common.schemas.config_schema import GlobalConfig, SAPModuleConfig

logger = logging.getLogger(__name__)


class SampleDataSeeder:
    """Provides sample data seeding from region-specific public GCS parquet files."""

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
        self.storage_client: storage.StorageManager | None = None

    def _get_public_bucket_name(self, location: str) -> str:
        """Constructs the standardized region-specific public bucket name.

        Args:
            location: The GCP region or BigQuery location (e.g. 'US', 'us-central1', 'EU').

        Returns:
            The region-specific public GCS bucket name.
        """
        clean_location = location.strip().lower()
        return f"{self._PUBLIC_BUCKET}-{clean_location}"

    def _extract_table_names(self, blobs: Iterable[Any], prefix: str) -> list[str]:
        """Extracts sorted unique table names from a list of GCS blobs.

        Args:
            blobs: The list of GCS blob objects.
            prefix: The GCS folder prefix (e.g. 'demo-sample-data/rel700/sap/s4').

        Returns:
            A sorted list of unique table names.
        """
        table_names = set()
        prefix_len = len(prefix.strip("/")) + 1
        for blob in blobs:
            # blob.name looks like: {prefix}/{table_name}/xxx.parquet
            relative_name = blob.name[prefix_len:]
            if "/" in relative_name:
                table_name = relative_name.split("/")[0]
                table_names.add(table_name)
        return sorted(list(table_names))

    def seed_sample_data(self) -> bool:
        """Seeds sample data directly from the region-specific public bucket to BigQuery."""
        bq_location = self.global_config.data.big_query_location
        if not bq_location:
            raise CortexGcpError(
                "BigQuery location is not configured in GlobalConfig.",
                hint="Specify --bigquery_location in demo arguments or config.",
            )

        public_bucket = self._get_public_bucket_name(bq_location)
        storage_client = self.storage_client or storage.StorageManager()

        foundation_mods = getattr(self.global_config.data.modules, "foundation", [])
        product_mods = getattr(self.global_config.data.modules, "product", [])
        all_modules = list(foundation_mods) + list(product_mods)
        all_successful = True
        loaded_datasets: set[tuple[str, str]] = set()

        for module in all_modules:
            ds_id = getattr(module, "data_source_id", None)
            if not module.enabled or not ds_id:
                continue

            source_config = self.global_config.get_dataset(ds_id)
            if not source_config:
                logger.error("Failed to resolve data source %s", ds_id)
                all_successful = False
                continue

            dest_project = source_config.project_id
            dest_dataset = source_config.dataset_id
            module_path = module.module_path
            sap_version = "s4"  # Default to s4 if not specified
            if isinstance(module, SAPModuleConfig):
                sap_version = module.module_settings.sap_version

            if module.module_type != "sap":
                logger.warning("Module type %s not supported for GCS seeding.", module_path)
                continue

            if not dest_project or not dest_dataset:
                logger.error("Destination project or dataset not fully configured.")
                all_successful = False
                continue

            dataset_key = (dest_project, dest_dataset)
            if dataset_key in loaded_datasets:
                logger.info(
                    "Sample data for target dataset %s.%s already loaded; skipping redundant load.",
                    dest_project,
                    dest_dataset,
                )
                continue

            source_prefix = f"{self._PUBLIC_PREFIX}/sap/{sap_version}"

            try:
                blobs = list(storage_client._client.list_blobs(public_bucket, prefix=source_prefix))
                tables_to_load = self._extract_table_names(blobs, prefix=source_prefix)
            except Exception as list_err:
                logger.error(
                    "Failed to dynamically list tables in public bucket %s: %s",
                    public_bucket,
                    list_err,
                )
                raise CortexGcpError(
                    f"Failed to access sample data in bucket '{public_bucket}' under prefix "
                    f"'{source_prefix}': {list_err}",
                    hint="Ensure public read access (roles/storage.objectViewer) is enabled.",
                ) from list_err

            if not tables_to_load:
                raise CortexGcpError(
                    f"No sample data found in bucket '{public_bucket}' under prefix "
                    f"'{source_prefix}'.",
                    hint=(
                        "Verify that public sample data files have been published to "
                        f"'gs://{public_bucket}/{source_prefix}'."
                    ),
                )

            logger.info(
                "Loading %d dynamically discovered SAP tables from %s into BigQuery...",
                len(tables_to_load),
                public_bucket,
            )

            def _load_single_table(
                table: str,
                bucket: str = public_bucket,
                prefix: str = source_prefix,
                proj: str = dest_project,
                dataset: str = dest_dataset,
            ) -> bool:
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
            else:
                loaded_datasets.add(dataset_key)

        return all_successful
