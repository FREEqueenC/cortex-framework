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

"""Unit tests for TokenRateLimiter."""

import threading
import time

import pytest

from common.utils.rate_limiter import TokenRateLimiter


def test_rate_limiter_init_validation():
    """Verifies that invalid rates and capacities raise ValueError."""
    with pytest.raises(ValueError, match="Rate must be positive"):
        TokenRateLimiter(rate=0)

    with pytest.raises(ValueError, match="Rate must be positive"):
        TokenRateLimiter(rate=-1.0)

    with pytest.raises(ValueError, match="Capacity cannot be negative"):
        TokenRateLimiter(rate=5.0, capacity=-1.0)


def test_rate_limiter_acquire_zero_or_negative():
    """Verifies that acquiring zero or negative tokens returns immediately."""
    limiter = TokenRateLimiter(rate=1.0, capacity=1.0)
    limiter.acquire(0)
    limiter.acquire(-5.0)
    assert limiter.tokens == 1.0


def test_rate_limiter_acquire_exceeds_capacity():
    """Verifies that requesting more tokens than capacity raises ValueError."""
    limiter = TokenRateLimiter(rate=5.0, capacity=2.0)
    with pytest.raises(ValueError, match="exceeds maximum bucket capacity"):
        limiter.acquire(3.0)


def test_rate_limiter_burst_capacity():
    """Verifies burst capacity allows immediate consumption without delay."""
    limiter = TokenRateLimiter(rate=1.0, capacity=3.0)
    start = time.monotonic()
    limiter.acquire(1.0)
    limiter.acquire(1.0)
    limiter.acquire(1.0)
    duration = time.monotonic() - start
    # 3 tokens available in burst capacity should execute nearly instantaneously
    assert duration < 0.1
    assert limiter.tokens < 0.1


def test_rate_limiter_pacing():
    """Verifies that acquiring tokens beyond capacity paces execution."""
    rate = 10.0  # 10 tokens/sec -> 0.1s per token
    limiter = TokenRateLimiter(rate=rate, capacity=1.0)

    # Consume the initial token
    limiter.acquire(1.0)

    start = time.monotonic()
    # Acquire 2 more tokens, requiring ~0.2 seconds
    limiter.acquire(1.0)
    limiter.acquire(1.0)
    duration = time.monotonic() - start

    assert duration >= 0.18


def test_rate_limiter_thread_safety():
    """Verifies thread safety when multiple threads acquire tokens concurrently."""
    rate = 50.0  # 50 tokens/sec
    limiter = TokenRateLimiter(rate=rate, capacity=5.0)
    num_threads = 5
    tokens_per_thread = 2

    def worker():
        for _ in range(tokens_per_thread):
            limiter.acquire(1.0)

    threads = [threading.Thread(target=worker) for _ in range(num_threads)]
    start = time.monotonic()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    duration = time.monotonic() - start

    # 10 tokens total: 5 in burst, 5 generated @ 50/s -> ~0.1s
    assert duration >= 0.08
