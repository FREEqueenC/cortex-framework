#!/usr/bin/env python3
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

"""
scaffold_skill.py
Scaffolds a new agent skill adhering to Cortex Framework standards and anatomy rules,
or scaffolds custom override instructions inside an existing skill's custom/ folder.
"""

import argparse
import os
import sys

def normalize_skill_name(name: str) -> str:
    """Normalizes a skill name to snake_case."""
    name = name.strip().lower().replace('-', '_').replace(' ', '_')
    while '__' in name:
        name = name.replace('__', '_')
    return name.strip('_')

def get_kebab_name(snake_name: str) -> str:
    """Converts snake_case to kebab-case."""
    return snake_name.replace('_', '-')

def scaffold_custom_instructions(
    existing_skill_name: str,
    target_base_dir: str,
    instruction_file_name: str = "custom_instructions.md",
    title: str = "",
) -> str:
    """Creates a custom instructions override file in an existing skill's custom/ directory."""
    snake_name = normalize_skill_name(existing_skill_name)
    skill_dir = os.path.join(target_base_dir, snake_name)
    
    if not os.path.exists(skill_dir):
        raise ValueError(f"Target skill '{snake_name}' does not exist in {target_base_dir}.")

    custom_dir = os.path.join(skill_dir, "custom")
    os.makedirs(custom_dir, exist_ok=True)
    
    target_file = os.path.join(custom_dir, instruction_file_name)
    if not title:
        title = f"Custom Instructions for {snake_name.replace('_', ' ').title()}"

    content = f"""# {title}

## Purpose & Scope
This custom extension overrides and augments the base `{snake_name}` skill with project-specific, organizational, or environment-specific rules.

---

## 1. Additional Quality Gates & Pre-requisites
- Document custom pre-flight checks, required approvals, or data classifications.

---

## 2. Overrides & Extended Behaviors
- **Conventions & Standards**: Document organization-specific naming standards or mandatory audit tags.
- **Target Configurations**: Specify custom datasets, storage classes, or compilation overrides.

---

## 3. Custom Assets & Reference Mapping
- **Templates**: Point to custom templates or organization guidelines.
- **Validation Rules**: Specify custom assertions or additional test suites to run during validation.
"""
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)

    return target_file

def scaffold_skill(
    skill_name: str,
    description: str,
    target_base_dir: str,
    with_assets: bool = True,
    with_references: bool = True,
    with_scripts: bool = False,
) -> str:
    """Scaffolds a new skill folder and files."""
    snake_name = normalize_skill_name(skill_name)
    kebab_name = get_kebab_name(snake_name)

    if not description:
        description = f"Instructions and automated workflow for {kebab_name.replace('-', ' ')}."

    if len(description) > 1024:
        raise ValueError(f"Description length ({len(description)} chars) exceeds maximum allowed 1024 characters.")

    skill_dir = os.path.join(target_base_dir, snake_name)
    os.makedirs(skill_dir, exist_ok=True)

    # 1. Create custom directory with .keep
    custom_dir = os.path.join(skill_dir, 'custom')
    os.makedirs(custom_dir, exist_ok=True)
    keep_file = os.path.join(custom_dir, '.keep')
    if not os.path.exists(keep_file):
        with open(keep_file, 'w', encoding='utf-8') as f:
            f.write('\n')

    # 2. Optional folders
    if with_assets:
        assets_dir = os.path.join(skill_dir, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        report_template = os.path.join(assets_dir, 'report_template.md')
        if not os.path.exists(report_template):
            with open(report_template, 'w', encoding='utf-8') as f:
                f.write(f"# {kebab_name.replace('-', ' ').title()} Execution Report\n\n## Summary\n\n- **Status**: Complete\n- **Details**: Workflow executed successfully.\n")

    if with_references:
        references_dir = os.path.join(skill_dir, 'references')
        os.makedirs(references_dir, exist_ok=True)
        ref_guide = os.path.join(references_dir, 'guidelines.md')
        if not os.path.exists(ref_guide):
            with open(ref_guide, 'w', encoding='utf-8') as f:
                f.write(f"# {kebab_name.replace('-', ' ').title()} Guidelines\n\nDetailed specifications and standard reference rules for {kebab_name}.\n")

    if with_scripts:
        scripts_dir = os.path.join(skill_dir, 'scripts')
        os.makedirs(scripts_dir, exist_ok=True)

    # 3. Create SKILL.md
    skill_md_path = os.path.join(skill_dir, 'SKILL.md')
    if not os.path.exists(skill_md_path):
        ref_link_section = ""
        if with_references:
            ref_link_section = "\n## References\n\n- Refer to [guidelines.md](references/guidelines.md) for detailed requirements.\n"

        content = f"""---
name: {kebab_name}
description: {description}
---

# {kebab_name.replace('-', ' ').title()}

## Overview

{description}

---

## Workflow Steps

### Step 1: Planning and Requirements Gathering

1. Clarify the user request and confirm expectations before making modifications.
2. Explicitly surface all assumptions regarding inputs, configuration, datasets, or environments.
3. Propose an implementation plan and wait for user confirmation.

### Step 2: Implementation

1. Execute the required tasks following domain best practices and coding standards.
2. Ensure changes respect module boundaries and project isolation rules.

### Step 3: Automated Validation & Quality Gate

1. Run all relevant automated tests, linters, and verification commands.
2. Generate an execution report documenting results and validation status.
{ref_link_section}"""
        with open(skill_md_path, 'w', encoding='utf-8') as f:
            f.write(content)

    return skill_dir

def main():
    parser = argparse.ArgumentParser(description="Scaffold a new Cortex developer agent skill or custom override.")
    parser.add_argument("skill_name", help="Name of the skill (e.g., my_custom_skill)")
    parser.add_argument("--description", "-d", default="", help="Description for YAML frontmatter (under 1024 chars)")
    parser.add_argument("--target-dir", "-t", default="", help="Base directory where skills are placed (defaults to .agents/skills)")
    parser.add_argument("--custom-for", help="Target an existing skill to create a custom/ instruction override file instead of a new skill")
    parser.add_argument("--custom-filename", default="custom_instructions.md", help="Filename for custom instructions (used with --custom-for)")
    parser.add_argument("--no-assets", action="store_true", help="Skip creating assets/ directory")
    parser.add_argument("--no-references", action="store_true", help="Skip creating references/ directory")
    parser.add_argument("--with-scripts", action="store_true", help="Create scripts/ directory")

    args = parser.parse_args()

    if not args.target_dir:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        args.target_dir = os.path.abspath(os.path.join(script_dir, '..', '..'))

    try:
        if args.custom_for:
            file_path = scaffold_custom_instructions(
                existing_skill_name=args.custom_for,
                target_base_dir=args.target_dir,
                instruction_file_name=args.custom_filename,
            )
            print(f"✓ Successfully created custom instructions at: {file_path}")
        else:
            skill_dir = scaffold_skill(
                skill_name=args.skill_name,
                description=args.description,
                target_base_dir=args.target_dir,
                with_assets=not args.no_assets,
                with_references=not args.no_references,
                with_scripts=args.with_scripts,
            )
            print(f"✓ Successfully scaffolded skill at: {skill_dir}")
            print(f"  - SKILL.md: Created")
            print(f"  - custom/.keep: Created")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
