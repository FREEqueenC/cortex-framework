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

import logging
import threading

from common.clients.bq import bigquery
from common.clients.model import exception as common_client_exception
from common.utils import labels

logger = logging.getLogger(__name__)


class DataProductTableResolver:
    def __init__(self, *, bigquery_client: bigquery.BigQueryManager) -> None:
        """Initialize the DataProductTableResolver with a bigquery client.

        Args:
            bigquery_client: The BigQuery client used to retrieve tables info.
        """

        self._bigquery_client = bigquery_client
        self._table_cache: dict[tuple[str, str], list[bigquery.TableInfo]] = {}
        self._cache_lock = threading.Lock()

    def resolve_data_product_tables(
        self, *, project_id: str, dataset_id: str, data_product_type_fqn: str
    ) -> list[str]:
        """
        Returns the list of all tables in the given dataset.

        Args:
            project_id: The Google Cloud project id.
            dataset_id: The BigQuery dataset id.

            data_product_type_fqn: The fully qualified namespaced type of the data
              product (e.g. cortex.sap.s4.accounting_documents).

        Returns:
            A list of table names.
        """

        if not project_id:
            raise ValueError("Project id is required.")
        if not dataset_id:
            raise ValueError("Dataset id is required.")
        if not data_product_type_fqn:
            raise ValueError("Data product type fqn is required.")

        table_infos: list[bigquery.TableInfo] | None = None
        cache_key = (project_id, dataset_id)

        with self._cache_lock:
            if cache_key in self._table_cache:
                table_infos = self._table_cache[cache_key]

        canonical_module_type = labels.get_canonical_module_type(data_product_type_fqn)
        data_product_type_fqn_label_value = labels.get_module_labels(
            namespaced_type=data_product_type_fqn
        )[labels.LABEL_NAMESPACED_MODULE_TYPE]

        if table_infos is None:
            try:
                table_infos = self._bigquery_client.list_dataset_tables(
                    project_id=project_id, dataset_id=dataset_id
                )
            except common_client_exception.ClientError as e:
                logger.error(
                    "Failed to list bigquery tables in %s.%s: %s",
                    project_id,
                    dataset_id,
                    str(e),
                )
                return []

        with self._cache_lock:
            self._table_cache[cache_key] = table_infos

        filtered_tables: list[str] = []
        for table_info in table_infos:
            table_labels = table_info.labels
            if table_labels is None:
                continue
            if (
                table_labels.get(labels.LABEL_NAMESPACED_MODULE_TYPE)
                == data_product_type_fqn_label_value
                or table_labels.get(labels.LABEL_MODULE_TYPE) == canonical_module_type
            ):
                filtered_tables.append(table_info.id)

        return filtered_tables
