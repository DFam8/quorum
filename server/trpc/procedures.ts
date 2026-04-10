import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const boardProcedure = authedProcedure.use(({ ctx, next }) => {
  const isBoard = ctx.user.roles?.some(
    r => (r.role === 'board_member' || r.role === 'super_admin') && !r.revokedAt
  )
  if (!isBoard) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx })
})

export const superAdminProcedure = authedProcedure.use(({ ctx, next }) => {
  const isSuperAdmin = ctx.user.roles?.some(
    r => r.role === 'super_admin' && !r.revokedAt
  )
  if (!isSuperAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx })
})
