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

"""Thread-safe Token Rate Limiter for pacing API requests."""

import threading
import time


class TokenRateLimiter:
    """Thread-safe Token Rate Limiter.

    Paces outgoing calls using the Token Bucket algorithm to prevent
    exceeding cloud API quota limits.

    Attributes:
        rate: Number of tokens added per second (default: 4.5 tokens/sec = 270 req/min).
        capacity: Maximum burst capacity of tokens (default: 5.0).
    """

    def __init__(self, rate: float = 4.5, capacity: float = 5.0):
        if rate <= 0:
            raise ValueError("Rate must be positive.")
        if capacity < 0:
            raise ValueError("Capacity cannot be negative.")
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_timestamp = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self, tokens: float = 1.0) -> None:
        """Blocks until the requested number of tokens is available."""
        if tokens <= 0:
            return
        if tokens > self.capacity:
            raise ValueError(
                f"Requested tokens ({tokens}) exceeds maximum bucket capacity ({self.capacity})."
            )

        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_timestamp
                self.last_timestamp = now

                # Replenish tokens based on elapsed time
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)

                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return

                # Calculate exact sleep duration needed for next token
                needed = tokens - self.tokens
                sleep_duration = needed / self.rate

            time.sleep(sleep_duration)
