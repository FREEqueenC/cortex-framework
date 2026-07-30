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

import contextlib
import logging
import os
import re
import tempfile

from common.utils.logging import setup_logging


def test_setup_logging(capsys):
    # Retrieve current handlers to restore them after the test
    root_logger = logging.getLogger()
    old_handlers = list(root_logger.handlers)
    old_level = root_logger.level

    try:
        # Call setup_logging
        setup_logging(level=logging.DEBUG)

        # 1. Assert something was printed to stdout pointing to the log file
        captured = capsys.readouterr()
        assert (
            "Tools log are also stored in the following file for troubleshooting and support "
            "purposes: " in captured.out
        )

        # Parse file path from the stdout
        match = re.search(r"purposes:\s*(.*)", captured.out)
        assert match is not None
        log_filepath = match.group(1).strip()

        # 2. Check that the file was created and is in the temp directory
        assert os.path.exists(log_filepath)
        assert log_filepath.startswith(tempfile.gettempdir())

        # Check filename template: cortex-framework-logs-yyyymmdd-HHmm.log
        filename = os.path.basename(log_filepath)
        # Regex to match cortex-framework-logs-\d{8}-\d{4}\.log
        assert re.match(r"^cortex-framework-logs-\d{8}-\d{4}\.log$", filename)

        # 3. Write a log and check it is written to the file
        logger = logging.getLogger("test_logger")
        logger.debug("Hello test debug message")

        # Force handlers flush/close
        for handler in root_logger.handlers:
            handler.flush()

        with open(log_filepath, encoding="utf-8") as f:
            content = f.read()
            assert "Hello test debug message" in content
            assert "DEBUG" in content
            assert "test_logger" in content

    finally:
        # Restore logging state
        root_logger.handlers = old_handlers
        root_logger.setLevel(old_level)
        # Clean up the generated file if it exists
        if "log_filepath" in locals() and os.path.exists(log_filepath):
            with contextlib.suppress(OSError):
                os.remove(log_filepath)
