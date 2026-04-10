import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { unitMaintenanceRequest, resident, household, unit } from '../../db/schema'

export const maintenanceRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.unitMaintenanceRequest.findMany({
        where: eq(unitMaintenanceRequest.communityId, ctx.communityId),
        with: {
          submittedByResident: { columns: { id: true, firstName: true, lastName: true } },
          unit: { columns: { id: true, unitNumber: true, building: true, unitType: true } },
        },
        orderBy: [desc(unitMaintenanceRequest.createdAt)],
      })
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load maintenance requests' })
    }
  }),

  myList: authedProcedure.query(async ({ ctx }) => {
    try {
      const res = await ctx.db.query.resident.findFirst({
        where: eq(resident.id, ctx.user.id),
        with: { household: { with: { unit: true } } },
      })
      const unitId = res?.household?.unit?.id
      if (!unitId) return []

      return await ctx.db.query.unitMaintenanceRequest.findMany({
        where: and(
          eq(unitMaintenanceRequest.communityId, ctx.communityId),
          eq(unitMaintenanceRequest.unitId, unitId),
        ),
        orderBy: [desc(unitMaintenanceRequest.createdAt)],
      })
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load your requests' })
    }
  }),

  submit: authedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      priority: z.enum(['urgent', 'routine']).default('routine'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const res = await ctx.db.query.resident.findFirst({
          where: eq(resident.id, ctx.user.id),
          with: { household: { with: { unit: true } } },
        })
        const unitId = res?.household?.unit?.id
        if (!unitId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No unit assigned to your account.' })

        const [created] = await ctx.db
          .insert(unitMaintenanceRequest)
          .values({
            communityId: ctx.communityId,
            unitId,
            submittedBy: ctx.user.id,
            title: input.title,
            description: input.description,
            priority: input.priority,
          })
          .returning()
        return created
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit request' })
      }
    }),

  updateStatus: boardProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['open', 'in_progress', 'resolved']),
      boardNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(unitMaintenanceRequest)
          .set({
            status: input.status,
            boardNotes: input.boardNotes,
            resolvedAt: input.status === 'resolved' ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(unitMaintenanceRequest.id, input.id),
            eq(unitMaintenanceRequest.communityId, ctx.communityId),
          ))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update request' })
      }
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const req = await ctx.db.query.unitMaintenanceRequest.findFirst({
          where: and(
            eq(unitMaintenanceRequest.id, input.id),
            eq(unitMaintenanceRequest.communityId, ctx.communityId),
          ),
        })
        if (!req) throw new TRPCError({ code: 'NOT_FOUND' })
        if (req.submittedBy !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' })
        if (req.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only open requests can be deleted.' })

        await ctx.db
          .delete(unitMaintenanceRequest)
          .where(eq(unitMaintenanceRequest.id, input.id))
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete request' })
      }
    }),
})
