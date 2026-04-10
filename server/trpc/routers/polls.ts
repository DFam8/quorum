import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { poll, pollOption, pollResponse, resident, household, unit } from '../../db/schema'

const optionSchema = z.object({
  label: z.string().min(1).max(255),
})

const pollInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  eligibility: z.enum(['all', 'owners_only']).default('all'),
  anonymous: z.boolean().default(false),
  closesAt: z.string().datetime().optional(),
  options: z.array(optionSchema).min(2).max(10),
})

// ── Shared helpers ────────────────────────────────────────────────────────────

type PollDb = typeof import('../../db').db

async function getEligibleCount(
  db: PollDb,
  communityId: string,
  eligibility: 'all' | 'owners_only',
): Promise<number> {
  const units = await db.query.unit.findMany({
    where: eq(unit.communityId, communityId),
    with: {
      households: {
        with: { residents: { columns: { id: true, inviteStatus: true, residentType: true } } },
      },
    },
  })
  return units
    .flatMap(u => u.households)
    .flatMap(h => h.residents)
    .filter(r =>
      r.inviteStatus === 'accepted' &&
      (eligibility === 'all' || r.residentType === 'owner')
    ).length
}

async function insertOptions(
  db: PollDb,
  pollId: string,
  options: Array<{ label: string }>,
): Promise<void> {
  await db.insert(pollOption).values(
    options.map((o, i) => ({ pollId, label: o.label, displayOrder: i }))
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export const pollsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      const rows = await ctx.db.query.poll.findMany({
        where: eq(poll.communityId, ctx.communityId),
        with: {
          options: { orderBy: (o, { asc }) => [asc(o.displayOrder)] },
          responses: { columns: { residentId: true, optionId: true } },
          createdByResident: { columns: { firstName: true, lastName: true } },
        },
        orderBy: [desc(poll.createdAt)],
      })

      const isBoard = ctx.user.roles.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin'))

      return rows
        .filter(p => isBoard || p.status !== 'draft')
        .map(p => {
          const myResponse = p.responses.find(r => r.residentId === ctx.user.id)
          const optionCounts: Record<string, number> = {}
          p.options.forEach(o => { optionCounts[o.id] = 0 })
          p.responses.forEach(r => { optionCounts[r.optionId] = (optionCounts[r.optionId] ?? 0) + 1 })
          const showResults = isBoard || p.status === 'closed' || !!myResponse
          const isEligible = p.eligibility === 'all' || ctx.user.residentType === 'owner' || isBoard

          return {
            id: p.id,
            title: p.title,
            status: p.status,
            eligibility: p.eligibility,
            anonymous: p.anonymous,
            closesAt: p.closesAt,
            openedAt: p.openedAt,
            closedAt: p.closedAt,
            createdAt: p.createdAt,
            createdByResident: p.createdByResident,
            responseCount: p.responses.length,
            hasVoted: !!myResponse,
            myVotedOptionId: myResponse?.optionId ?? null,
            canVote: p.status === 'open' && !myResponse && isEligible,
            options: p.options.map(o => ({
              id: o.id,
              label: o.label,
              responseCount: showResults ? (optionCounts[o.id] ?? 0) : null,
            })),
          }
        })
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load polls' })
    }
  }),

  get: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const p = await ctx.db.query.poll.findFirst({
          where: and(eq(poll.id, input.id), eq(poll.communityId, ctx.communityId)),
          with: {
            options: { orderBy: (o, { asc }) => [asc(o.displayOrder)] },
            responses: { columns: { optionId: true, residentId: true } },
            createdByResident: { columns: { firstName: true, lastName: true } },
          },
        })
        if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Poll not found' })

        const isBoard = ctx.user.roles.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin'))
        if (p.status === 'draft' && !isBoard) throw new TRPCError({ code: 'NOT_FOUND' })

        const myResponse = p.responses.find(r => r.residentId === ctx.user.id) ?? null
        const showResults = isBoard || p.status === 'closed' || !!myResponse

        const optionCounts: Record<string, number> = {}
        p.options.forEach(o => { optionCounts[o.id] = 0 })
        p.responses.forEach(r => { optionCounts[r.optionId] = (optionCounts[r.optionId] ?? 0) + 1 })

        const eligibleCount = await getEligibleCount(ctx.db, ctx.communityId, p.eligibility as 'all' | 'owners_only')

        const isEligible =
          p.eligibility === 'all' ||
          ctx.user.residentType === 'owner' ||
          isBoard

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          status: p.status,
          eligibility: p.eligibility,
          anonymous: p.anonymous,
          closesAt: p.closesAt,
          openedAt: p.openedAt,
          closedAt: p.closedAt,
          createdAt: p.createdAt,
          createdByResident: p.createdByResident,
          options: p.options.map(o => ({
            id: o.id,
            label: o.label,
            displayOrder: o.displayOrder,
            responseCount: showResults ? (optionCounts[o.id] ?? 0) : null,
          })),
          totalResponses: p.responses.length,
          eligibleCount,
          myResponse: myResponse ? { optionId: myResponse.optionId } : null,
          canVote: p.status === 'open' && !myResponse && isEligible,
          showResults,
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load poll' })
      }
    }),

  create: boardProcedure
    .input(pollInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [created] = await ctx.db
          .insert(poll)
          .values({
            communityId: ctx.communityId,
            title: input.title,
            description: input.description,
            eligibility: input.eligibility,
            anonymous: input.anonymous,
            closesAt: input.closesAt ? new Date(input.closesAt) : null,
            createdBy: ctx.user.id,
          })
          .returning()
        if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
        await insertOptions(ctx.db, created.id, input.options)
        return created
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create poll' })
      }
    }),

  update: boardProcedure
    .input(z.object({ id: z.string().uuid() }).merge(pollInputSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.poll.findFirst({
          where: and(eq(poll.id, input.id), eq(poll.communityId, ctx.communityId)),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
        if (existing.status !== 'draft') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only draft polls can be edited' })

        await ctx.db.update(poll).set({
          title: input.title,
          description: input.description,
          eligibility: input.eligibility,
          anonymous: input.anonymous,
          closesAt: input.closesAt ? new Date(input.closesAt) : null,
          updatedAt: new Date(),
        }).where(eq(poll.id, input.id))

        // Replace options
        const existingOptions = await ctx.db.query.pollOption.findMany({ where: eq(pollOption.pollId, input.id) })
        if (existingOptions.length) {
          await ctx.db.delete(pollOption).where(inArray(pollOption.id, existingOptions.map(o => o.id)))
        }
        await insertOptions(ctx.db, input.id, input.options)
        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update poll' })
      }
    }),

  open: boardProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.poll.findFirst({
          where: and(eq(poll.id, input.id), eq(poll.communityId, ctx.communityId)),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
        if (existing.status !== 'draft') throw new TRPCError({ code: 'FORBIDDEN', message: 'Poll is already open or closed' })
        await ctx.db.update(poll).set({ status: 'open', openedAt: new Date(), updatedAt: new Date() }).where(eq(poll.id, input.id))
        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to open poll' })
      }
    }),

  close: boardProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.poll.findFirst({
          where: and(eq(poll.id, input.id), eq(poll.communityId, ctx.communityId)),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })
        if (existing.status !== 'open') throw new TRPCError({ code: 'FORBIDDEN', message: 'Poll is not open' })
        await ctx.db.update(poll).set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() }).where(eq(poll.id, input.id))
        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to close poll' })
      }
    }),

  respond: authedProcedure
    .input(z.object({ pollId: z.string().uuid(), optionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const p = await ctx.db.query.poll.findFirst({
          where: and(eq(poll.id, input.pollId), eq(poll.communityId, ctx.communityId)),
          with: { options: { columns: { id: true } } },
        })
        if (!p) throw new TRPCError({ code: 'NOT_FOUND' })
        if (p.status !== 'open') throw new TRPCError({ code: 'FORBIDDEN', message: 'Poll is not open' })

        const isBoard = ctx.user.roles.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin'))

        if (p.eligibility === 'owners_only' && ctx.user.residentType !== 'owner') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'This poll is open to owners only' })
        }

        if (!p.options.some(o => o.id === input.optionId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid option' })
        }

        const existing = await ctx.db.query.pollResponse.findFirst({
          where: and(eq(pollResponse.pollId, input.pollId), eq(pollResponse.residentId, ctx.user.id)),
        })
        if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'You have already voted on this poll' })

        await ctx.db.insert(pollResponse).values({
          pollId: input.pollId,
          residentId: ctx.user.id,
          optionId: input.optionId,
        })
        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to record vote' })
      }
    }),
})
