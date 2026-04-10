import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { announcement, announcementRead, resident, household, unit, community } from '../../db/schema'
import { sendAnnouncementEmails } from '../../utils/email'

const announcementInputSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  priority: z.enum(['general', 'urgent']).default('general'),
  pinned: z.boolean().default(false),
  imageUrl: z.string().url().nullable().optional(),
})

export const announcementsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      const rows = await ctx.db.query.announcement.findMany({
        where: eq(announcement.communityId, ctx.communityId),
        with: {
          createdByResident: { columns: { id: true, firstName: true, lastName: true } },
          reads: { columns: { residentId: true }, where: eq(announcementRead.residentId, ctx.user.id) },
        },
        orderBy: [desc(announcement.pinned), desc(announcement.createdAt)],
      })
      return rows.map(r => ({ ...r, isRead: r.reads.length > 0 }))
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load announcements' })
    }
  }),

  markRead: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .insert(announcementRead)
          .values({ announcementId: input.id, residentId: ctx.user.id })
          .onConflictDoNothing()
      } catch {
        // Non-critical
      }
    }),

  markAllRead: authedProcedure.mutation(async ({ ctx }) => {
    try {
      const rows = await ctx.db.query.announcement.findMany({
        where: eq(announcement.communityId, ctx.communityId),
        columns: { id: true },
      })
      if (!rows.length) return
      await ctx.db
        .insert(announcementRead)
        .values(rows.map(r => ({ announcementId: r.id, residentId: ctx.user.id })))
        .onConflictDoNothing()
    } catch {
      // Non-critical
    }
  }),

  create: boardProcedure
    .input(announcementInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [created] = await ctx.db
          .insert(announcement)
          .values({
            communityId: ctx.communityId,
            title: input.title,
            body: input.body,
            priority: input.priority,
            pinned: input.pinned,
            imageUrl: input.imageUrl ?? null,
            createdBy: ctx.user.id,
          })
          .returning()

        // Fire-and-forget: email all active residents
        void sendAnnouncementNotifications(ctx, {
          title: input.title,
          body: input.body,
          priority: input.priority,
          postedBy: `${ctx.user.firstName} ${ctx.user.lastName}`,
        })

        return created
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create announcement' })
      }
    }),

  update: boardProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255),
      body: z.string().min(1),
      priority: z.enum(['general', 'urgent']),
      imageUrl: z.string().url().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db.query.announcement.findFirst({
          where: and(
            eq(announcement.id, input.id),
            eq(announcement.communityId, ctx.communityId),
          ),
        })
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' })

        const historyEntry = {
          editedAt: new Date().toISOString(),
          editedBy: ctx.user.id,
          title: existing.title,
          body: existing.body,
        }
        const updatedHistory = [...(existing.editHistory ?? []), historyEntry]

        const [updated] = await ctx.db
          .update(announcement)
          .set({
            title: input.title,
            body: input.body,
            priority: input.priority,
            imageUrl: input.imageUrl ?? null,
            editHistory: updatedHistory,
            updatedAt: new Date(),
          })
          .where(and(eq(announcement.id, input.id), eq(announcement.communityId, ctx.communityId)))
          .returning()
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update announcement' })
      }
    }),

  pin: boardProcedure
    .input(z.object({ id: z.string().uuid(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(announcement)
          .set({ pinned: input.pinned, updatedAt: new Date() })
          .where(and(eq(announcement.id, input.id), eq(announcement.communityId, ctx.communityId)))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' })
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update pin' })
      }
    }),

  hide: boardProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(announcement)
          .set({ hidden: true, hiddenReason: input.reason, updatedAt: new Date() })
          .where(and(eq(announcement.id, input.id), eq(announcement.communityId, ctx.communityId)))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' })
        return updated
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to hide announcement' })
      }
    }),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type AnnouncementCtx = {
  db: typeof import('../../db').db
  communityId: string
  user: { firstName: string; lastName: string }
}

type AnnouncementData = {
  title: string
  body: string
  priority: string
  postedBy: string
}

async function sendAnnouncementNotifications(
  ctx: AnnouncementCtx,
  data: AnnouncementData,
): Promise<void> {
  try {
    const comm = await ctx.db.query.community.findFirst({
      where: eq(community.id, ctx.communityId),
    })
    if (!comm) return

    const units = await ctx.db.query.unit.findMany({
      where: eq(unit.communityId, ctx.communityId),
      with: {
        households: {
          with: { residents: true },
        },
      },
    })

    const recipients = units
      .flatMap(u => u.households)
      .flatMap(h => h.residents)
      .filter(r => r.inviteStatus === 'accepted' && r.email && r.notificationSettings?.emailAnnouncements !== false)
      .map(r => ({ email: r.email, firstName: r.firstName }))

    if (!recipients.length) return

    const siteUrl = process.env.SITE_URL ?? 'https://quorum.community'

    await sendAnnouncementEmails({
      communityName: comm.name,
      siteUrl,
      announcement: data,
      recipients,
    })
  } catch {
    // Non-critical — log silently
  }
}
