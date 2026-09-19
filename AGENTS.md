<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# IMPORTANT PROJECT WORKFLOW — FOLLOW THIS FOR EVERY TASK

Before doing ANY coding, modification, debugging, SQL, database, UI, feature, or configuration work:

1. FIRST read these project context/status files:
   - Status.md
   - projectstatus.md
   - CLAUDE.md
   - AGENTS.md
   - README.md (when relevant)

2. Understand the existing project state from these files before inspecting the whole codebase.
   Do NOT unnecessarily reread the entire project if the context files already provide the required information.

3. Then understand the CURRENT request and perform the requested work directly in the project files.
   Do NOT ask to manually copy/paste code or SQL when you can safely edit the actual project files yourself.

4. For database migrations:
   - Prefer creating/fixing the migration file directly in the project.
   - Verify the actual file contents after editing.
   - Do NOT repeatedly generate SQL in chat for copy/paste.

5. After completing the requested work:
   - Test the relevant functionality.
   - Run TypeScript/type checks when appropriate.
   - Run the production build when appropriate.
   - Fix errors found during testing before declaring the task complete.

6. ALWAYS update Status.md and/or projectstatus.md after meaningful changes.
   Record:
   - What was changed
   - What is working
   - What remains pending
   - Any important configuration/database notes
   - The latest testing/build result

7. ALWAYS check Git status after completing the task.

8. If changes are complete and verified:
   - Create a meaningful Git commit.
   - Push the commit to the GitHub remote on the current main branch.
   - Verify that the working tree is clean and the push succeeded.

9. NEVER claim that Git commit, GitHub push, build, testing, or file updates succeeded unless you actually verified the result.

10. At the end, give a short summary:
   - Changes completed
   - Tests/build result
   - Status file updated
   - Git commit result
   - GitHub push result
   - Any remaining issue
