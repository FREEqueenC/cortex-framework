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

"""Unit tests for InternalModuleProvider."""

import pathlib

import yaml

from common.services.internal_module_provider import InternalModuleProvider


class MockNamespace:
    def __init__(self, name: str, path: str, absolute_path: pathlib.Path | None = None):
        self.name = name
        self.path = path
        self.absolute_path = absolute_path

    def resolve_path(self, config_dir: pathlib.Path | None = None) -> pathlib.Path:
        return self.absolute_path or pathlib.Path(self.path)


class MockDataConfig:
    def __init__(self, ns_map: dict[str, pathlib.Path]):
        self.ns_map = ns_map

    def get_namespace_path(
        self, namespace_name: str, config_dir: pathlib.Path | None = None
    ) -> pathlib.Path:
        return self.ns_map[namespace_name]


def test_internal_module_provider_discovery(tmp_path):
    # Set up directory structure under tmp_path/ns1
    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    # 1. Valid foundation module (3 levels: sap/foundations/sap)
    sap_dir = ns1_dir / "sap" / "foundations" / "sap"
    sap_dir.mkdir(parents=True)
    manifest_data_1 = {
        "displayName": "SAP ECC S4 Foundation",
        "description": "Some desc",
        "category": "foundation",
        "type": "sap",
        "modulePath": "cortex.sap.foundations.sap",
    }
    with open(sap_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump(manifest_data_1, f)

    # 2. Valid product module (3 levels: sap/products/addresses)
    addresses_dir = ns1_dir / "sap" / "products" / "addresses"
    addresses_dir.mkdir(parents=True)
    manifest_data_2 = {
        "displayName": "Addresses Product",
        "description": "Some product desc",
        "category": "source_aligned_product",
        "type": "addresses",
        "modulePath": "addresses",
    }
    with open(addresses_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump(manifest_data_2, f)

    # 3. Generic depth module (2 levels: other/generic_mod)
    generic_dir = ns1_dir / "other" / "generic_mod"
    generic_dir.mkdir(parents=True)
    with open(generic_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"modulePath": "generic_mod", "category": "foundation", "type": "generic_mod"}, f)

    # Set up table settings for sap
    table_settings_data = {
        "common": [{"source": {"tableName": "tcurx"}}],
        "ecc": [{"source": {"tableName": "bkpf"}}, {"target": {"tableName": "bseg"}}],
        "s4": [{"source": {"tableName": "acdoca"}}],
    }
    with open(sap_dir / "table_settings.default.yaml", "w", encoding="utf-8") as f:
        yaml.dump(table_settings_data, f)

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]

    provider = InternalModuleProvider(namespaces)

    # Verify discovery
    assert provider.get_module_types() == {
        "cortex.sap.foundations.sap",
        "cortex.sap.products.addresses",
        "cortex.other.generic_mod",
    }

    # Verify default table metadata retrieval
    tables = provider.get_tables_for_module("cortex.sap.foundations.sap")
    assert tables == {"tcurx", "bkpf", "bseg", "acdoca"}

    # Verify custom table settings lookup
    custom_settings_dir = tmp_path / "custom"
    custom_settings_dir.mkdir()
    custom_settings_file = custom_settings_dir / "custom_settings.yaml"
    custom_table_settings = {"common": [{"source": {"tableName": "tcurc"}}]}
    with open(custom_settings_file, "w", encoding="utf-8") as f:
        yaml.dump(custom_table_settings, f)

    custom_tables = provider.get_tables_for_module(
        "cortex.sap.foundations.sap", custom_settings_file
    )
    assert custom_tables == {"tcurc"}


