import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { minutes, minutesApproval, meeting, residentRole } from '../../db/schema'

async function getMinutesForMeeting(
  db: Parameters<Parameters<typeof authedProcedure.query>[0]>[0]['ctx']['db'],
  meetingId: string,
  communityId: string,
) {
  const m = await db.query.meeting.findFirst({
    where: and(eq(meeting.id, meetingId), eq(meeting.communityId, communityId)),
  })
  if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
  return db.query.minutes.findFirst({
    where: eq(minutes.meetingId, meetingId),
    with: {
      approvals: {
        with: { resident: { columns: { id: true, firstName: true, lastName: true } } },
      },
    },
  })
}

export const minutesRouter = router({
  // Autosave — board only. Creates if not exists, updates body only if not published.
  upsert: boardProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.minutes.findFirst({
          where: eq(minutes.meetingId, input.meetingId),
        })
        if (existing) {
          if (existing.status === 'published') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Published minutes cannot be edited' })
          }
          const [updated] = await ctx.db
            .update(minutes)
            .set({ body: input.body, lastEditedBy: ctx.user.id, lastEditedAt: new Date() })
            .where(eq(minutes.id, existing.id))
            .returning()
          return updated
        }
        const [created] = await ctx.db
          .insert(minutes)
          .values({
            meetingId: input.meetingId,
            body: input.body,
            lastEditedBy: ctx.user.id,
            lastEditedAt: new Date(),
          })
          .returning()
        return created
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save minutes' })
      }
    }),

  // Submit for board review. Clears any previous approvals if re-finalizing.
  finalize: boardProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.minutes.findFirst({
          where: eq(minutes.meetingId, input.meetingId),
          with: { approvals: true },
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'No minutes to finalize' })
        if (existing.status === 'published') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Published minutes cannot be re-finalized' })
        }

        // If re-finalizing after changes_requested, clear old approvals and bump round
        if (existing.status === 'in_review' || existing.status === 'approved') {
          const currentRound = Math.max(...existing.approvals.map(a => a.round), 0)
          await ctx.db.delete(minutesApproval).where(eq(minutesApproval.minutesId, existing.id))
          const [updated] = await ctx.db
            .update(minutes)
            .set({ status: 'in_review', lastEditedBy: ctx.user.id, lastEditedAt: new Date() })
            .where(eq(minutes.id, existing.id))
            .returning()
          return { ...updated, round: currentRound + 1 }
        }

        const [updated] = await ctx.db
          .update(minutes)
          .set({ status: 'in_review', finalizedAt: new Date() })
          .where(eq(minutes.id, existing.id))
          .returning()
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to finalize minutes' })
      }
    }),

  // Board member votes. Auto-approves when majority reached.
  submitApproval: boardProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      decision: z.enum(['approved', 'changes_requested']),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.minutes.findFirst({
          where: eq(minutes.meetingId, input.meetingId),
          with: { approvals: true },
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
        if (existing.status !== 'in_review') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Minutes are not in review' })
        }

        const currentRound = existing.approvals.length
          ? Math.max(...existing.approvals.map(a => a.round))
          : 1

        // Upsert this board member's vote for the current round
        const prev = existing.approvals.find(
          a => a.residentId === ctx.user.id && a.round === currentRound,
        )
        if (prev) {
          await ctx.db
            .update(minutesApproval)
            .set({ decision: input.decision, notes: input.notes ?? null, votedAt: new Date() })
            .where(eq(minutesApproval.id, prev.id))
        } else {
          await ctx.db.insert(minutesApproval).values({
            minutesId: existing.id,
            residentId: ctx.user.id,
            decision: input.decision,
            round: currentRound,
            notes: input.notes,
          })
        }

        // Check for majority approval — count active board members
        const boardMembers = await ctx.db.query.residentRole.findMany({
          where: and(
            eq(residentRole.contextId, ctx.communityId),
          ),
        })
        const activeBoardCount = boardMembers.filter(r => !r.revokedAt).length
        const majority = Math.ceil(activeBoardCount / 2)

        const allApprovals = await ctx.db.query.minutesApproval.findMany({
          where: and(eq(minutesApproval.minutesId, existing.id)),
        })
        const roundApprovals = allApprovals.filter(a => a.round === currentRound)
        const approvedCount = roundApprovals.filter(a => a.decision === 'approved').length

        if (approvedCount >= majority) {
          await ctx.db
            .update(minutes)
            .set({ status: 'approved' })
            .where(eq(minutes.id, existing.id))
        }

        return getMinutesForMeeting(ctx.db, input.meetingId, ctx.communityId)
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit approval' })
      }
    }),

  // Publish approved minutes to all residents.
  publish: boardProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.minutes.findFirst({
          where: eq(minutes.meetingId, input.meetingId),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
        if (existing.status !== 'approved') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Minutes must be approved before publishing' })
        }
        const [updated] = await ctx.db
          .update(minutes)
          .set({ status: 'published', publishedAt: new Date() })
          .where(eq(minutes.id, existing.id))
          .returning()
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to publish minutes' })
      }
    }),
})
