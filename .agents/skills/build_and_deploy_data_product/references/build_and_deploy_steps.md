## Pre-Requisites and Configuration

1. **Environment Sync:** If you are running the development tools for the first time in a new environment, or if you encounter dependency or execution errors, ensure the environment is synced by configuring internal packages and syncing:
   `uv sync`
   
2. **Identify Configuration File:** The main configuration file for the data product must be provided to the development tools. 
   - **CRITICAL RULE:** Always default to using `config/config.yaml` unless explicitly instructed otherwise by the user. 
   - Before running any commands, check that the intended configuration file exists. If it does not exist, and the user has not provided another configuration file, refer to the `setup-cortex-config` skill to help the user set up the configuration.

## Step 1: Building the Data Product

To build a data product from the configuration files without deploying it, use the `cortex-build` command.

1. Ensure you have the correct configuration file identified (e.g., `config/config.yaml`).
2. Run the build command:
   `uv run cortex-build --config <your_config_file_path.yaml>`
3. Monitor the terminal output for compilation and structural errors. If validation fails (e.g., "Name XXX not found inside YYY"), refer to the `validate-data-product` skill to help the user resolve the missing fields or incorrect references.

## Step 2: Deploying the Data Product

Deploying pushes the compiled data product definitions to the Dataform development workspace.

1. **Explicit Permission Required:** You MUST ALWAYS ask the user if they want to deploy the data product and confirm the configuration file you plan to use before executing the deployment command.
2. Once the user confirms, run the deploy command:
   `uv run cortex-deploy --config <your_config_file_path.yaml>`

## Alternative: Build and Deploy in One Step

If the user wants to perform both actions sequentially and you are confident the build will succeed:

1. **Explicit Permission Required:** As with deploying separately, you MUST ALWAYS ask the user to confirm the deployment step and the configuration file.
2. Once confirmed, run the combined command:
   `uv run cortex-build-and-deploy --config <your_config_file_path.yaml>`

## Post-Deployment Actions

After a successful or attempted deployment:
1. **Generate Deployment Report:** Use the [deployment_report_template.md](../assets/deployment_report_template.md) template to generate a detailed report as a markdown artifact in the standard brain artifacts directory, filling all placeholders and capturing optionals (e.g. seeding operations).
2. **Inform the User:** Inform the user about the generated report, provide details about which Dataform Development Workspace they should open to view the published models, and supply the direct link to the workspace in the Google Cloud Console.

