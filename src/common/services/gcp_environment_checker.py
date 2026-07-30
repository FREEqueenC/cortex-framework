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

from google.api_core.exceptions import GoogleAPICallError
from google.auth.exceptions import GoogleAuthError

from common.clients.bigquery_reservation import BigQueryReservationClient
from common.clients.bq.bigquery import BigQueryManager
from common.clients.resource_manager import ResourceManagerClient
from common.clients.service_usage import ServiceUsageClient
from common.errors import CortexGcpError
from common.schemas.config_schema import GlobalConfig

logger = logging.getLogger(__name__)


class GcpEnvironmentChecker:
    """Service for checking and validating GCP project environment and required APIs."""

    def __init__(
        self,
        config: GlobalConfig,
        seeder_enabled: bool = False,
        enable_apis: bool = False,
        create_datasets: bool = False,
        bq_manager: BigQueryManager | None = None,
        service_usage_client: ServiceUsageClient | None = None,
        resource_manager_client: ResourceManagerClient | None = None,
        bq_reservation_client: BigQueryReservationClient | None = None,
    ):
        """Initializes the environment checker.

        Args:
            config: The global configuration instance.
            seeder_enabled: Whether sample data seeding is enabled.
            enable_apis: Whether to automatically enable missing APIs without prompting.
            create_datasets: Whether to automatically create missing datasets without prompting.
            bq_manager: Optional injected BigQueryManager client.
            service_usage_client: Optional injected ServiceUsageClient.
            resource_manager_client: Optional injected ResourceManagerClient.
            bq_reservation_client: Optional injected BigQueryReservationClient.
        """
        self.config = config
        self.seeder_enabled = seeder_enabled
        self.enable_apis = enable_apis
        self.create_datasets = create_datasets
        self._service_usage_client = service_usage_client
        self._bq_manager = bq_manager
        self._resource_manager_client = resource_manager_client
        self._bq_reservation_client = bq_reservation_client

    @property
    def service_usage_client(self) -> ServiceUsageClient:
        """Gets the ServiceUsageClient instance.

        Returns:
            The active ServiceUsageClient instance.
        """
        if self._service_usage_client is None:
            self._service_usage_client = ServiceUsageClient()
        return self._service_usage_client

    @property
    def bq_manager(self) -> BigQueryManager:
        """Gets the BigQueryManager instance.

        Returns:
            The active BigQueryManager instance.
        """
        if self._bq_manager is None:
            self._bq_manager = BigQueryManager()
        return self._bq_manager

    @property
    def resource_manager_client(self) -> ResourceManagerClient:
        """Gets the ResourceManagerClient instance.

        Returns:
            The active ResourceManagerClient instance.
        """
        if self._resource_manager_client is None:
            self._resource_manager_client = ResourceManagerClient()
        return self._resource_manager_client

    @property
    def bq_reservation_client(self) -> BigQueryReservationClient:
        """Gets the BigQueryReservationClient instance.

        Returns:
            The active BigQueryReservationClient instance.
        """
        if self._bq_reservation_client is None:
            self._bq_reservation_client = BigQueryReservationClient()
        return self._bq_reservation_client

    def validate_all(self) -> bool:
        """Runs all GCP environment validations sequentially.

        Returns:
            True if all validation checks pass.
        """
        logger.info("Starting GCP Environment validations...")
        logger.info("Step 1: Validating required APIs...")
        self.validate_apis()
        logger.info("Step 2: Validating datasets...")
        self.validate_datasets()
        logger.info("Step 3: Validating dataset locations...")
        self.validate_dataset_location()
        logger.info("Step 4: Validating catalog capacity reservations...")
        self.validate_catalog_capacity()
        logger.info("All GCP Environment validations passed.")
        return True

    def _prompt_and_act(self, missing_items, flag, prompt_msg, action_fn) -> bool:
        """Consolidates the check -> prompt -> act flow.

        Args:
            missing_items: The sequence of missing items to resolve.
            flag: Automatic resolution flag (if True, acts without prompting).
            prompt_msg: The prompt string to display to the user if flag is False.
            action_fn: The callback function to execute on missing_items.

        Returns:
            True if resolved or no missing items, False if stopped or resolution failed.
        """
        if not missing_items:
            return True

        if flag:
            return action_fn(missing_items)

        response = input(prompt_msg)
        if response.lower() in ["y", "yes"]:
            return action_fn(missing_items)
        else:
            return False

    def _get_required_apis(self) -> dict[str, set[str]]:
        """Gathers required GCP APIs per project from configuration.

        Returns:
            A mapping of project ID strings to sets of required API service names.
        """
        required_apis: dict[str, set[str]] = {}

        # BigQuery APIs
        dataset_projects = {d.project_id for d in self.config.data.datasets}

        for proj in dataset_projects:
            required_apis.setdefault(proj, set()).add("bigquery.googleapis.com")

        # Storage APIs (only if seeder is enabled)
        if self.seeder_enabled:
            source_projects = set()
            foundation_mods = getattr(self.config.data.modules, "foundation", [])
            product_mods = getattr(self.config.data.modules, "product", [])
            all_modules = list(foundation_mods) + list(product_mods)
            for mod in all_modules:
                ds_id = getattr(mod, "data_source_id", None)
                if mod.enabled and ds_id:
                    source = self.config.get_dataset(ds_id)
                    source_projects.add(source.project_id)
            for proj in source_projects:
                required_apis.setdefault(proj, set()).add("storage.googleapis.com")

        # BigLake Delta Sharing APIs (if catalogs are specified and enabled)
        for catalog in getattr(self.config.data.modules, "catalogs", []):
            if catalog.enabled:
                proj = catalog.connection_settings.project_id
                required_apis.setdefault(proj, set()).add("biglake.googleapis.com")
                required_apis.setdefault(proj, set()).add("bigquery.googleapis.com")
                required_apis.setdefault(proj, set()).add("bigqueryreservation.googleapis.com")
                required_apis.setdefault(proj, set()).add("cloudresourcemanager.googleapis.com")

        # Dataform APIs
        if self.config.deployment and self.config.deployment.targets:
            for target in self.config.deployment.targets:
                if target.enabled and target.type.value == "dataform":
                    settings = target.target_settings
                    if settings is not None:
                        if isinstance(settings, dict):
                            repo_project = settings.get("repository_project_id")
                        else:
                            repo_project = settings.repository_project_id

                        if repo_project:
                            required_apis.setdefault(repo_project, set()).add(
                                "dataform.googleapis.com"
                            )

        return required_apis

    def validate_apis(self) -> bool:
        """Validates and optionally enables required APIs across project environment.

        Returns:
            True if all required APIs are enabled.

        Raises:
            CortexGcpError: If required APIs cannot be checked or enabled.
        """
        logger.info("Validating required APIs...")
        required_apis = self._get_required_apis()

        for project_id, apis in required_apis.items():
            missing = []
            for api in apis:
                try:
                    if not self.service_usage_client.is_api_enabled(project_id, api):
                        missing.append(api)
                except (GoogleAPICallError, GoogleAuthError) as e:
                    raise CortexGcpError(
                        f"Unable to check API '{api}' on project '{project_id}' due to error: {e}",
                        hint=(
                            "Verify your Google Cloud credentials and that project "
                            f"'{project_id}' exists and is accessible."
                        ),
                    ) from e

            if missing:
                logger.warning("Missing APIs on project %s: %s", project_id, missing)

                def action(m, pid=project_id):
                    logger.info("Enabling missing APIs on project %s...", pid)
                    return all(self.service_usage_client.enable_api(pid, api) for api in m)

                if not self._prompt_and_act(
                    missing,
                    self.enable_apis,
                    f"APIs {missing} are missing on project {project_id}. Enable them? [Y/n]: ",
                    action,
                ):
                    apis_str = ", ".join(missing)
                    raise CortexGcpError(
                        f"APIs [{apis_str}] are required but not enabled on project '{project_id}'",
                        hint=(
                            f"Enable the required APIs using: gcloud services enable {apis_str} "
                            f"--project={project_id}"
                        ),
                    )

        return True

    def _get_target_datasets(self) -> set[tuple[str, str]]:
        """Collects all target dataset tuples (project_id, dataset_id) from config.

        Returns:
            A set of (project_id, dataset_id) tuples.
        """
        target_datasets = set()
        foundation_mods = getattr(self.config.data.modules, "foundation", [])
        product_mods = getattr(self.config.data.modules, "product", [])
        all_modules = list(foundation_mods) + list(product_mods)
        for mod in all_modules:
            tgt_id = getattr(mod, "data_target_id", None)
            if mod.enabled and not getattr(mod, "external", False) and tgt_id:
                target = self.config.get_dataset(tgt_id)
                target_datasets.add((target.project_id, target.dataset_id))

        if self.seeder_enabled:
            for mod in all_modules:
                ds_id = getattr(mod, "data_source_id", None)
                if mod.enabled and ds_id:
                    source = self.config.get_dataset(ds_id)
                    target_datasets.add((source.project_id, source.dataset_id))

        return target_datasets

    def _get_source_datasets(self) -> set[tuple[str, str]]:
        """Collects all source dataset tuples (project_id, dataset_id) from config.

        Returns:
            A set of (project_id, dataset_id) tuples.
        """
        source_datasets = set()
        if not self.seeder_enabled:
            foundation_mods = getattr(self.config.data.modules, "foundation", [])
            product_mods = getattr(self.config.data.modules, "product", [])
            all_modules = list(foundation_mods) + list(product_mods)
            for mod in all_modules:
                ds_id = getattr(mod, "data_source_id", None)
                if mod.enabled and ds_id:
                    source = self.config.get_dataset(ds_id)
                    source_datasets.add((source.project_id, source.dataset_id))
        return source_datasets

    def validate_datasets(self) -> bool:
        """Validates that all datasets defined in the configuration exist.

        Prompts before creating unless self.create_datasets is True.

        Returns:
            True if all required source and target datasets exist or are created.

        Raises:
            CortexGcpError: If required datasets are missing or creation fails.
        """
        logger.info("Validating datasets...")
        default_location = self.config.data.big_query_location

        target_datasets = self._get_target_datasets()
        source_datasets = self._get_source_datasets()

        missing_sources = []
        for proj, ds in source_datasets:
            if not self.bq_manager.get_dataset(proj, ds):
                missing_sources.append((proj, ds))

        if missing_sources:
            formatted_sources = ", ".join([f"'{proj}.{ds}'" for proj, ds in missing_sources])
            raise CortexGcpError(
                f"Source datasets are missing: {formatted_sources}",
                hint=(
                    "Verify that the source datasets exist in BigQuery and the dataset "
                    "names are spelled correctly in config.yaml."
                ),
            )

        missing_targets = []
        for proj, ds in target_datasets:
            if not self.bq_manager.get_dataset(proj, ds):
                missing_targets.append((proj, ds))

        if not missing_targets:
            logger.info("All required datasets exist.")
            return True

        logger.info("The following datasets are missing:\n%s", missing_targets)

        def action(m):
            logger.info("Creating missing datasets...")
            all_success = True
            for proj, ds in m:
                if not self.bq_manager.create_dataset(proj, ds, location=default_location):
                    all_success = False
            return all_success

        formatted_targets = "\n".join([f"- {ds} ({proj})" for proj, ds in missing_targets])
        prompt_msg = (
            f"The following datasets are missing:\n{formatted_targets}\nCreate them? [Y/n]: "
        )
        if not self._prompt_and_act(missing_targets, self.create_datasets, prompt_msg, action):
            targets_str = ", ".join([f"'{proj}.{ds}'" for proj, ds in missing_targets])
            raise CortexGcpError(
                f"Target datasets are missing and could not be created: {targets_str}",
                hint=("Run with '--create-datasets' or create the datasets manually in BigQuery."),
            )

        return True

    def validate_dataset_location(self) -> bool:
        """Validates that all source and existing target datasets match the expected location.

        Returns:
            True if all dataset locations match config.data.big_query_location.

        Raises:
            CortexGcpError: If any dataset location mismatches or source dataset is missing.
        """
        logger.info("Validating dataset locations...")
        expected_location = self.config.data.big_query_location

        mismatches = []

        # Validate source datasets (must exist and be in the expected location or replica)
        source_datasets = self._get_source_datasets()
        for project_id, dataset_id in source_datasets:
            if not self.bq_manager.is_dataset_in_location(
                project_id, dataset_id, expected_location
            ):
                dataset = self.bq_manager.get_dataset(project_id, dataset_id)
                if dataset:
                    actual_location = getattr(dataset, "location", None)
                    mismatches.append(
                        f"Source dataset '{project_id}.{dataset_id}' is in location "
                        f"'{actual_location}', expected '{expected_location}'"
                    )
                else:
                    mismatches.append(f"Source dataset '{project_id}.{dataset_id}' does not exist")

        # Validate target datasets (if they exist, must be in the expected location or replica)
        target_datasets = self._get_target_datasets()
        for project_id, dataset_id in target_datasets:
            dataset = self.bq_manager.get_dataset(project_id, dataset_id)
            if dataset and not self.bq_manager.is_dataset_in_location(
                project_id, dataset_id, expected_location
            ):
                actual_location = getattr(dataset, "location", None)
                mismatches.append(
                    f"Target dataset '{project_id}.{dataset_id}' is in location "
                    f"'{actual_location}', expected '{expected_location}'"
                )

        if mismatches:
            mismatches_str = "\n".join(f"  - {m}" for m in mismatches)
            raise CortexGcpError(
                f"Dataset validations failed:\n{mismatches_str}",
                hint=(
                    "Verify your Google Cloud setup. Ensure datasets are located in the "
                    f"region '{expected_location}' or adjust your config.yaml location to match."
                ),
            )

        return True

    def validate_catalog_capacity(self) -> bool:
        """Validates that all enabled catalog projects have BigQuery Enterprise Plus capacity.

        Returns:
            True if all catalog projects (or ancestry) have an ENTERPRISE_PLUS query reservation.

        Raises:
            CortexGcpError: If any project cannot be checked or lacks required capacity reservation.
        """
        enabled_catalogs = [c for c in self.config.data.modules.catalogs if c.enabled]
        if not enabled_catalogs:
            return True

        logger.info("Validating BigQuery Enterprise Plus capacity for external catalogs...")
        for catalog in enabled_catalogs:
            project_id = catalog.connection_settings.project_id
            location = catalog.connection_settings.location

            try:
                ancestry_candidates = self.resource_manager_client.get_project_ancestry(project_id)
            except (GoogleAPICallError, GoogleAuthError) as e:
                raise CortexGcpError(
                    f"Unable to access catalog project '{project_id}' via Resource Manager: {e}",
                    hint=(
                        "Verify your Google Cloud credentials and that project "
                        f"'{project_id}' exists and is accessible."
                    ),
                ) from e

            has_cap = self.bq_reservation_client.has_enterprise_plus_query_assignment(
                project_id=project_id,
                location=location,
                assignee_candidates=ancestry_candidates,
            )
            if not has_cap:
                raise CortexGcpError(
                    f"Project '{project_id}' (or its hierarchy) lacks an ENTERPRISE_PLUS "
                    f"reservation query assignment in location '{location}'.",
                    hint=(
                        "BigLake Delta Sharing queries require BigQuery Enterprise Plus edition. "
                        f"Navigate to BigQuery -> Capacity Management in location '{location}' "
                        f"and create a QUERY assignment for project '{project_id}', folder, or "
                        "organization."
                    ),
                )

        logger.info("All enabled catalogs verified for Enterprise Plus query capacity.")
        return True
