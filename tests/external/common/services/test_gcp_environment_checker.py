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

from unittest.mock import Mock, patch

import pytest

from common.schemas.config_schema import GlobalConfig
from common.services.gcp_environment_checker import GcpEnvironmentChecker


@pytest.fixture
def mock_config():
    return GlobalConfig.model_validate(
        {
            "data": {
                "bigQueryLocation": "US",
                "sources": [{"id": "src1", "projectId": "proj-src", "datasetId": "ds_src"}],
                "targets": [{"id": "tgt1", "projectId": "proj-tgt", "datasetId": "ds_tgt"}],
                "modules": {"foundation": [], "product": []},
            },
            "deployment": {
                "targets": [
                    {
                        "enabled": True,
                        "type": "dataform",
                        "targetSettings": {
                            "repositoryProjectId": "proj-df",
                            "repositoryRegion": "us-central1",
                            "repositoryName": "repo",
                            "workspaceName": "ws",
                            "serviceAccount": "sa@proj-df.iam.gserviceaccount.com",
                        },
                    }
                ]
            },
        }
    )


def test_validate_all_success(mock_config):
    with (
        patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU,
        patch("google.cloud.bigquery.Client") as MockBQClient,
    ):
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = True

        mock_dataset = MockBQClient.return_value.get_dataset.return_value
        mock_dataset.location = "US"

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_all()


def test_validate_all_missing_api(mock_config):
    with (
        patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU,
        patch("google.cloud.bigquery.Client"),
        patch("builtins.input", return_value="n"),
    ):
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = False

        checker = GcpEnvironmentChecker(mock_config)
        assert not checker.validate_all()


def test_validate_apis_checks_correct_apis(mock_config):
    with patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU:
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = True

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_apis()

        expected_calls = [
            ("proj-src", "bigquery.googleapis.com"),
            ("proj-tgt", "bigquery.googleapis.com"),
            ("proj-df", "dataform.googleapis.com"),
        ]
        called_args = [
            (call.args[0], call.args[1]) for call in su_instance.is_api_enabled.call_args_list
        ]
        for call in expected_calls:
            assert call in called_args


def test_validate_apis_skips_dataform_when_disabled(mock_config):
    mock_config.deployment.targets[0].enabled = False
    with patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU:
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = True

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_apis()

        called_args = [
            (call.args[0], call.args[1]) for call in su_instance.is_api_enabled.call_args_list
        ]
        assert ("proj-df", "dataform.googleapis.com") not in called_args


def test_validate_apis_checks_storage_when_seeder_enabled(mock_config):
    with patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU:
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = True

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=True)
        assert checker.validate_apis()

        called_args = [
            (call.args[0], call.args[1]) for call in su_instance.is_api_enabled.call_args_list
        ]
        assert ("proj-src", "storage.googleapis.com") in called_args


def test_validate_apis_skips_storage_when_seeder_disabled(mock_config):
    with patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU:
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.return_value = True

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=False)
        assert checker.validate_apis()

        called_args = [
            (call.args[0], call.args[1]) for call in su_instance.is_api_enabled.call_args_list
        ]
        assert ("proj-src", "storage.googleapis.com") not in called_args


def test_validate_apis_enables_storage_when_missing_and_enable_apis_true(mock_config):
    with patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU:
        su_instance = MockSU.return_value

        def is_api_enabled_side_effect(proj, api):
            return api != "storage.googleapis.com"

        su_instance.is_api_enabled.side_effect = is_api_enabled_side_effect
        su_instance.enable_api.return_value = True

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=True, enable_apis=True)
        assert checker.validate_apis()

        su_instance.enable_api.assert_called_once_with("proj-src", "storage.googleapis.com")


def test_validate_apis_prompts_for_storage_and_succeeds_when_accepted(mock_config):
    with (
        patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU,
        patch("builtins.input", return_value="y"),
    ):
        su_instance = MockSU.return_value

        def is_api_enabled_side_effect(proj, api):
            return api != "storage.googleapis.com"

        su_instance.is_api_enabled.side_effect = is_api_enabled_side_effect
        su_instance.enable_api.return_value = True

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=True, enable_apis=False)
        assert checker.validate_apis()

        su_instance.enable_api.assert_called_once_with("proj-src", "storage.googleapis.com")


def test_validate_apis_prompts_for_storage_and_fails_when_denied(mock_config):
    with (
        patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU,
        patch("builtins.input", return_value="n"),
    ):
        su_instance = MockSU.return_value

        def is_api_enabled_side_effect(proj, api):
            return api != "storage.googleapis.com"

        su_instance.is_api_enabled.side_effect = is_api_enabled_side_effect

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=True, enable_apis=False)
        assert not checker.validate_apis()

        su_instance.enable_api.assert_not_called()


def test_validate_datasets_seeder_enabled_missing_source_passes(mock_config):
    with (
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
        patch("builtins.input", return_value="y"),
    ):
        bqc_instance = MockBQC.return_value
        bqc_instance.create_dataset.return_value = True

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_src":
                return None
            return Mock()

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=True)
        assert checker.validate_datasets()
        bqc_instance.create_dataset.assert_called_once_with("proj-src", "ds_src", location="US")


