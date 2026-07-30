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

"""Tests for run_all.py."""

from unittest import mock

import pytest

from tools.run_all import main


def test_main_success(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.touch()

    with (
        mock.patch("tools.run_all.ConfigLoader") as mock_loader_cls,
        mock.patch("tools.run_all.DataformBuilder") as mock_builder_cls,
        mock.patch("tools.run_all.DeploymentOrchestrator") as mock_deploy_cls,
    ):
        mock_loader_cls.load_and_validate.return_value = (mock.MagicMock(), [])
        mock_builder = mock.MagicMock()
        mock_builder.build.return_value = True
        mock_builder_cls.return_value = mock_builder

        mock_deploy = mock.MagicMock()
        mock_deploy.execute_deployments.return_value = True
        mock_deploy_cls.return_value = mock_deploy

        main(["--config", str(config_file)])
        mock_builder_cls.assert_called_once_with(
            global_config=mock.ANY,
            output_dir=mock.ANY,
            config_dir=config_file.parent,
            assertions_path=None,
        )
        mock_builder.build.assert_called_once()
        mock_deploy.execute_deployments.assert_called_once()


def test_main_missing_config(tmp_path):
    config_file = tmp_path / "nonexistent.yaml"
    with pytest.raises(SystemExit) as exc:
        main(["--config", str(config_file)])
    assert exc.value.code == 1


def test_main_success_with_assertions(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.touch()
    assertions_file = tmp_path / "assertions.sqlx"
    assertions_file.touch()

    with (
        mock.patch("tools.run_all.ConfigLoader") as mock_loader_cls,
        mock.patch("tools.run_all.DataformBuilder") as mock_builder_cls,
        mock.patch("tools.run_all.DeploymentOrchestrator") as mock_deploy_cls,
    ):
        mock_loader_cls.load_and_validate.return_value = (mock.MagicMock(), [])
        mock_builder = mock.MagicMock()
        mock_builder.build.return_value = True
        mock_builder_cls.return_value = mock_builder

        mock_deploy = mock.MagicMock()
        mock_deploy.execute_deployments.return_value = True
        mock_deploy_cls.return_value = mock_deploy

        main(["--config", str(config_file), "--assertions", str(assertions_file)])

        # Verify DataformBuilder was instantiated with the correct arguments
        mock_builder_cls.assert_called_once_with(
            global_config=mock.ANY,
            output_dir=mock.ANY,
            config_dir=config_file.parent,
            assertions_path=assertions_file,
        )

        mock_builder.build.assert_called_once()
        mock_deploy.execute_deployments.assert_called_once()
