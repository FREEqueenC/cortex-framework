# Skill Authoring & Quality Gate Best Practices

This guide outlines best practices for evaluating overlap, writing effective agent skills, and structuring custom folder overrides within the Cortex Framework ecosystem.

---

## 1. Skill Overlap & Redundancy Prevention

When designing a new skill, evaluate existing skills across the workspace to avoid fragmenting workflows:

### Evaluation Process:
1. **Discover Current Skills**: Inspect `.agents/skills/` and review registered commands in `.agents/AGENTS.md`.
2. **Review Skill Scopes**: Read each skill's frontmatter `description` to understand its covered domain (e.g. environment configuration, scaffolding, mutation, testing, validation, deployment, DDIC discovery, ER diagram generation).
3. **Apply Decision Heuristic**:
   - **Custom Folder Extension (`custom/`)**: If the requirement modifies, augments, or adds organization-specific rules to an existing workflow (e.g. "We need custom column prefixes added during data product creation" or "We need custom compliance checks before deployment"), **DO NOT** create a new skill. Instead, author an override file inside that skill's `custom/` directory.
   - **New Standalone Skill**: If the requirement introduces a genuinely new lifecycle phase or distinct domain not covered by any existing skill, create a **New Skill**.

---

## 2. Core Principles of Agent Instructions

### A. Clear Operational Rules & Trust Boundaries
- Begin the `SKILL.md` with explicit, non-negotiable operational rules.
- State zero-trust platform boundaries (e.g. "Do not modify core framework packages unless explicitly instructed").
- Define what constitutes "done" (e.g. "Your task is NOT complete until all validation gates pass").

### B. Proactive Planning & User Confirmation
- For complex multi-step workflows, require the agent to propose an implementation plan and wait for confirmation before mutating code.
- Provide a standardized plan template in `assets/plan_template.md` to ensure predictable formatting.

### C. Deterministic Execution over Speculation
- Encode exact CLI commands (e.g., `uv run cortex-build --config ...`, `uv run pytest`).
- Provide dedicated helper scripts under `scripts/` when tasks require complex API calls, DDIC lookups, or multi-format rendering.

### D. Zero Regressions & Mandatory Verification
- Require running automated tests and quality gates at the end of each workflow.
- Do not stop after file generation. The agent must verify compilation and test suite execution.

---

## 3. Custom Folder Override Patterns

When writing instructions for `.agents/skills/<skill_name>/custom/`:
- Keep instructions focused on overrides (e.g., `custom_naming_rules.md`, `custom_checks.md`).
- Explicitly state what takes precedence over the default `SKILL.md`.
- Ensure all custom templates placed in `custom/` are well-documented.

---

## 4. Registering Skills Across the Ecosystem

When adding a new standalone skill to the repository, register it in three places:

1. **`external-skills/.agents/AGENTS.md`**:
   Add an entry under **Lifecycle Slash Commands** mapping the slash command to the skill file.

2. **`external-skills/.agents/skills/using_cortex_skills/SKILL.md`**:
   Add the skill to the decision tree under **Skill Discovery**.

3. **`external-skills/README.md`**:
   Add the skill to the **Commands** table and the **Skills** list.
