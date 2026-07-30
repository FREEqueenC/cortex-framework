---
name: build-and-deploy-data-product
description: Instructions on how to build and deploy a data product in Cortex Framework V7.
---

# Building and Deploying a Data Product

When asked to build, deploy, or build and deploy a data product in Cortex Framework V7, you MUST follow the instructions and steps outlined in [build_and_deploy_steps.md](references/build_and_deploy_steps.md) to ensure the correct development tools and configuration files are used.

---

## 📊 Mandatory Deployment Reporting

At the end of every build and deployment action (successful or otherwise), you **MUST** generate a comprehensive **Data Product Deployment Report** as an artifact in the standard brain artifacts directory using the template located at:
*   [deployment_report_template.md](assets/deployment_report_template.md)

Fill in all placeholders (e.g. timeline times, GCP parameters, statuses, console links) accurately based on your execution results, including any optional setups (such as seeding raw data or verifying assertions). Refer to the generated report in your final response to the user.

