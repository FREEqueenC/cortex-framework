# 🛠️ Skill Creation & Registration Report

## 1. Skill Metadata Summary

| Attribute | Value |
| :--- | :--- |
| **Skill Name** | `{skill_name}` |
| **Directory** | `.agents/skills/{skill_dir}/` |
| **Slash Command** | `/{slash_command}` |
| **Description Length** | `{desc_length} chars (Limit: 1024)` |
| **Creation Type** | `[New Standalone Skill / Custom Folder Extension]` |
| **Custom Folder Enabled** | Yes (`custom/.keep`) |

---

## 2. Overlap & Scope Evaluation

| Evaluation Metric | Assessment | Rationale |
| :--- | :--- | :--- |
| **Overlap with Existing Skills** | `[Low (<30%) / High (>50%)]` | {overlap_rationale} |
| **Target Pathway** | `[New Standalone Skill / Custom Override in <existing_skill>/custom/]` | {pathway_reasoning} |

---

## 3. Directory & Asset Manifest

- [x] `SKILL.md` (Main instructions and workflow gates)
- [ ] `assets/` (Templates, example payloads, and reporting structures)
- [ ] `references/` (In-depth guides, schema references, and documentation)
- [ ] `scripts/` (Executable Python/CLI helper scripts)
- [x] `custom/.keep` (Directory for downstream project-specific customizations)

---

## 4. Registration Status

- [ ] Registered in `.agents/AGENTS.md` (Slash command mapping)
- [ ] Registered in `.agents/skills/using_cortex_skills/SKILL.md` (Discovery tree)
- [ ] Documented in `README.md` (Command & Skill index tables)

---

## 5. Quality Gate Ledger

| Check | Tool / Validator | Status | Details |
| :--- | :--- | :--- | :--- |
| **Frontmatter Validation** | `validate_skills.py` | `[PASS / FAIL]` | Name matches directory and description is present. |
| **Link Integrity** | `validate_skills.py` | `[PASS / FAIL]` | All relative links resolve to existing files. |
| **Placeholder Check** | `validate_skills.py` | `[PASS / FAIL]` | No temporary placeholder strings remain. |
| **Custom Extensibility** | Filesystem check | `[PASS / FAIL]` | `custom/` directory present with `.keep`. |

---

## 6. Next Steps & Usage Guide

To test or invoke the newly created skill:
1. Load the skill instructions using `/{slash_command}` or reference the file directly.
2. Verify that your agent follows the workflow and enforces quality gates.
