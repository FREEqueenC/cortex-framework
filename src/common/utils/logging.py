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
import sys


class ColoredFormatter(logging.Formatter):
    ORANGE = "\033[38;5;208m"
    RED = "\033[31m"
    RESET = "\033[0m"

    def formatMessage(self, record):
        orig_levelname = record.levelname

        icon = ""
        if record.levelno == logging.WARNING:
            icon = "⚠️ "
        elif record.levelno == logging.ERROR:
            icon = "❌ "

        if icon:
            record.levelname = f"{icon}{orig_levelname}"

        res = super().formatMessage(record)
        record.levelname = orig_levelname
        return res

    def format(self, record):
        formatted = super().format(record)
        if record.levelno == logging.WARNING:
            return f"{self.ORANGE}{formatted}{self.RESET}"
        elif record.levelno == logging.ERROR:
            return f"{self.RED}{formatted}{self.RESET}"
        return formatted


def setup_logging(level=logging.INFO):
    handler = logging.StreamHandler(sys.stdout)
    # Use \033[22m to reset dimness without resetting color
    fmt = "\033[2m%(asctime)s\033[22m - %(levelname)s - \033[2m%(name)s\033[22m - %(message)s"
    handler.setFormatter(ColoredFormatter(fmt))
    logging.basicConfig(level=level, handlers=[handler])
