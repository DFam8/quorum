---
name: db-query
description: Guides Drizzle ORM for Quorum—schema layout in server/db/schema.ts, snake_case columns, explicit relations, and type-safe query patterns (select, insert, update, joins, relational query API). Use when writing or reviewing DB access, tRPC handlers that query Postgres, Drizzle relations, or when the user mentions schema, SQL, or type-safe queries.
---

# Quorum — Drizzle DB queries

## Before writing a query

1. **Read** `server/db/schema.ts` (canonical). If tables are not implemented yet, use `hoa-platform-dev-doc.md` §15 as the intended shape—still match project rules (snake_case columns, explicit `relations()`).
2. **Use** the shared client from `server/db/index.ts` (typically `ctx.db` in tRPC).
3. **Never** query the DB from Vue pages/components—only from server code (usually tRPC procedures).

## Schema conventions (Quorum)

| Rule | Detail |
|------|--------|
| Columns | **snake_case** in the database string; TypeScript property names follow Drizzle column defs (often camelCase in code, e.g. `communityId` maps to `community_id`). |
| Tables | `pgTable('table_name', { ... })` — plural/snake table names as in §15 (`community`, `unit`, `resident`, …). |
| Enums | `pgEnum` exports align with Zod `z.enum([...])` in routers. |
| FKs | `.references(() => otherTable.id)` on columns. Self-references may need `(): typeof vote => vote.id` style for inference. |
| Uniqueness | Composite uniques via table callback + `unique().on(...)` (see `ballot` in §15). |

Always define **`relations()`** for every table that is joined or loaded via `db.query.*`. Mirror FK direction: `one` / `many` with `fields` / `references`.

## Imports (typical)

```ts
import { eq, and, or, desc, asc, sql, inArray, isNull } from 'drizzle-orm'
import * as schema from '~/server/db/schema'
// or: import { resident, household, unit, ... } from '~/server/db/schema'
```

Adjust import alias to match the project (`~/server` vs relative).

## Type-safe selects

- **Prefer** `db.select().from(table).where(...)` so selected columns infer row types.
- **Narrow** columns: `.select({ id: table.id, name: table.name })` for stable return types and smaller payloads.
- **Explicit return type** on procedure handlers when mapping rows: `Promise<SomeDto>`.

```ts
const rows = await db
  .select({
    id: schema.resident.id,
    email: schema.resident.email,
  })
  .from(schema.resident)
  .where(eq(schema.resident.householdId, householdId))
  .orderBy(desc(schema.resident.createdAt))
  .limit(50)
```

## Joins and filters

- **Inner join**: `.from(a).innerJoin(b, eq(a.fk, b.id))`.
- **Optional match**: `leftJoin` + `isNull` / `or` as needed.
- **IN lists**: `inArray(column, ids)` (guard empty array—short-circuit or skip clause).
- **JSON / text search**: use `sql` template only when operators are awkward in the query builder; prefer Drizzle helpers first (project rule: no raw SQL unless necessary).

## Insert / update / delete

- **Insert**: `db.insert(table).values({ ... }).returning()` — prefer `.returning({ id: table.id })` to get typed keys.
- **Update**: `db.update(table).set({ ... }).where(eq(table.id, id)).returning()`.
- **Delete**: rare; prefer soft flags (`hidden`, `archivedAt`, `status`) if the domain uses them.
- Use **transaction** `db.transaction(async (tx) => { ... })` when multiple writes must succeed or fail together.

## Relational query API (`db.query`)

Use when you want nested shapes without manual joins:

```ts
await db.query.resident.findFirst({
  where: eq(schema.resident.id, id),
  with: {
    household: {
      with: { unit: true },
    },
  },
})
```

**Requirements**: `relations()` must exist for `resident` → `household` → `unit`. Name keys in `with` to match relation property names on the schema relations object.

## Common patterns

| Goal | Pattern |
|------|---------|
| Scoped by community | Join through `unit` / `household` / `communityId` on the entity (see §15 FKs). |
| Pagination | `limit` + `offset` or cursor on `(createdAt, id)` with `and` / `lt` / `gt`. |
| “Exists” | `exists` subquery via `sql` or separate `select` + check; avoid N+1 in loops. |
| Count only | `db.select({ count: sql<number>`count(*)::int` }).from(...)` or `db.$count` if configured. |

## Errors and security

- Procedures: **try/catch**, throw `TRPCError` (see `new-router` skill).
- **Do not** interpolate user input into `sql` strings—use bound parameters / `eq`, `inArray`, etc.
- Enforce **authorization** in the procedure (middleware + resource checks); Drizzle does not enforce RLS unless you rely on Supabase RLS + a compatible client—assume app-layer checks for Quorum tRPC.

## Related project docs

- Full table/enum listing: `hoa-platform-dev-doc.md` §15.
- tRPC procedure shape and Zod: `.cursor/skills/new-router/SKILL.md`.
