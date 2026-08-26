# Cortex Skill Anatomy & Specification Guide

This guide defines the anatomical structure, schema constraints, overlap evaluation criteria, and file organization rules for Cortex Framework agent skills.

---

## 1. Skill Creation vs. Custom Extension Decision Matrix

Before creating a new skill, evaluate whether the proposed functionality should be a **New Standalone Skill** or a **Custom Folder Extension (`custom/`)** of an existing skill.

| Criterion | New Standalone Skill | Custom Extension (`custom/`) |
| :--- | :--- | :--- |
| **Domain Scope** | Brand new lifecycle phase or distinct domain (e.g. data catalog sync, semantic lineage extraction). | Extending existing lifecycle phase (e.g. adding organization-specific column naming, custom test rules, company deployment pipelines). |
| **Overlap** | Low/None (< 30% overlap with existing skills). | High (> 50% overlap with an existing skill like `create_data_product`, `validate_data_product`, or `build_and_deploy_data_product`). |
| **Slash Command** | Requires a dedicated top-level lifecycle slash command. | Triggered transparently when invoking the existing skill. |
| **Target Location** | Dedicated folder `.agents/skills/<new_skill>/`. | File(s) inside `.agents/skills/<existing_skill>/custom/`. |

---

## 2. Directory Structure

Every skill lives inside `.agents/skills/<skill_name>/` where `<skill_name>` is snake_case (e.g., `create_data_product`).

```
.agents/skills/<skill_name>/
├── SKILL.md                          # Mandatory: Main instructions and entry point
├── custom/                           # Mandatory: Folder for project-level overrides
│   └── .keep                         # Empty placeholder ensuring git tracking
├── assets/                           # Optional: Templates, sample snippets, report templates
│   ├── example_template.md
│   └── report_template.md
├── references/                       # Optional: Deep architectural guides and references
│   └── reference_guide.md
└── scripts/                          # Optional: Helper CLI utilities executed during the skill
    └── helper_script.py
```

---

## 3. Frontmatter Specifications

The `SKILL.md` file MUST begin with a valid YAML frontmatter block enclosed by `---`:

```yaml
---
name: create-skill
description: Clear, concise summary of what this skill does and when the agent should trigger it. Must be under 1024 characters.
---
```

### Frontmatter Validation Rules:
1. **`name`**: Required. Must match the directory name (either exact match `create_skill` or kebab-case `create-skill`).
2. **`description`**: Required. Must be a non-empty string with length $\le 1024$ characters. Must clearly state both **what** the skill accomplishes and **when** it should be triggered.
3. **No Unrecognized Keys**: Avoid proprietary or unparsed frontmatter properties.

---

## 4. Link Integrity Rules

All relative markdown links inside `SKILL.md` or any file in `references/` MUST resolve to a real existing file:
- Target files referenced in markdown links must exist on disk.
- Links must point directly to files, never directories.
- Anchor fragments (e.g., `#section`) are stripped during path resolution.

---

## 5. Custom Folder Extensibility Pattern

To support downstream user customizations without risking merge conflicts during upstream framework updates:
- Every skill includes a `custom/` directory with a `.keep` file by default.
- Agents are instructed to check `custom/` first. If any markdown files or custom templates exist in `custom/`, the agent merges and prioritizes those instructions over the base `SKILL.md`. If the folder is empty (only `.keep`), standard instructions are used.
- Common use cases for `custom/`:
  - Enforcing organization-specific naming standards or mandatory audit tags.
  - Adding company-specific test fixtures to `create_python_tests`.
  - Adding pre-deployment compliance checks to `build_and_deploy_data_product`.

---

## 6. Automated Validation Gate

Before publishing or committing any skill, run the anatomy validator:

```bash
uv run python3 tests/unit/validate_skills.py
```

This verifies:
- YAML frontmatter presence and formatting.
- `name` matches directory name.
- `description` presence and length constraint ($\le 1024$ chars).
- Absence of lingering placeholder markers.
- All markdown links resolve to valid, existing files.
