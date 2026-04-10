Guide me through creating and running a Drizzle migration for the Quorum project.

First ask: what schema change do I need to make?

Then:
1. Show me the exact change to make in server/db/schema.ts
2. Give me the terminal command to generate the migration:
   npx drizzle-kit generate
3. Tell me where the migration file will appear (drizzle/ folder)
4. Give me the command to run the migration against Supabase:
   npx drizzle-kit migrate
5. Remind me to check the generated SQL file before running it
6. If this is a destructive change (dropping columns, changing types), warn me explicitly and suggest a safer approach (add new column, migrate data, drop old column in separate migration)

Rules to follow for schema changes:
- Always use snake_case for new column names
- New columns should have defaults or be nullable — never add a NOT NULL column without a default to an existing table
- Enum changes require special handling — ask before proceeding
- Always add the column to the TypeScript schema AND check if any existing queries need updating