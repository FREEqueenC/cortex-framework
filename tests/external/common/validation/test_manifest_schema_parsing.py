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

import pydantic
import pytest

from common.schemas.enums import SapVersion
from common.schemas.manifest_schema import ManifestConfig, SapDependencyInfo


def test_manifest_schema_sap_rejects_list_for_tables():
    """Verify that SAP dependency rejects plain list for tables (expects object)."""
    yaml_with_list_for_sap = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {"type": "sap", "supportedVersions": ["ecc", "s4"], "tables": ["t1"]}
        },
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_list_for_sap)


def test_manifest_schema_sap_accepts_nested_tables_common():
    """Verify that SAP dependency accepts nested 'common' tables."""
    yaml_with_common = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {
                "type": "sap",
                "supportedVersions": ["ecc", "s4"],
                "tables": {"common": ["t1", "t2"]},
            }
        },
    }
    config = ManifestConfig(**yaml_with_common)
    assert config.dependencies["sapModule"].tables.common == ["t1", "t2"]


def test_manifest_schema_sap_accepts_nested_tables_s4_ecc():
    """Verify that SAP dependency accepts nested 's4' and 'ecc' tables."""
    yaml_with_s4_ecc = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {
                "type": "sap",
                "supportedVersions": ["ecc", "s4"],
                "tables": {"s4": ["t1"], "ecc": ["t2"]},
            }
        },
    }
    config = ManifestConfig(**yaml_with_s4_ecc)
    assert config.dependencies["sapModule"].tables.s4 == ["t1"]
    assert config.dependencies["sapModule"].tables.ecc == ["t2"]


def test_manifest_schema_sap_rejects_empty_tables_object():
    """Verify that SAP dependency rejects empty tables object (no common, s4, or ecc)."""
    yaml_with_empty_tables = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {"type": "sap", "supportedVersions": ["ecc", "s4"], "tables": {}}
        },
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_empty_tables)


def test_manifest_schema_sap_rejects_empty_lists_in_tables():
    """Verify that SAP dependency rejects empty lists within tables object."""
    yaml_with_empty_list = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {
                "type": "sap",
                "supportedVersions": ["ecc", "s4"],
                "tables": {"common": []},
            }
        },
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_empty_list)


def test_manifest_schema_generic_accepts_tables():
    """Verify that Generic dependency accepts tables."""
    yaml_with_generic = {
        "type": "test_product",
        "dependencies": {"genericModule": {"type": "generic", "tables": ["t1", "t2"]}},
    }
    config = ManifestConfig(**yaml_with_generic)
    assert config.dependencies["genericModule"].tables == ["t1", "t2"]


def test_manifest_schema_generic_rejects_empty_tables():
    """Verify that Generic dependency rejects empty tables."""
    yaml_with_empty_generic = {
        "type": "test_product",
        "dependencies": {"genericModule": {"type": "generic", "tables": []}},
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_empty_generic)


def test_manifest_schema_sap_rejects_s4_only_with_ecc_tables():
    """Verify that SAP dependency rejects s4-only if ecc tables are provided."""
    yaml_with_contradiction = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {
                "type": "sap",
                "supportedVersions": ["s4"],
                "tables": {"ecc": ["t1"]},
            }
        },
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_contradiction)


def test_manifest_schema_sap_rejects_ecc_only_with_s4_tables():
    """Verify that SAP dependency rejects ecc-only if s4 tables are provided."""
    yaml_with_contradiction = {
        "type": "test_product",
        "dependencies": {
            "sapModule": {
                "type": "sap",
                "supportedVersions": ["ecc"],
                "tables": {"s4": ["t1"]},
            }
        },
    }
    with pytest.raises(pydantic.ValidationError):
        ManifestConfig(**yaml_with_contradiction)


def test_sap_dependency_validator_rejects_ecc_tables_for_s4_only():
    """Test that specifying ECC tables while only supporting S4 raises an error."""

    bad_data = {"type": "sap", "supportedVersions": ["s4"], "tables": {"ecc": ["mseg"]}}

    with pytest.raises(pydantic.ValidationError) as exc_info:
        SapDependencyInfo(**bad_data)

    assert "Dependency provides ECC tables, but ECC is not in supported_versions" in str(
        exc_info.value
    )


def test_sap_dependency_validator_accepts_valid_config():
    """Test that a valid config passes validation."""

    good_data = {
        "type": "sap",
        "supportedVersions": ["s4", "ecc"],
        "tables": {"ecc": ["mseg"], "s4": ["matdoc"]},
    }

    # This should not raise an exception
    parsed = SapDependencyInfo(**good_data)
    assert parsed.supported_versions == [SapVersion.S4, SapVersion.ECC]
