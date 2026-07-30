---
name: generate-er-diagram
description: Generates Entity-Relationship (ER) diagrams from Cortex data product(s) in dot notation, mermaid diagrams, or draw.io XML formats.
---

# Generating Entity-Relationship (ER) Diagrams

This skill allows agents to automatically generate clean, structured Entity-Relationship (ER) diagrams from one or more Cortex data products. The diagrams represent data models, primary keys, and relationships inferred from the data product's manifest, annotations, and definitions.

---

## Core Operating Behaviors

When asked to generate an ER diagram for a data product:

1.  **Establish Output Format (CRITICAL):**
    *   You **MUST** check if the user has specified the desired format for the ER diagram (e.g., `dot`, `mermaid`, `draw.io`, or `all`).
    *   **If the format is not specified, you MUST explicitly ask the user:**
        > "Which format would you like to use for the ER diagram?
        > 1. Mermaid diagram (.mmd) - Best for quick markdown integration (also creates a .md file for immediate visual preview)
        > 2. Graphviz dot notation (.dot) - Best for custom graph rendering
        > 3. draw.io XML (.drawio) - Best for importing directly into draw.io as an interactive layout
        > 4. All formats - Generates Mermaid, DOT, and draw.io diagrams concurrently"
    *   Wait for the user's choice before executing the generator.

2.  **Locate target data product:**
    *   Determine the name or folder of the data product to analyze. If it is not specified, look inside `src/data_modules/<namespace>/<source>/products/` for available products.

3.  **Execute the generator script:**
    *   Use the virtualenv Python interpreter to run the tool:
        ```bash
        cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <data_product_path_or_name> -f <mermaid|dot|drawio> [options]
        ```
    *   **Optional Flags:**
        *   `--include-siblings`: Include sibling data products in the same namespace to map cross-product relationships. (Disabled by default to prevent oversized diagrams).
        *   `--all-foundation-fields`: Render all fields for foundation tables (by default only keys and relationship-participating fields are shown to avoid clutter).
        *   `--all-data-product-fields`: Render all fields for data product tables (by default only keys and relationship-participating fields are shown to avoid clutter).
    *   *Note:* If the user selects **All formats**, execute the generator command three times sequentially, once for each format option (`mermaid`, `dot`, `drawio`).

4.  **Confirm Output:**
    *   The tool will write the output file directly in the data product's directory alongside the data product itself, named `<type>_erd.<ext>`.
    *   *Note:* When generating in `mermaid` format, the tool will also automatically output a `<type>_erd.md` preview file wrapping the Mermaid diagram in a Markdown code block for immediate visual rendering in your editor or viewer's Markdown preview.
    *   Present the generated diagram content (especially for `mermaid`) to the user, along with the path to the saved file(s).

---

## Supported Diagram Formats

*   **Mermaid (`mermaid`, `.mmd`)**: A clean text-based diagramming language that renders automatically in markdown previews (such as GitHub, VS Code, or Gemini). Excellent for code-first documentation.
*   **Graphviz DOT (`dot`, `.dot`)**: A powerful, declarative graph description language using HTML-like table labels. Ideal for complex hierarchical visualizations.
*   **draw.io XML (`drawio`, `.drawio`)**: An uncompressed mxGraph XML file ready to be imported into draw.io or diagram.net for further manual layout styling and interactive editing.

---

## Quick Start / Manual Execution

To manually run the ER diagram generator from the workspace root:

```bash
# For Mermaid (default fields)
cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <type> -f mermaid

# For Graphviz DOT (with all foundation fields)
cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <type> -f dot --all-foundation-fields

# For draw.io XML (including sibling data products)
cortex-framework-core/.venv/bin/python external-skills/.agents/skills/generate_er_diagram/scripts/generate_er_diagram.py -p <type> -f drawio --include-siblings
```
