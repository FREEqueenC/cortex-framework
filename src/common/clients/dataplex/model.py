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

from collections.abc import Mapping
from dataclasses import dataclass, field


@dataclass(frozen=True)
class DataProductInfo:
    """Represents basic information about a Data Product.

    Attributes:
        id: The id of the Data Product.
        resource_name: The full resource name of the Data Product. Format:
          "projects/{project_id}/locations/{location_id}/dataProducts/{data_product_id}".
        display_name: The display name of the Data Product.
        description: The description of the Data Product.
        owner_emails: A tuple of email addresses of the owners of the Data Product.
        labels: The labels of the Data Product.
    """

    id: str
    display_name: str
    project_id: str
    location: str
    owner_emails: tuple[str, ...]
    labels: Mapping[str, str] = field(default_factory=dict, compare=False, hash=False)
    description: str | None = None
    documentation: str | None = None

    # Adding canonicalization logic to faciliate comparisons between DataProductInfo objects
    def __post_init__(self) -> None:
        sorted_emails = tuple(sorted(self.owner_emails))
        if sorted_emails != self.owner_emails:
            object.__setattr__(self, "owner_emails", sorted_emails)

        if self.description == "":
            object.__setattr__(self, "description", None)

        if self.documentation == "":
            object.__setattr__(self, "documentation", None)

    @property
    def resource_name(self) -> str:
        return f"projects/{self.project_id}/locations/{self.location}/dataProducts/{self.id}"


@dataclass(frozen=True)
class DataAssetInfo:
    """Represents basic information about a Data Asset.

    Attributes:
        id: The id of the Data Asset.
        resource_name: The full resource name of the Data Asset. Format:
          "projects/{project_id}/locations/{location_id}/dataProducts/{data_product_id}/dataAssets/{data_asset_id}".
        linked_resource: The linked resource of the Data Asset, follow a cloud resource name format
          (e.g. "//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}", or
          "//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}")
    """

    id: str
    linked_resource: str
    resource_name: str | None = field(default=None, compare=False, hash=False)

    @staticmethod
    def build_bigquery_linked_resource_name(
        project_id: str, dataset_id: str, table_id: str | None = None
    ) -> str:
        """Builds the linked resource name for a BigQuery table or dataset.

        Args:
            project_id: The project id of the bigquery table.
            dataset_id: The dataset id of the bigquery table.
            table_id: The table id of the bigquery table.

        Returns:
            The linked resource name of the bigquery table or dataset.
        """
        if table_id:
            return (
                f"//bigquery.googleapis.com/projects/{project_id}/"
                f"datasets/{dataset_id}/tables/{table_id}"
            )
        return f"//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}"


@dataclass(frozen=True)
class DataProduct:
    """Represents a Data Product with deep references to its assets.

    Attributes:
        data_product_info: Information about the Data Product.
        data_assets: A tuple of Data Assets in the Data Product.
    """

    data_product_info: DataProductInfo
    data_assets: tuple[DataAssetInfo, ...] = ()


@dataclass(frozen=True)
class BigQueryTableInfo:
    """Represents a bigquery table.

    Attributes:
        dataset_id: The id of the bigquery dataset.
        table_id: The id of the bigquery table.
    """

    dataset_id: str
    table_id: str


@dataclass(frozen=True)
class BigQueryAssetLinks:
    """Represents bigquery resources that can be linked as an asset to a Data Product.
       All the assets are expected to exist in the same project.

    Attributes:
        dataset_ids: The ids of the bigquery datasets to link.
        table_infos: The bigquery tables to link.
        bigquery_project_id: The project id of the bigquery datasets.
    """

    dataset_ids: tuple[str, ...] = ()
    table_infos: tuple[BigQueryTableInfo, ...] = ()
    bigquery_project_id: str | None = None

    def __post_init__(self):
        if len(self.table_infos) > 50:
            raise ValueError("Number of table for a data product exceeds the limit of 50")
