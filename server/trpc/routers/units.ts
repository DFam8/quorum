import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, authedProcedure, boardProcedure } from '../procedures'
import { unit, household, resident } from '../../db/schema'

const csvRowSchema = z.object({
  unitNumber: z.string().min(1).max(50),
  unitType: z.enum(['condo', 'apartment', 'sfh']),
  building: z.string().max(100).optional(),
  floor: z.number().int().optional(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  residentType: z.enum(['owner', 'renter']).default('owner'),
})

type ImportRow = z.infer<typeof csvRowSchema>

type ImportResult = {
  row: number
  unitNumber: string
  email: string
  status: 'created' | 'skipped' | 'error'
  inviteToken?: string
  reason?: string
}

const unitInputSchema = z.object({
  unitNumber: z.string().min(1).max(50),
  unitType: z.enum(['condo', 'apartment', 'sfh']),
  building: z.string().max(100).optional(),
  floor: z.number().int().optional(),
  notes: z.string().optional(),
})

export const unitsRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.query.unit.findMany({
        where: eq(unit.communityId, ctx.communityId),
        with: {
          households: {
            with: {
              residents: true,
              primaryResident: true,
            },
          },
        },
        orderBy: (u, { asc }) => [asc(u.unitNumber)],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
    }
  }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const found = await ctx.db.query.unit.findFirst({
          where: eq(unit.id, input.id),
          with: {
            households: {
              with: {
                residents: { with: { roles: true } },
                primaryResident: true,
              },
            },
          },
        })
        if (!found) throw new TRPCError({ code: 'NOT_FOUND' })
        return found
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  create: boardProcedure
    .input(unitInputSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        const [newUnit] = await ctx.db
          .insert(unit)
          .values({
            communityId: ctx.communityId,
            unitNumber: input.unitNumber,
            unitType: input.unitType,
            building: input.building ?? null,
            floor: input.floor ?? null,
            notes: input.notes ?? null,
          })
          .returning({ id: unit.id })

        if (!newUnit) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

        // Auto-create an active household for new units
        await ctx.db.insert(household).values({ unitId: newUnit.id })

        return { id: newUnit.id }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  update: boardProcedure
    .input(z.object({ id: z.string().uuid() }).merge(unitInputSchema.partial()))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        const { id, ...data } = input
        await ctx.db
          .update(unit)
          .set({
            ...(data.unitNumber !== undefined && { unitNumber: data.unitNumber }),
            ...(data.unitType !== undefined && { unitType: data.unitType }),
            ...(data.building !== undefined && { building: data.building ?? null }),
            ...(data.floor !== undefined && { floor: data.floor ?? null }),
            ...(data.notes !== undefined && { notes: data.notes ?? null }),
          })
          .where(eq(unit.id, id))
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  bulkImport: boardProcedure
    .input(z.object({ rows: z.array(csvRowSchema).min(1).max(500) }))
    .mutation(async ({ ctx, input }): Promise<{ results: ImportResult[]; created: number; skipped: number; errors: number }> => {
      const results: ImportResult[] = []

      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i] as ImportRow
        try {
          // Upsert unit — reuse if unit_number already exists for this community
          let unitId: string
          const existing = await ctx.db.query.unit.findFirst({
            where: eq(unit.unitNumber, row.unitNumber),
          })

          if (existing) {
            unitId = existing.id
          } else {
            const [newUnit] = await ctx.db
              .insert(unit)
              .values({
                communityId: ctx.communityId,
                unitNumber: row.unitNumber,
                unitType: row.unitType,
                building: row.building ?? null,
                floor: row.floor ?? null,
              })
              .returning({ id: unit.id })

            if (!newUnit) throw new Error('Failed to insert unit.')
            unitId = newUnit.id

            await ctx.db.insert(household).values({ unitId })
          }

          // Find or create the household for this unit
          const hh = await ctx.db.query.household.findFirst({
            where: eq(household.unitId, unitId),
          })
          if (!hh) throw new Error('No household found for unit.')

          // Skip if resident email already exists
          const existingResident = await ctx.db.query.resident.findFirst({
            where: eq(resident.email, row.email),
          })
          if (existingResident) {
            results.push({ row: i + 1, unitNumber: row.unitNumber, email: row.email, status: 'skipped', reason: 'Email already exists.' })
            continue
          }

          const inviteDays = 14
          const token = crypto.randomUUID()
          const expiresAt = new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000)

          await ctx.db.insert(resident).values({
            householdId: hh.id,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            residentType: row.residentType,
            inviteToken: token,
            inviteStatus: 'pending',
            inviteExpiresAt: expiresAt,
          })

          results.push({ row: i + 1, unitNumber: row.unitNumber, email: row.email, status: 'created', inviteToken: token })
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Unknown error'
          results.push({ row: i + 1, unitNumber: row.unitNumber ?? '?', email: row.email ?? '?', status: 'error', reason })
        }
      }

      return {
        results,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
      }
    }),

  delete: boardProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ ok: boolean }> => {
      try {
        const households = await ctx.db.query.household.findMany({
          where: eq(household.unitId, input.id),
          with: { residents: true },
        })

        // Cascade: residents → households → unit
        for (const h of households) {
          await ctx.db.delete(resident).where(eq(resident.householdId, h.id))
          await ctx.db.delete(household).where(eq(household.id, h.id))
        }
        await ctx.db.delete(unit).where(eq(unit.id, input.id))

        return { ok: true }
      } catch (err) {
        if (err instanceof TRPCError) throw err
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),
})
