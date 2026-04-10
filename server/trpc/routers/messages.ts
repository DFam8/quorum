import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, or, desc, isNull } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { thread, message, resident, household } from '../../db/schema'

type RecipientType = 'board' | 'resident' | 'unit'

// ── Access check ───────────────────────────────────────────────────────────

function canAccessThread(
  t: { createdBy: string; recipientType: string; recipientId: string | null },
  userId: string,
  unitId: string | undefined,
  isBoard: boolean,
): boolean {
  if (isBoard) return true
  if (t.createdBy === userId) return true
  if (t.recipientType === 'resident' && t.recipientId === userId) return true
  if (t.recipientType === 'unit' && unitId && t.recipientId === unitId) return true
  return false
}

// ── Router ─────────────────────────────────────────────────────────────────

export const messagesRouter = router({
  // List all threads visible to the current user, ordered by latest activity
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.user.id
      const unitId = ctx.user.household?.unit?.id
      const isBoard = ctx.user.roles?.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin')) ?? false

      const allThreads = await ctx.db.query.thread.findMany({
        where: eq(thread.communityId, ctx.communityId),
        with: {
          createdByResident: { columns: { id: true, firstName: true, lastName: true } },
          messages: {
            orderBy: [desc(message.createdAt)],
            limit: 1,
            with: {
              sender: { columns: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [desc(thread.lastMessageAt)],
      })

      return allThreads
        .filter(t => canAccessThread(t, userId, unitId, isBoard))
        .map(t => {
          const lastMsg = t.messages[0] ?? null
          const unreadCount = 0 // computed client-side from markRead state
          return { ...t, lastMessage: lastMsg, unreadCount }
        })
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load messages' })
    }
  }),

  // Get a single thread with full message history
  get: authedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id
        const unitId = ctx.user.household?.unit?.id
        const isBoard = ctx.user.roles?.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin')) ?? false

        const t = await ctx.db.query.thread.findFirst({
          where: and(eq(thread.id, input.threadId), eq(thread.communityId, ctx.communityId)),
          with: {
            createdByResident: { columns: { id: true, firstName: true, lastName: true } },
            messages: {
              orderBy: [desc(message.createdAt)],
              with: {
                sender: { columns: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        })

        if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'Thread not found' })
        if (!canAccessThread(t, userId, unitId, isBoard)) {
          throw new TRPCError({ code: 'FORBIDDEN' })
        }

        return { ...t, messages: [...t.messages].reverse() }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load thread' })
      }
    }),

  // Start a new thread (residents always → board; board can choose recipient)
  create: authedProcedure
    .input(z.object({
      subject: z.string().min(1).max(255),
      body: z.string().min(1),
      recipientType: z.enum(['board', 'resident', 'unit']).default('board'),
      recipientId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id
        const isBoard = ctx.user.roles?.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin')) ?? false

        // Residents can only message the board
        const recipientType: RecipientType = isBoard ? input.recipientType : 'board'
        const recipientId = recipientType === 'board' ? null : (input.recipientId ?? null)

        if (recipientType !== 'board' && !recipientId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recipient required' })
        }

        // For resident→resident threads, check the recipient allows DMs
        if (recipientType === 'resident' && recipientId && !isBoard) {
          const target = await ctx.db.query.resident.findFirst({
            where: eq(resident.id, recipientId),
            columns: { allowDirectMessages: true },
          })
          if (!target?.allowDirectMessages) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'This resident is not accepting direct messages' })
          }
        }

        const [newThread] = await ctx.db
          .insert(thread)
          .values({
            communityId: ctx.communityId,
            subject: input.subject,
            createdBy: userId,
            recipientType,
            recipientId,
          })
          .returning()

        if (!newThread) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create thread' })

        await ctx.db.insert(message).values({
          threadId: newThread.id,
          senderId: userId,
          body: input.body,
        })

        return newThread
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send message' })
      }
    }),

  // Reply to an existing thread
  reply: authedProcedure
    .input(z.object({ threadId: z.string().uuid(), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id
        const unitId = ctx.user.household?.unit?.id
        const isBoard = ctx.user.roles?.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin')) ?? false

        const t = await ctx.db.query.thread.findFirst({
          where: and(eq(thread.id, input.threadId), eq(thread.communityId, ctx.communityId)),
        })

        if (!t) throw new TRPCError({ code: 'NOT_FOUND' })
        if (!canAccessThread(t, userId, unitId, isBoard)) {
          throw new TRPCError({ code: 'FORBIDDEN' })
        }

        const [newMessage] = await ctx.db
          .insert(message)
          .values({ threadId: input.threadId, senderId: userId, body: input.body })
          .returning()

        await ctx.db
          .update(thread)
          .set({ lastMessageAt: new Date() })
          .where(eq(thread.id, input.threadId))

        return newMessage
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send reply' })
      }
    }),

  // Mark all messages in a thread as read for the current user
  markRead: authedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(message)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(message.threadId, input.threadId),
              isNull(message.readAt),
            )
          )
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark as read' })
      }
    }),

  // Mark the last incoming message in a thread as unread
  markUnread: authedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id
        const unitId = ctx.user.household?.unit?.id
        const isBoard = ctx.user.roles?.some(r => !r.revokedAt && (r.role === 'board_member' || r.role === 'super_admin')) ?? false

        const t = await ctx.db.query.thread.findFirst({
          where: and(eq(thread.id, input.threadId), eq(thread.communityId, ctx.communityId)),
          with: {
            messages: {
              orderBy: [desc(message.createdAt)],
              limit: 10,
            },
          },
        })

        if (!t) throw new TRPCError({ code: 'NOT_FOUND' })
        if (!canAccessThread(t, userId, unitId, isBoard)) throw new TRPCError({ code: 'FORBIDDEN' })

        // Find the most recent message not sent by the current user and clear its readAt
        const lastIncoming = t.messages.find(m => m.senderId !== userId)
        if (lastIncoming) {
          await ctx.db
            .update(message)
            .set({ readAt: null })
            .where(eq(message.id, lastIncoming.id))
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark as unread' })
      }
    }),

  // Board: list all accepted residents for compose recipient picker
  listResidents: boardProcedure.query(async ({ ctx }) => {
    try {
      const residents = await ctx.db.query.resident.findMany({
        where: eq(resident.householdId, ctx.user.householdId),
        columns: {},
        with: {
          household: {
            columns: { unitId: true },
            with: { unit: { columns: { id: true, unitNumber: true, building: true } } },
          },
        },
      })

      // Actually fetch all accepted residents in the community
      const allHouseholds = await ctx.db.query.household.findMany({
        with: {
          unit: { columns: { id: true, unitNumber: true, building: true, communityId: true } },
          residents: {
            where: eq(resident.inviteStatus, 'accepted'),
            columns: { id: true, firstName: true, lastName: true, allowDirectMessages: true },
          },
        },
      })

      return allHouseholds
        .filter(h => h.unit?.communityId === ctx.communityId)
        .flatMap(h =>
          h.residents.map(r => ({
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            allowDirectMessages: r.allowDirectMessages,
            unit: h.unit ? { id: h.unit.id, unitNumber: h.unit.unitNumber, building: h.unit.building } : null,
          }))
        )
        .filter(r => r.id !== ctx.user.id)
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load residents' })
    }
  }),
})
