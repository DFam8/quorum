import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { meeting, agenda, meetingRsvp, resident } from '../../db/schema'

const MEETING_TYPES = ['annual', 'special', 'board', 'emergency'] as const

const meetingInputSchema = z.object({
  title: z.string().min(1).max(255),
  meetingType: z.enum(MEETING_TYPES),
  location: z.string().max(255).optional(),
  scheduledAt: z.string().datetime(),
})

const agendaItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  duration: z.number().int().positive().optional(),
})

export const meetingsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.meeting.findMany({
        where: eq(meeting.communityId, ctx.communityId),
        with: {
          createdByResident: { columns: { id: true, firstName: true, lastName: true } },
          agenda: { columns: { id: true, status: true, publishedAt: true } },
          rsvps: { columns: { id: true, status: true, residentId: true } },
        },
        orderBy: [desc(meeting.scheduledAt)],
      })
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load meetings' })
    }
  }),

  get: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const m = await ctx.db.query.meeting.findFirst({
          where: and(eq(meeting.id, input.id), eq(meeting.communityId, ctx.communityId)),
          with: {
            createdByResident: { columns: { id: true, firstName: true, lastName: true } },
            agenda: true,
            minutes: { columns: { id: true, status: true, publishedAt: true } },
          },
        })
        if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
        return m
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load meeting' })
      }
    }),

  create: boardProcedure
    .input(meetingInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [created] = await ctx.db
          .insert(meeting)
          .values({
            communityId: ctx.communityId,
            title: input.title,
            meetingType: input.meetingType,
            location: input.location,
            scheduledAt: new Date(input.scheduledAt),
            createdBy: ctx.user.id,
          })
          .returning()
        return created
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create meeting' })
      }
    }),

  update: boardProcedure
    .input(z.object({ id: z.string().uuid() }).merge(meetingInputSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(meeting)
          .set({
            title: input.title,
            meetingType: input.meetingType,
            location: input.location,
            scheduledAt: new Date(input.scheduledAt),
          })
          .where(and(eq(meeting.id, input.id), eq(meeting.communityId, ctx.communityId)))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update meeting' })
      }
    }),

  cancel: boardProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(meeting)
          .set({ status: 'cancelled' })
          .where(and(eq(meeting.id, input.id), eq(meeting.communityId, ctx.communityId)))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to cancel meeting' })
      }
    }),

  // ── Agenda ────────────────────────────────────────────────────────────────

  getDetail: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const m = await ctx.db.query.meeting.findFirst({
          where: and(eq(meeting.id, input.id), eq(meeting.communityId, ctx.communityId)),
          with: {
            createdByResident: { columns: { id: true, firstName: true, lastName: true } },
            agenda: true,
            minutes: {
              with: {
                approvals: {
                  with: { resident: { columns: { id: true, firstName: true, lastName: true } } },
                },
              },
            },
            rsvps: {
              with: { resident: { columns: { id: true, firstName: true, lastName: true } } },
            },
          },
        })
        if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
        return m
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load meeting' })
      }
    }),

  upsertAgenda: boardProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      items: z.array(agendaItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.agenda.findFirst({
          where: eq(agenda.meetingId, input.meetingId),
        })
        if (existing) {
          if (existing.status === 'published') {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit a published agenda' })
          }
          const [updated] = await ctx.db
            .update(agenda)
            .set({ items: input.items })
            .where(eq(agenda.id, existing.id))
            .returning()
          return updated
        }
        const [created] = await ctx.db
          .insert(agenda)
          .values({ meetingId: input.meetingId, items: input.items })
          .returning()
        return created
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save agenda' })
      }
    }),

  publishAgenda: boardProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.agenda.findFirst({
          where: eq(agenda.meetingId, input.meetingId),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'No agenda to publish' })
        const [updated] = await ctx.db
          .update(agenda)
          .set({ status: 'published', publishedAt: new Date() })
          .where(eq(agenda.id, existing.id))
          .returning()
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to publish agenda' })
      }
    }),

  // ── RSVP ──────────────────────────────────────────────────────────────────

  rsvp: authedProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      status: z.enum(['attending', 'not_attending']),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const m = await ctx.db.query.meeting.findFirst({
          where: and(eq(meeting.id, input.meetingId), eq(meeting.communityId, ctx.communityId)),
        })
        if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })

        const existing = await ctx.db.query.meetingRsvp.findFirst({
          where: and(eq(meetingRsvp.meetingId, input.meetingId), eq(meetingRsvp.residentId, ctx.user.id)),
        })

        if (existing) {
          const [updated] = await ctx.db
            .update(meetingRsvp)
            .set({ status: input.status, updatedAt: new Date() })
            .where(eq(meetingRsvp.id, existing.id))
            .returning()
          return updated
        }

        const [created] = await ctx.db
          .insert(meetingRsvp)
          .values({ meetingId: input.meetingId, residentId: ctx.user.id, status: input.status })
          .returning()
        return created
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save RSVP' })
      }
    }),

  removeRsvp: authedProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .delete(meetingRsvp)
          .where(and(eq(meetingRsvp.meetingId, input.meetingId), eq(meetingRsvp.residentId, ctx.user.id)))
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove RSVP' })
      }
    }),
})