def test_internal_module_provider_caching(tmp_path):
    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    # Initial module setup
    sap_dir = ns1_dir / "sap" / "foundations" / "sap"
    sap_dir.mkdir(parents=True)
    with open(sap_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump(
            {"modulePath": "cortex.sap.foundations.sap", "category": "foundation", "type": "sap"}, f
        )

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]

    provider = InternalModuleProvider(namespaces)

    # First call scans and caches
    assert provider.get_module_types() == {"cortex.sap.foundations.sap"}

    # Add a new module on disk
    addresses_dir = ns1_dir / "sap" / "products" / "addresses"
    addresses_dir.mkdir(parents=True)
    with open(addresses_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump(
            {"modulePath": "addresses", "category": "source_aligned_product", "type": "addresses"},
            f,
        )

    # Calling get_module_types should still return cached value
    assert provider.get_module_types() == {"cortex.sap.foundations.sap"}

    # Force cache refresh
    provider.discover_modules(force_refresh=True)
    assert provider.get_module_types() == {
        "cortex.sap.foundations.sap",
        "cortex.sap.products.addresses",
    }


def test_internal_module_provider_guided_discovery(tmp_path):
    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    # Create module folder
    addresses_dir = ns1_dir / "sap" / "products" / "addresses"
    addresses_dir.mkdir(parents=True)
    with open(addresses_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"type": "addresses", "category": "source_aligned_product"}, f)

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]
    provider = InternalModuleProvider(namespaces)

    # Guided discovery directly resolves without calling full discover_modules first
    manifest = provider.resolve_module_by_path("cortex.sap.products.addresses")
    assert manifest is not None
    assert manifest.type == "addresses"
    assert provider.get_module_dir("cortex.sap.products.addresses") == addresses_dir
    assert provider.get_manifest("cortex.sap.products.addresses").type == "addresses"

    # Non-existent module returns None
    assert provider.resolve_module_by_path("cortex.sap.products.unknown") is None


def test_internal_module_provider_guided_discovery_then_full_discovery(tmp_path):
    """Verify that guided discovery populating single module does not block full discovery."""
    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    # Module 1
    sap_dir = ns1_dir / "sap" / "foundations" / "sap"
    sap_dir.mkdir(parents=True)
    with open(sap_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"type": "sap", "category": "foundation"}, f)

    # Module 2
    addresses_dir = ns1_dir / "sap" / "products" / "addresses"
    addresses_dir.mkdir(parents=True)
    with open(addresses_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"type": "addresses", "category": "source_aligned_product"}, f)

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]
    provider = InternalModuleProvider(namespaces)

    # 1. Perform guided discovery on a single module
    manifest = provider.resolve_module_by_path("cortex.sap.products.addresses")
    assert manifest is not None

    # 2. Call get_module_types - should still discover ALL modules on disk
    module_types = provider.get_module_types()
    assert module_types == {
        "cortex.sap.foundations.sap",
        "cortex.sap.products.addresses",
    }


def test_internal_module_provider_path_traversal_prevention(tmp_path):
    """Verify path traversal attempts are rejected in resolve_module_by_path."""
    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]
    provider = InternalModuleProvider(namespaces)

    # Attempt various path traversal payloads
    assert provider.resolve_module_by_path("cortex.sap/../../etc") is None
    assert provider.resolve_module_by_path("cortex.sap/../..") is None
    assert provider.resolve_module_by_path("cortex...etc") is None
    assert provider.resolve_module_by_path("cortex.sap..products") is None
    assert provider.resolve_module_by_path("cortex.sap.products.") is None
    assert provider.resolve_module_by_path("cortex.sap.\\..\\etc") is None


def test_internal_module_provider_thread_safety(tmp_path):
    """Verify concurrent reads and discovery are thread-safe."""
    import concurrent.futures

    ns1_dir = tmp_path / "ns1"
    ns1_dir.mkdir()

    sap_dir = ns1_dir / "sap" / "foundations" / "sap"
    sap_dir.mkdir(parents=True)
    with open(sap_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"type": "sap", "category": "foundation"}, f)

    addresses_dir = ns1_dir / "sap" / "products" / "addresses"
    addresses_dir.mkdir(parents=True)
    with open(addresses_dir / "manifest.yaml", "w", encoding="utf-8") as f:
        yaml.dump({"type": "addresses", "category": "source_aligned_product"}, f)

    namespaces = [MockNamespace("cortex", "ns1", ns1_dir)]
    provider = InternalModuleProvider(namespaces)

    def worker(i: int):
        if i % 3 == 0:
            return provider.get_module_types()
        elif i % 3 == 1:
            return provider.resolve_module_by_path("cortex.sap.products.addresses")
        else:
            return provider.get_module_dir("cortex.sap.foundations.sap")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(worker, i) for i in range(30)]
        results = [f.result() for f in futures]

    assert len(results) == 30
