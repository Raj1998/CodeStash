# CodeStash

## Project / branch safety

- This repo stores multiple projects on different git branches. Before changing code, verify the current branch belongs to the intended project.
- Project main branches use `project-[project-name]/main`.
- Working branches use `project-[project-name]/[branch-type:feat/fix/chore]/[feature-name]`.
- If you are starting work on a new project and its project-specific branch structure does not exist yet, create that structure before making code changes.
- There is a repo-local OpenCode helper at `.opencode/commands/switch-project.md`. It uses `git checkout` and says to ask the user before switching branches if the working tree is dirty.

## DevStash

- `project-devstash/main` is DevStash: A developer knowledge hub for snippets, commands, prompts, notes, files, images, links and custom types.

## Context files

Read the following to have full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Current repo scaffold

- The current `project-devstash/main` branch is a single Next.js app, not a package workspace. Top-level scripts are `npm run dev`, `npm run build`, `npm run start`, and `npm run lint` only.
- There is no repo-defined `test`, `typecheck`, or `codegen` script in `package.json`. Do not assume they exist.
- The app uses the App Router under `src/app/` and the TypeScript alias `@/* -> ./src/*`.
- `next.config.ts` enables `reactCompiler: true`; avoid making React behavior assumptions that conflict with that setting.

## Next.js version caution

- This project uses Next.js `16.2.4` with React `19.2.4`. Do not rely on older Next.js habits or training-data defaults.
- Before making framework-level changes, read the relevant local docs in `node_modules/next/dist/docs/`.
- Treat local Next.js docs and repo config as the source of truth when they differ from generic documentation or memory.
- `next build` should not be treated as a lint step here; linting is run separately via `npm run lint`.
