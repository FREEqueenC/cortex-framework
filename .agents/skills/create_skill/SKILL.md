---
name: create-skill
description: Guides the design, scaffolding, authoring, validation, and registration of new agentic developer skills following Cortex Framework standards and anatomy rules.
---

# Creating a New Cortex Developer Skill

This skill guides the end-to-end creation, overlap evaluation, authoring, validation, and ecosystem registration of new AI agent skills in Cortex Framework V7, or the creation of custom instruction extensions inside existing skill `custom/` directories.

**CRITICAL OPERATIONAL RULE:** You are an end-to-end deployment agent, not just a text generator. A skill creation task is **NOT** complete until the mandatory **Skill Anatomy Validation Gate** has been executed with a 100% pass rate. You MUST NOT stop after creating the files.

**CRITICAL ISOLATION RULE (ZERO-TRUST FOR CORE PLATFORM):** New skills must reside exclusively inside `.agents/skills/<skill_name>/`. Never modify platform core runtime code (`cortex-framework-core/src/common/`) while authoring skills unless explicitly instructed by the user.

---

## Step 1: Overlap Analysis & Pathway Selection

Before creating a new skill, evaluate existing skills to prevent redundancy and fragmentation.

### 1. Perform Skill Overlap Assessment
Dynamically inspect the existing skills in `.agents/skills/` (and the registry in `.agents/AGENTS.md`). Read their frontmatter descriptions to evaluate whether the requested capability overlaps with an existing workflow.

### 2. Select Pathway: Custom Extension vs. Standalone Skill

Refer to [skill_anatomy_guide.md](references/skill_anatomy_guide.md) and [authoring_best_practices.md](references/authoring_best_practices.md) for the decision matrix:

- **Path A (Custom Extension via `custom/`):** If the proposed capability extends or customizes an existing lifecycle phase (e.g. organization-specific naming standards, custom test assertions, compliance gates, specialized dataset targets), **DO NOT** create a new skill. Instead, proceed to **Step 2A** to create custom instructions in `<existing_skill>/custom/`.
- **Path B (New Standalone Skill):** If the capability introduces a genuinely new domain or distinct lifecycle phase not covered by any existing skill, proceed to **Step 2B** to scaffold and author a new standalone skill.

---

## Step 2A: Author Custom Extension in `custom/` (Path A)

1. Identify target existing skill (e.g. `create_data_product`, `validate_data_product`).
2. Scaffold custom instructions using the script:
   ```bash
   python3 external-skills/.agents/skills/create_skill/scripts/scaffold_skill.py --custom-for <existing_skill_name> --custom-filename custom_instructions.md
   ```
3. Author the custom rules using [custom_instruction_template.md](assets/custom_instruction_template.md).
4. Verify that the file resides in `.agents/skills/<existing_skill>/custom/`.

---

## Step 2B: Scaffold & Author Standalone Skill (Path B)

1. **Scaffold Directory Structure:**
   ```bash
   python3 external-skills/.agents/skills/create_skill/scripts/scaffold_skill.py <skill_name> --description "<Brief description under 1024 chars>"
   ```
2. **Author `SKILL.md`:**
   Use the template in [skill_template.md](assets/skill_template.md).
   - **YAML Frontmatter:** Include `name` (matching directory) and `description` ($\le 1024$ chars).
   - **Operational Rules:** Define non-negotiable trust boundaries and quality gates at the top.
   - **Numbered Steps:** Clearly structure steps (Planning, Implementation, Validation, Reporting).
   - **Link Integrity:** Ensure every relative link points to a real existing file.
3. **Add Supporting Assets & References:**
   - Place templates in `assets/`.
   - Place detailed reference guides in `references/`.
   - Place CLI scripts in `scripts/`.
4. **Ensure `custom/.keep` exists** in the new skill folder.

---

## Step 3: Ecosystem Registration (Standalone Skills)

Register the new skill across the workspace:

1. **Register in `external-skills/.agents/AGENTS.md`:**
   Add an entry under **Lifecycle Slash Commands** mapping the slash command to the skill file.

2. **Register in `external-skills/.agents/skills/using_cortex_skills/SKILL.md`:**
   Update the discovery decision tree and table to include the new skill.

3. **Document in `external-skills/README.md`:**
   Add the skill and command to the index tables.

---

## Step 4: The Validation Quality Gate (MANDATORY)

**DO NOT ASK FOR PERMISSION.** Immediately execute the anatomy validator:

```bash
uv run python3 tests/unit/validate_skills.py
```

Verify that:
- [ ] The validator reports `PASSED` with 0 errors and 0 warnings.
- [ ] Frontmatter `name` and `description` are valid.
- [ ] All relative links resolve cleanly.
- [ ] If unit tests exist, execute `uv run pytest tests/unit`.

---

## Step 5: Generate Completion Report

Generate a final completion report using [skill_creation_report_template.md](assets/skill_creation_report_template.md) and present the summary to the user.
