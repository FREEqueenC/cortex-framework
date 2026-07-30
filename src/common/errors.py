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

"""Custom exception classes for the Cortex Framework.

Provides structured, user-friendly error messages and remediation hints.
"""


class CortexError(Exception):
    """Base exception for all Cortex Framework errors."""

    def __init__(self, message: str, hint: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint

    def __str__(self) -> str:
        if self.hint:
            return f"{self.message}\nHint: {self.hint}"
        return self.message


class CortexConfigError(CortexError):
    """Errors related to configuration loading, validation, or processing."""

    pass


class CortexGcpError(CortexError):
    """Errors related to Google Cloud environment verification or resource lookup."""

    pass


class CortexBuildError(CortexError):
    """Errors raised during the Dataform build orchestration or module compilation."""

    pass


class CortexDeployError(CortexError):
    """Errors raised during deployment target execution or post-deployment action."""

    pass
