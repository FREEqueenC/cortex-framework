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

from google.cloud import bigquery

from common.clients.bigquery import BigQueryManager
from common.clients.service_usage import ServiceUsageClient
from common.schemas.config_schema import GlobalConfig

logger = logging.getLogger(__name__)


class GcpEnvironmentChecker:
    def __init__(
        self,
        config: GlobalConfig,
        seeder_enabled: bool = False,
        enable_apis: bool = False,
        create_datasets: bool = False,
    ):
        self.config = config
        self.seeder_enabled = seeder_enabled
        self.enable_apis = enable_apis
        self.create_datasets = create_datasets
        self.service_usage_client = ServiceUsageClient()
        self.bq_client = bigquery.Client()

    def validate_all(self) -> bool:
        """Runs all validations. Returns True if all validation checks pass."""
        logger.info("Starting GCP Environment validations...")
        try:
            logger.info("Step 1: Validating required APIs...")
            if not self.validate_apis():
                logger.error("API validation failed. Aborting.")
                return False
            logger.info("Step 2: Validating datasets...")
            if not self.validate_datasets():
                logger.error("Dataset validation failed. Aborting.")
                return False
            logger.info("Step 3: Validating dataset locations...")
            if not self.validate_dataset_location():
                logger.error("Dataset location validation failed. Aborting.")
                return False
            logger.info("All GCP Environment validations passed.")
            return True
        except Exception as e:
            logger.error("An unexpected error occurred during validation: %s", e)
            return False

    def _prompt_and_act(self, missing_items, flag, prompt_msg, action_fn) -> bool:
        """Consolidates the check -> prompt -> act flow.

        Returns True if resolved or no missing items, False if stopped.
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
        """Gathers required APIs per project from config."""
        required_apis: dict[str, set[str]] = {}

        # BigQuery APIs
        source_projects = {s.project_id for s in self.config.data.sources}
        target_projects = {t.project_id for t in self.config.data.targets}

        for proj in source_projects | target_projects:
            required_apis.setdefault(proj, set()).add("bigquery.googleapis.com")

        # Storage APIs (only if seeder is enabled)
        if self.seeder_enabled:
            for proj in source_projects:
                required_apis.setdefault(proj, set()).add("storage.googleapis.com")

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
        """Validate and optionally enable required APIs."""
        logger.info("Validating required APIs...")
        required_apis = self._get_required_apis()

        for project_id, apis in required_apis.items():
            missing = []
            for api in apis:
                try:
                    if not self.service_usage_client.is_api_enabled(project_id, api):
                        missing.append(api)
                except Exception as e:
                    logger.error(
                        "Unable to check API %s on project %s due to error: %s",
                        api,
                        project_id,
                        e,
                    )
                    return False

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
                    logger.error(
                        "APIs %s are required but not enabled on project %s",
                        missing,
                        project_id,
                    )
                    return False

        return True

    def _get_target_datasets(self) -> set[tuple[str, str]]:
        target_datasets = set()
        foundation_modules = self.config.data.modules.foundation
        for f_mod in foundation_modules:
            if f_mod.enabled and not f_mod.external and f_mod.data_target_id:
                target = self.config.get_data_target(f_mod.data_target_id)
                if target:
                    target_datasets.add((target.project_id, target.dataset_id))

        product_modules = self.config.data.modules.product
        for p_mod in product_modules:
            if p_mod.enabled:
                target = self.config.get_data_target(p_mod.data_target_id)
                if target:
                    target_datasets.add((target.project_id, target.dataset_id))

        if self.seeder_enabled:
            for source in self.config.data.sources:
                target_datasets.add((source.project_id, source.dataset_id))

        return target_datasets

    def _get_source_datasets(self) -> set[tuple[str, str]]:
        source_datasets = set()
        if not self.seeder_enabled:
            for source in self.config.data.sources:
                source_datasets.add((source.project_id, source.dataset_id))
        return source_datasets

    def validate_datasets(self) -> bool:
        """Validates that all datasets defined in the config exist.

        Prompts before creating unless self.create_datasets is True.
        """
        logger.info("Validating datasets...")
        default_location = self.config.data.big_query_location
        bq_client = BigQueryManager()

        target_datasets = self._get_target_datasets()
        source_datasets = self._get_source_datasets()

        missing_sources = []
        for proj, ds in source_datasets:
            if not bq_client.get_dataset(proj, ds):
                missing_sources.append((proj, ds))

        if missing_sources:
            formatted_sources = "\n".join([f"- {ds} ({proj})" for proj, ds in missing_sources])
            logger.error(
                "Source datasets are missing and cannot be created:\n%s",
                formatted_sources,
            )
            return False

        missing_targets = []
        for proj, ds in target_datasets:
            if not bq_client.get_dataset(proj, ds):
                missing_targets.append((proj, ds))

        if not missing_targets:
            logger.info("All required datasets exist.")
            return True

        logger.info("The following datasets are missing:\n%s", missing_targets)

        def action(m):
            logger.info("Creating missing datasets...")
            all_success = True
            for proj, ds in m:
                if not bq_client.create_dataset(proj, ds, location=default_location):
                    all_success = False
            return all_success

        formatted_targets = "\n".join([f"- {ds} ({proj})" for proj, ds in missing_targets])
        prompt_msg = (
            f"The following datasets are missing:\n{formatted_targets}\nCreate them? [Y/n]: "
        )
        return self._prompt_and_act(missing_targets, self.create_datasets, prompt_msg, action)

    def validate_dataset_location(self) -> bool:
        """Validates that all source and existing target datasets are in the expected location."""
        logger.info("Validating dataset locations...")
        expected_location = self.config.data.big_query_location
        bq_client = BigQueryManager()

        all_valid = True

        # Validate source datasets (must exist and be in the correct location)
        source_datasets = self._get_source_datasets()
        for project_id, dataset_id in source_datasets:
            dataset = bq_client.get_dataset(project_id, dataset_id)
            if dataset:
                actual_location = dataset.location
                if actual_location.upper() != expected_location.upper():
                    logger.error(
                        "Source dataset '%s.%s' is in location '%s', but '%s' was expected.",
                        project_id,
                        dataset_id,
                        actual_location,
                        expected_location,
                    )
                    all_valid = False
            else:
                logger.error(
                    "Source dataset '%s.%s' does not exist.",
                    project_id,
                    dataset_id,
                )
                all_valid = False

        # Validate target datasets (if they exist, must be in the correct location)
        target_datasets = self._get_target_datasets()
        for project_id, dataset_id in target_datasets:
            dataset = bq_client.get_dataset(project_id, dataset_id)
            if dataset:
                actual_location = dataset.location
                if actual_location.upper() != expected_location.upper():
                    logger.error(
                        "Target dataset '%s.%s' is in location '%s', but '%s' was expected.",
                        project_id,
                        dataset_id,
                        actual_location,
                        expected_location,
                    )
                    all_valid = False

        return all_valid
