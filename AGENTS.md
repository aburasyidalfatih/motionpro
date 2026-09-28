<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MotionPro

AI-assisted studio for history motion-graphic videos (Indonesian UI). Plan and phases: see README and the PRD linked there.

- Stack: Next.js 16 (App Router) + Tailwind 4, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`, client in `src/generated/prisma`), BullMQ + ioredis, Remotion 4 (all `remotion`/`@remotion/*` packages pinned to the same exact version).
- Web only enqueues jobs (`enqueueJob` in `src/lib/queue.ts`); the worker (`src/worker`) does the work and writes status/progress to `JobRun`. Add a pipeline stage by adding a handler to the `handlers` map in `src/worker/index.ts`.
- Pages that read the database call `await connection()` so they are not prerendered at build time.
- AI calls go through the `ScriptAI` interface (`src/lib/ai`): Gemini in production, `AI_PROVIDER=fake` for tests without an API key. Output shapes are zod schemas in `src/lib/ai/schemas.ts`, sent to Gemini as JSON Schema and used to validate the response.
- Polling for job progress (`AutoRefresh`) lives in pages, not in `projects/[id]/layout.tsx`: layouts are not re-rendered when switching tabs inside a project.
- Checks before committing: `npm run typecheck`, `npm run lint`, `npm run build`.
- UI copy is in Indonesian.
