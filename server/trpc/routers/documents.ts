import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { document } from '../../db/schema'

export const DOCUMENT_CATEGORIES = ['governing', 'budget', 'minutes', 'other'] as const
export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  governing: 'Governing Documents',
  budget: 'Budget & Financials',
  minutes: 'Meeting Minutes',
  other: 'Other',
}

export const documentsRouter = router({
  // Returns only root/current documents (parentId IS NULL = latest version)
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.document.findMany({
        where: and(
          eq(document.communityId, ctx.communityId),
          isNull(document.parentId),
        ),
        with: { uploadedByResident: { columns: { id: true, firstName: true, lastName: true } } },
        orderBy: [desc(document.createdAt)],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  // Returns archived (older) versions of a document — newest first
  getVersions: authedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.query.document.findMany({
          where: and(
            eq(document.communityId, ctx.communityId),
            eq(document.parentId, input.documentId),
          ),
          with: { uploadedByResident: { columns: { id: true, firstName: true, lastName: true } } },
          orderBy: [desc(document.version)],
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  // Create a new document. When parentId is provided, archives the current version
  // and updates the root doc in place — so the list always shows the latest.
  create: boardProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      category: z.enum(DOCUMENT_CATEGORIES),
      fileUrl: z.string().url(),
      fileSizeBytes: z.number().int().positive().optional(),
      changeNote: z.string().max(500).optional(),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        if (input.parentId) {
          const parent = await ctx.db.query.document.findFirst({
            where: and(
              eq(document.id, input.parentId),
              eq(document.communityId, ctx.communityId),
            ),
          })
          if (!parent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' })

          // Archive the current version as a child record
          await ctx.db.insert(document).values({
            communityId: ctx.communityId,
            name: parent.name,
            category: parent.category,
            fileUrl: parent.fileUrl,
            fileSizeBytes: parent.fileSizeBytes,
            version: parent.version,
            changeNote: parent.changeNote,
            parentId: parent.id,
            uploadedBy: parent.uploadedBy,
            createdAt: parent.createdAt,
          })

          // Update the root doc to become the new version
          await ctx.db
            .update(document)
            .set({
              fileUrl: input.fileUrl,
              fileSizeBytes: input.fileSizeBytes ?? null,
              changeNote: input.changeNote ?? null,
              version: parent.version + 1,
              uploadedBy: ctx.user.id,
              createdAt: new Date(),
            })
            .where(eq(document.id, parent.id))

          return { id: parent.id }
        }

        const [created] = await ctx.db
          .insert(document)
          .values({
            communityId: ctx.communityId,
            name: input.name,
            category: input.category,
            fileUrl: input.fileUrl,
            fileSizeBytes: input.fileSizeBytes ?? null,
            version: 1,
            changeNote: input.changeNote ?? null,
            parentId: null,
            uploadedBy: ctx.user.id,
          })
          .returning({ id: document.id })

        if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
        return { id: created.id }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  delete: boardProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        // Delete all version history first, then the root doc
        await ctx.db
          .delete(document)
          .where(and(eq(document.parentId, input.id), eq(document.communityId, ctx.communityId)))
        await ctx.db
          .delete(document)
          .where(and(eq(document.id, input.id), eq(document.communityId, ctx.communityId)))
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),
})
