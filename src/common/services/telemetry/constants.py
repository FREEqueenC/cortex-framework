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

from enum import StrEnum

"""Global constants for the telemetry user agent"""

projects_exclusions_list: list[str] = ["961357902656"]

bq_telemetry_endpoint: str = "https://bigquery.googleapis.com/bigquery/v2/projects/%s/datasets/%s"
dataform_telemetry_endpoint: str = (
    "https://dataform.googleapis.com/v1/projects/%s/locations/%s/repositories/%s"
)
telemetry_consent_filename: str = "cortex-framework-consent.properties"
telemetry_consent_property_name: str = "enable_telemetry"

# gcp-cortex-eng/framework/$VERSION/$COMPONENT/$TYPE/$VARIANT/$OPTIONAL_EXT/$STATUS
user_agent_prefix: str = "gcp-cortex-eng"
solution_name: str = "framework"

# TODO: externalize in version.yaml
solution_version: str = "7.0.0"

# Tuned to balance between parallism and avoiding API rate limits
max_thread_pool_workers: int = 20


class TelemetryStatus(StrEnum):
    BUILT = "built"
    ERROR = "error"
    SUCCESS = "success"
    DEPLOYED = "deployed"
    POST_DEPLOY_SUCCESS = "post-deploy-success"
    POST_DEPLOY_ERROR = "post-deploy-error"
    REGISTERED = "registered"
    UPDATED = "updated"
    UNINSTALLED = "uninstalled"


class TelemetryComponent(StrEnum):
    PLATFORM = "platform"
    DATA_PRODUCT = "data-product"
    FOUNDATION = "foundation"


class TelemetryPlatformTool(StrEnum):
    BUILDER = "builder"
    DEPLOYER = "deployer"
    KNOWLEDGE_CATALOG = "knowledge-catalog"
