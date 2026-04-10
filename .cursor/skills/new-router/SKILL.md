---
name: new-router
description: Adds or extends Quorum tRPC routers using the project file layout, procedure middleware ladder (public through superAdmin), Zod-validated inputs, try/catch with TRPCError, and Drizzle queries against server/db/schema.ts. Use when creating a new router, new procedure, or when the user mentions tRPC routers, procedures, or server API shape for Quorum.
---

# Quorum — New tRPC Router

## Layout (do not invent new paths)

| Piece | Path |
|-------|------|
| App router root | `server/trpc/index.ts` |
| Context (session, user, db) | `server/trpc/context.ts` |
| Domain routers | `server/trpc/routers/<domain>.ts` (one file per domain) |
| HTTP handler | `server/api/trpc/[trpc].ts` |
| Drizzle schema | `server/db/schema.ts` |
| DB client | `server/db/index.ts` |
| Permission helpers | `utils/permissions.ts` |

Merge each domain router in the app router root. Name the export after the domain (e.g. `announcements`, `meetings`).

For the full procedure inventory per domain, see `hoa-platform-dev-doc.md` §14. For table/column patterns, see §15.

## Middleware ladder (strictest wins per procedure)

Use exactly one of these builders per procedure — pick the **minimum** access the endpoint needs:

| Builder | Who |
|---------|-----|
| `publicProcedure` | Unauthenticated (e.g. invite landing, magic link callback) |
| `authedProcedure` | Any signed-in resident |
| `boardProcedure` | Board members and Super Admin |
| `superAdminProcedure` | Super Admin only |

**Rules**

- Do not re-check the same role in the handler if the middleware already guarantees it (avoid duplicate `isBoard` when using `boardProcedure`).
- For resource-level rules (e.g. “only author can edit draft”), use `authedProcedure` (or tighter) plus `canEdit` / explicit checks from `utils/permissions.ts`.
- Client pages and components never import Drizzle or the DB; they call tRPC only.

## Zod pattern (every procedure)

- Every procedure that accepts input **must** use `.input(z.object({ ... }))` (or a named `z` schema). No unvalidated `input`.
- Reuse shapes where it helps: `const idSchema = z.object({ id: z.string().uuid() })` in the same file or a colocated `schemas.ts` under `server/trpc/` if shared across routers.
- Prefer `z.string().uuid()`, `z.enum([...])` aligned with Drizzle/pg enums, `z.coerce` only when the source is query/string-like and intentional.
- Export inferred types from Zod only when needed outside the router: `type XInput = z.infer<typeof xSchema>`.

## Procedure template

Follow this shape for new procedures (adjust procedure type and schema):

```ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

// example: boardProcedure from ../trpc (actual import path = project convention)
export const announcementsRouter = createTRPCRouter({
  create: boardProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        body: z.string().min(1),
        priority: z.enum(['urgent', 'general']),
        pinned: z.boolean(),
        sendEmail: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        // use ctx.db, ctx.user as provided by context.ts
        return { id: '...' }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
          cause: err,
        })
      }
    }),
})
```

**Error codes**: use appropriate `TRPCError` codes (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`, etc.), not generic strings only.

## Drizzle query pattern

- Import tables (and enums) from `server/db/schema.ts`. Use the shared `ctx.db` (or equivalent) from context — never instantiate a new pool per request.
- **Column names** in PostgreSQL are `snake_case`; in Drizzle column definitions use that in the first argument to column helpers (e.g. `timestamp('created_at')`). Property names on the schema object follow the project’s existing style (see live `schema.ts`).
- Prefer `eq`, `and`, `or`, `desc`, `sql` template only when Drizzle cannot express the query otherwise (per `.cursorrules`).
- Use `.returning()` on inserts/updates when the API needs the row; use typed selects, not `select *` without typing.
- Define and use `relations()` in schema for nested queries where appropriate; avoid N+1 when `db.query` with `with` is clearer.

## Naming

- Router file: `server/trpc/routers/<domain>.ts` — domain name plural or conventional module name (`announcements`, `votes`, `ai`).
- Procedure names: verb or verb phrase, `camelCase` — `list`, `getById`, `create`, `hide`, `boardAccept`.
- Nested routers: use `createTRPCRouter` sub-routers for clear grouping (e.g. `meetings.agenda.publish`, `meetings.minutes.save`).

## AI router exception

`server/trpc/routers/ai.ts`: all Anthropic usage stays here; log `ai_assisted`, `ai_mode`, `ai_tone`, `ai_input`, `ai_input_type` per product rules; zero data retention headers on API calls. Never call Anthropic from the client.

## Cross-check

Before finishing: align with `.cursorrules` (Zod on all inputs, try/catch + `TRPCError`, no `any`, explicit return types).
