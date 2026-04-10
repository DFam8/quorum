import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, publicProcedure, authedProcedure, superAdminProcedure } from '../procedures'
import { community, unit, household, resident, residentRole } from '../../db/schema'

export const setupRouter = router({
  isInstalled: publicProcedure.query(async ({ ctx }): Promise<boolean> => {
    try {
      const existing = await ctx.db.query.community.findFirst()
      return !!existing
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  community: authedProcedure.query(async ({ ctx }): Promise<{
    name: string
    address: string | null
    timezone: string
    maxOccupantsPerUnit: number
    maxSuperAdmins: number
  }> => {
    try {
      const found = await ctx.db.query.community.findFirst()
      return {
        name: found?.name ?? '',
        address: found?.address ?? null,
        timezone: found?.timezone ?? 'America/Chicago',
        maxOccupantsPerUnit: found?.maxOccupantsPerUnit ?? 8,
        maxSuperAdmins: found?.maxSuperAdmins ?? 2,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  updateCommunity: superAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      address: z.string().max(500).optional(),
      timezone: z.string().max(100),
      maxOccupantsPerUnit: z.number().int().min(1).max(20),
    }))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        await ctx.db
          .update(community)
          .set({
            name: input.name,
            address: input.address ?? null,
            timezone: input.timezone,
            maxOccupantsPerUnit: input.maxOccupantsPerUnit,
          })
          .where(eq(community.id, ctx.communityId))
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  initialize: publicProcedure
    .input(
      z.object({
        communityName: z.string().min(1).max(255),
        communityAddress: z.string().max(500).optional(),
        timezone: z.string().max(100).default('America/Chicago'),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email(),
        unitNumber: z.string().min(1).max(50).default('Admin'),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<{ inviteToken: string; email: string }> => {
      try {
        const existing = await ctx.db.query.community.findFirst()
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This community is already set up. Please sign in.',
          })
        }

        const [newCommunity] = await ctx.db
          .insert(community)
          .values({
            name: input.communityName,
            address: input.communityAddress ?? null,
            timezone: input.timezone,
          })
          .returning({ id: community.id })

        if (!newCommunity) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create community.' })
        }

        const [newUnit] = await ctx.db
          .insert(unit)
          .values({
            communityId: newCommunity.id,
            unitNumber: input.unitNumber,
            unitType: 'sfh',
          })
          .returning({ id: unit.id })

        if (!newUnit) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create unit.' })
        }

        const [newHousehold] = await ctx.db
          .insert(household)
          .values({ unitId: newUnit.id })
          .returning({ id: household.id })

        if (!newHousehold) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create household.' })
        }

        const token = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        const [newResident] = await ctx.db
          .insert(resident)
          .values({
            householdId: newHousehold.id,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            residentType: 'owner',
            inviteToken: token,
            inviteStatus: 'pending',
            inviteExpiresAt: expiresAt,
          })
          .returning({ id: resident.id })

        if (!newResident) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create resident.' })
        }

        await ctx.db.update(household).set({ primaryResidentId: newResident.id })

        await ctx.db.insert(residentRole).values({
          residentId: newResident.id,
          role: 'super_admin',
          rank: 1,
          title: 'President',
          contextId: newCommunity.id,
          contextType: 'community',
          grantedBy: newResident.id,
        })

        // Update COMMUNITY_ID hint — log it so the operator can set the env var
        console.info(`[setup] Community created. Set COMMUNITY_ID=${newCommunity.id} in your .env`)

        return { inviteToken: token, email: input.email }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),
})
