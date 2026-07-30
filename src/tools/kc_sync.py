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

import argparse
import logging
import pathlib

from common.errors import CortexConfigError, CortexError
from common.services.config_loader import ConfigLoader
from common.services.dataplex import data_products_sync
from common.services.external_module_provider import ExternalModuleProvider
from common.services.internal_module_provider import InternalModuleProvider
from common.services.telemetry.consent_manager import TelemetryConsentManager
from common.services.unified_module_provider import UnifiedModuleProvider
from common.utils import logging as cortex_logging

logger = logging.getLogger(__name__)


def main(args=None):
    cortex_logging.setup_logging()
    parser = argparse.ArgumentParser(
        description="Sync Cortex Data Product definitions with the Knowledge Catalog"
    )
    parser.add_argument(
        "--kc-project-id",
        type=str,
        required=False,
        help="The Knowledge Catalog project id.",
    )
    parser.add_argument(
        "--config",
        type=pathlib.Path,
        default=pathlib.Path.cwd() / "config" / "config.yaml",
        help="Path to global config.yaml used in the deployment step",
    )
    parser.add_argument(
        "--data-modules-root-directory",
        type=str,
        default=pathlib.Path.cwd() / "src" / "data_modules",
        help="Path to data modules root directory",
    )
    parser.add_argument(
        "--owner-email",
        type=str,
        required=True,
        help="Email address of the owner of the data products.",
    )
    parser.add_argument(
        "--disable-telemetry",
        action="store_true",
        default=False,
        help="Disable telemetry event logging",
    )

    provided_arguments = parser.parse_args(args)

    kc_project_id = provided_arguments.kc_project_id
    config_file = provided_arguments.config

    owner_email = provided_arguments.owner_email

    TelemetryConsentManager.setup(provided_arguments.disable_telemetry)
    try:
        if not config_file.exists():
            raise CortexConfigError(
                f"Config file not found at {config_file}",
                hint="Please check that the file path is correct and that the file exists.",
            )

        global_config, validation_errors = ConfigLoader.load_and_validate(config_file)
        if not global_config:
            errors_str = "\n".join(f"  - {err}" for err in validation_errors)
            raise CortexConfigError(
                f"Configuration validation failed with the following errors:\n{errors_str}",
                hint="Correct the issues in config.yaml according to the validation rules.",
            )

        internal_provider = InternalModuleProvider(
            namespaces=global_config.data.namespaces,
            config_dir=config_file.parent,
        )
        internal_provider.discover_modules()
        ext_cats = global_config.data.modules.catalogs if global_config.data.modules else []
        external_provider = ExternalModuleProvider(catalogs=ext_cats)
        unified_provider = UnifiedModuleProvider(internal_provider, external_provider)

        kwargs = {
            "kc_project_id": kc_project_id,
            "global_config": global_config,
            "module_provider": unified_provider,
            "owner_email": owner_email,
        }

        with data_products_sync.DataProductsSyncer(**kwargs) as data_product_syncer:
            data_product_syncer.sync_data_products()
    except CortexError as e:
        logger.error(str(e))
        import sys

        sys.exit(1)
    except Exception:
        logger.exception("An unexpected error occurred:")
        import sys

        sys.exit(1)


if __name__ == "__main__":
    main()
