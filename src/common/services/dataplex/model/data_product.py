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

from dataclasses import dataclass


@dataclass(frozen=True)
class ManifestInfo:
    """Represents the manifest information of a data product.

    Attributes:
        owner_emails: The list of email addresses of the owners.
        dependencies: A tuple of dependencies definitions (the name of the depeendency
                      in the manifest.yaml file) of the data product.
        display_name: An optional display name of the data product.
        description: An optional description of the data product.
        documentation: An optional link to the documentation of the data product.
    """

    module_type: str
    category: str
    display_name: str | None = None
    description: str | None = None
    documentation: str | None = None


@dataclass(frozen=True)
class DeploymentInfo:
    """Represents the deployment information of a data product.

    Attributes:
        id: The id of the data product.
        project_id: The id of the project.
        location: The location of the data product based on its dataset location.
        bigquery_dataset_id: The id of the bigquery dataset.
        bigquery_table_ids: The ids of the bigquery tables created in the above dataset.
        manifest_info: The manifest information of the data product.
    """

    id: str
    project_id: str
    location: str
    bigquery_dataset_id: str
    manifest_info: ManifestInfo
    bigquery_table_ids: tuple[str, ...] = ()
