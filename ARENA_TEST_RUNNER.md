# Arena Test Runner Agent

The `arena-test-runner` is a specialized agent designed to automate the scaffolding and execution of LLM Arena scenarios.

## Purpose
To ensure consistent folder structures, metadata tracking, and output placement for LLM comparisons that are hosted via GitHub Pages.

## Input Parameters
When invoking this agent, provide:
- `scenario_name`: The name of the challenge (e.g., "gradient", "spreadsheet").
- `llm_model`: The model being tested (e.g., "gpt-4o", "claude-3-5-sonnet").
- `additional_notes`: (Optional) Any specific constraints or context for this run.

## Workflow
1. **Prompt Retrieval**: Read the prompt from `tests/prompts/<scenario_name>.md`.
2. **Folder Creation**: Create a directory named `<scenario_name>_<llm_model>` in the root.
3. **Metadata Creation**: Create `<scenario_name>_<llm_model>/info.md` with:
   - Model Name
   - Scenario Name
   - Date of Execution
   - Link to the prompt file
   - Additional notes
4. **Execution**: Run the specified `llm_model` using the retrieved prompt.
5. **Output Saving**: Save the resulting self-contained HTML as `<scenario_name>_<llm_model>/index.html`.

## Constraints
- Output must be a single `.html` file.
- No external dependencies or CDNs allowed in the generated HTML.
- Folder naming must be lowercase and use underscores for compatibility with URLs.
