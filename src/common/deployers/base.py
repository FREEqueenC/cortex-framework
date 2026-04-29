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

import abc
import pathlib

from common.schemas.config_schema import DeploymentTargetConfig, GlobalConfig


class Deployer(abc.ABC):
    """Abstract base class for all deployers (Interface only)."""

    @abc.abstractmethod
    def deploy(
        self,
        global_config: GlobalConfig,
        target: DeploymentTargetConfig,
        output_dir: pathlib.Path,
    ) -> bool:
        """Executes deployment using configuration context.

        Args:
            global_config: The global configuration.
            target: The deployment target configuration.
            output_dir: The path where compiled artifacts are stored.

        Returns:
            True if successful, False otherwise.
        """
        pass