def test_validate_datasets_seeder_disabled_missing_source_fails(mock_config):
    with patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC:
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_src":
                return None
            return Mock()

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect

        checker = GcpEnvironmentChecker(mock_config, seeder_enabled=False)
        assert not checker.validate_datasets()


def test_validate_datasets_all_exist_success(mock_config):
    with patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC:
        bqc_instance = MockBQC.return_value
        bqc_instance.get_dataset.return_value = Mock()

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_datasets()


def test_validate_datasets_missing_target_created(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
    ):
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_tgt":
                return None
            return Mock()

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect
        bqc_instance.create_dataset.return_value = True

        checker = GcpEnvironmentChecker(mock_config, create_datasets=True)
        assert checker.validate_datasets()
        bqc_instance.create_dataset.assert_called_once_with("proj-tgt", "ds_tgt", location="US")


def test_validate_datasets_missing_target_prompt_yes(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
        patch("builtins.input", return_value="y"),
    ):
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_tgt":
                return None
            return Mock()

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect
        bqc_instance.create_dataset.return_value = True

        checker = GcpEnvironmentChecker(mock_config, create_datasets=False)
        assert checker.validate_datasets()
        bqc_instance.create_dataset.assert_called_once_with("proj-tgt", "ds_tgt", location="US")


def test_validate_datasets_missing_target_prompt_no(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
        patch("builtins.input", return_value="n"),
    ):
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_tgt":
                return None
            return Mock()

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect

        checker = GcpEnvironmentChecker(mock_config, create_datasets=False)
        assert not checker.validate_datasets()
        bqc_instance.create_dataset.assert_not_called()


def test_validate_datasets_product_module_checked(mock_config):
    mock_config.data.modules.product = [Mock(enabled=True, data_target_id="tgt-prod")]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_prod"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
    ):
        bqc_instance = MockBQC.return_value
        bqc_instance.get_dataset.return_value = Mock()

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_datasets()
        bqc_instance.get_dataset.assert_any_call("proj-tgt", "ds_prod")


def test_validate_dataset_location_success(mock_config):
    with patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC:
        bqc_instance = MockBQC.return_value
        mock_ds = Mock()
        mock_ds.location = "US"
        bqc_instance.get_dataset.return_value = mock_ds

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_dataset_location()


def test_validate_dataset_location_mismatch(mock_config):
    with patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC:
        bqc_instance = MockBQC.return_value
        mock_ds = Mock()
        mock_ds.location = "EU"  # Configured is "US"
        bqc_instance.get_dataset.return_value = mock_ds

        checker = GcpEnvironmentChecker(mock_config)
        assert not checker.validate_dataset_location()


def test_validate_dataset_location_missing(mock_config):
    with patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC:
        bqc_instance = MockBQC.return_value
        bqc_instance.get_dataset.return_value = None

        checker = GcpEnvironmentChecker(mock_config)
        assert not checker.validate_dataset_location()


def test_validate_dataset_location_target_success(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
    ):
        bqc_instance = MockBQC.return_value

        mock_ds = Mock()
        mock_ds.location = "US"
        bqc_instance.get_dataset.return_value = mock_ds

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_dataset_location()


def test_validate_dataset_location_target_mismatch(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
    ):
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_tgt":
                mock_ds = Mock()
                mock_ds.location = "EU"
                return mock_ds
            elif ds == "ds_src":
                mock_ds = Mock()
                mock_ds.location = "US"
                return mock_ds
            return None

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect

        checker = GcpEnvironmentChecker(mock_config)
        assert not checker.validate_dataset_location()


def test_validate_dataset_location_target_missing(mock_config):
    mock_config.data.modules.foundation = [
        Mock(enabled=True, external=False, data_target_id="tgt1")
    ]
    with (
        patch(
            "common.schemas.config_schema.GlobalConfig.get_data_target",
            return_value=Mock(project_id="proj-tgt", dataset_id="ds_tgt"),
        ),
        patch("common.services.gcp_environment_checker.BigQueryManager") as MockBQC,
    ):
        bqc_instance = MockBQC.return_value

        def get_dataset_side_effect(proj, ds):
            if ds == "ds_src":
                mock_ds = Mock()
                mock_ds.location = "US"
                return mock_ds
            return None

        bqc_instance.get_dataset.side_effect = get_dataset_side_effect

        checker = GcpEnvironmentChecker(mock_config)
        assert checker.validate_dataset_location()


def test_validate_apis_handles_client_library_error(mock_config):
    with (
        patch("common.services.gcp_environment_checker.ServiceUsageClient") as MockSU,
        patch("builtins.input") as mock_input,
    ):
        su_instance = MockSU.return_value
        su_instance.is_api_enabled.side_effect = Exception(
            "AuthMetadataPluginCallback raised exception!"
        )

        checker = GcpEnvironmentChecker(mock_config)
        assert not checker.validate_apis()
        mock_input.assert_not_called()
