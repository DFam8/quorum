Create a new tRPC router for the Quorum project.

Ask me:
1. What domain is this router for? (e.g. announcements, meetings, votes)
2. What procedures does it need? List each one with: name, input fields, output, and required role (public / authed / board / superAdmin)

Then generate the complete router file following these rules:
- Import from ~/server/db/schema and drizzle-orm
- Use publicProcedure, authedProcedure, boardProcedure, or superAdminProcedure correctly
- Validate ALL inputs with Zod
- Wrap ALL procedures in try/catch, throw TRPCError with correct code
- Always scope DB queries to ctx.communityId
- Use .returning() after all insert/update operations
- Add audit log entries for significant mutations (create, update, delete, hide, publish, role changes)
- Never hard delete — use hidden/archived/status flags

Also output:
- The import line to add to server/trpc/index.ts
- Any new Zod schemas that should go in types/index.ts

Output the complete file content ready to paste.