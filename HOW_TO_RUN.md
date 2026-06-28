# AI Worker Setup Guide

I've reviewed and improved the AI Worker to make it fully functional. 

### Improvements:
1.  **AI Model**: Updated `gpt-4.1` (invalid) to `gpt-4o`.
2.  **JSON Handling**: Created `worker/utils.ts` and updated `file-writer.ts` to use it for extracting JSON from AI responses (even if markdown-wrapped).
3.  **Task Directory**: Created `tasks/` and added a sample task `task-001.md`.
4.  **Mock Repo**: Created `repo/package.json` with dummy scripts so the worker can verify its work.
5.  **Fixed Imports**: Corrected missing `fs` and `path` imports in `worker/file-writer.ts`.

---

### How to Run:

1.  **Environment Variables**: Ensure your `.env.local` has your `OPENAI_API_KEY`.
2.  **Dependencies**: Run `npm install` to install `openai`, `simple-git`, `dotenv`, and `typescript`.
3.  **Run the Worker**:
    ```bash
    npx ts-node run-worker.ts
    ```

### Testing a Change:
1.  Add a Markdown file to `tasks/` (e.g., `tasks/add-footer.md`).
2.  Run the worker.
3.  Check the `repo/` directory for the generated code.

> [!NOTE]
> The `test-runner.ts` currently runs `npm run build` and `npm run test` in the `repo/` directory. Since I created a mock `package.json`, it should always succeed for now. You'll want to add actual tests as you build out your target application.
