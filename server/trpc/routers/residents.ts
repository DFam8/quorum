import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { router, publicProcedure, authedProcedure, boardProcedure, superAdminProcedure } from '../procedures'
import { resident, household, unit, residentRole, community } from '../../db/schema'
import type { AuthUser } from '../../../types'
import { sendInviteEmail } from '../../utils/email'

const notificationSettingsSchema = z.object({
  emailAnnouncements: z.boolean().optional(),
  emailMeetings: z.boolean().optional(),
  emailMessages: z.boolean().optional(),
})

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
  directoryOptOut: z.boolean().optional(),
  allowDirectMessages: z.boolean().optional(),
  notificationSettings: notificationSettingsSchema.optional(),
})

export const residentsRouter = router({
  validateInvite: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<{
      email: string
      unitNumber: string
      unitType: string
      building: string | null
      communityName: string
    }> => {
      try {
        const found = await ctx.db.query.resident.findFirst({
          where: and(
            eq(resident.inviteToken, input.token),
            eq(resident.inviteStatus, 'pending')
          ),
          with: {
            household: {
              with: { unit: true },
            },
          },
        })

        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found or already used.' })
        }

        if (found.inviteExpiresAt && found.inviteExpiresAt < new Date()) {
          await ctx.db
            .update(resident)
            .set({ inviteStatus: 'expired' })
            .where(eq(resident.id, found.id))

          throw new TRPCError({ code: 'FORBIDDEN', message: 'This invite link has expired.' })
        }

        const communityResult = await ctx.db.query.unit.findFirst({
          where: eq(unit.id, found.household.unit.id),
          with: { community: true },
        })

        return {
          email: found.email,
          unitNumber: found.household.unit.unitNumber,
          unitType: found.household.unit.unitType,
          building: found.household.unit.building,
          communityName: communityResult?.community?.name ?? 'Your Community',
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  me: authedProcedure.query(async ({ ctx }): Promise<AuthUser> => {
    try {
      const found = await ctx.db.query.resident.findFirst({
        where: eq(resident.id, ctx.user.id),
        with: {
          roles: { where: isNull(residentRole.revokedAt) },
          household: { with: { unit: true } },
        },
      })

      if (!found) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resident not found.' })
      }

      return found as AuthUser
    } catch (err) {
      if (err instanceof TRPCError) throw err
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  update: authedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        await ctx.db
          .update(resident)
          .set({
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
            ...(input.directoryOptOut !== undefined && { directoryOptOut: input.directoryOptOut }),
            ...(input.allowDirectMessages !== undefined && { allowDirectMessages: input.allowDirectMessages }),
            ...(input.notificationSettings !== undefined && { notificationSettings: input.notificationSettings }),
          })
          .where(eq(resident.id, ctx.user.id))

        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  completeOnboarding: authedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        await ctx.db
          .update(resident)
          .set({
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
            inviteStatus: 'accepted',
            lastLoginAt: new Date(),
          })
          .where(eq(resident.id, ctx.user.id))

        const existingHousehold = await ctx.db.query.household.findFirst({
          where: eq(household.id, ctx.user.householdId),
        })

        if (existingHousehold && !existingHousehold.primaryResidentId) {
          await ctx.db
            .update(household)
            .set({ primaryResidentId: ctx.user.id })
            .where(eq(household.id, ctx.user.householdId))
        }

        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.resident.findMany({
        with: {
          roles: { where: isNull(residentRole.revokedAt) },
          household: { with: { unit: true } },
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  invite: authedProcedure
    .input(z.object({
      householdId: z.string().uuid(),
      email: z.string().email(),
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      residentType: z.enum(['owner', 'renter']),
    }))
    .mutation(async ({ ctx, input }): Promise<{ id: string; token: string }> => {
      try {
        const token = crypto.randomUUID()
        const inviteDays = 7
        const expiresAt = new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000)

        const [created] = await ctx.db
          .insert(resident)
          .values({
            householdId: input.householdId,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            residentType: input.residentType,
            inviteToken: token,
            inviteStatus: 'pending',
            inviteExpiresAt: expiresAt,
          })
          .returning({ id: resident.id })

        if (!created) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create invite.' })
        }

        void sendInviteNotification(ctx.db, ctx.communityId, {
          email: input.email,
          firstName: input.firstName,
          token,
        })

        return { id: created.id, token }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  resendInvite: boardProcedure
    .input(z.object({ residentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ token: string }> => {
      try {
        const found = await ctx.db.query.resident.findFirst({
          where: eq(resident.id, input.residentId),
        })
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resident not found.' })
        if (found.inviteStatus === 'accepted') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Resident has already accepted their invite.' })
        }

        const token = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

        await ctx.db
          .update(resident)
          .set({ inviteToken: token, inviteExpiresAt: expiresAt, inviteStatus: 'pending' })
          .where(eq(resident.id, input.residentId))

        void sendInviteNotification(ctx.db, ctx.communityId, {
          email: found.email,
          firstName: found.firstName,
          token,
        })

        return { token }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to resend invite.' })
      }
    }),

  directory: authedProcedure.query(async ({ ctx }) => {
    try {
      const units = await ctx.db.query.unit.findMany({
        where: eq(unit.communityId, ctx.communityId),
        with: {
          households: {
            with: {
              primaryResident: true,
              residents: {
                with: { roles: { where: isNull(residentRole.revokedAt) } },
              },
            },
          },
        },
        orderBy: (u, { asc }) => [asc(u.unitNumber)],
      })
      return units
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  revokeRole: superAdminProcedure
    .input(z.object({ residentId: z.string().uuid(), contextId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        await ctx.db
          .update(residentRole)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(residentRole.residentId, input.residentId),
              eq(residentRole.contextId, input.contextId),
              isNull(residentRole.revokedAt),
            )
          )
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  setRole: superAdminProcedure
    .input(z.object({
      residentId: z.string().uuid(),
      role: z.enum(['super_admin', 'board_member', 'committee_lead']),
      rank: z.number().int().min(1).max(4).optional(),
      title: z.string().max(100).optional(),
      contextId: z.string().uuid(),
      contextType: z.enum(['community', 'committee']),
    }))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        await ctx.db
          .update(residentRole)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(residentRole.residentId, input.residentId),
              eq(residentRole.contextId, input.contextId),
              isNull(residentRole.revokedAt)
            )
          )

        await ctx.db.insert(residentRole).values({
          residentId: input.residentId,
          role: input.role,
          rank: input.rank ?? null,
          title: input.title ?? null,
          contextId: input.contextId,
          contextType: input.contextType,
          grantedBy: ctx.user.id,
        })

        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type InviteDb = typeof import('../../db').db

async function sendInviteNotification(
  db: InviteDb,
  communityId: string,
  payload: { email: string; firstName: string; token: string },
): Promise<void> {
  try {
    const comm = await db.query.community.findFirst({
      where: eq(community.id, communityId),
    })
    const siteUrl = process.env.SITE_URL ?? 'https://quorum.community'
    await sendInviteEmail({
      communityName: comm?.name ?? 'Your Community',
      inviteUrl: `${siteUrl}/invite?token=${payload.token}`,
      recipient: { email: payload.email, firstName: payload.firstName },
    })
  } catch {
    // Non-critical
  }
}
