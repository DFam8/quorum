import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../../trpc'
import { createContext } from '../../trpc/context'

export default defineEventHandler(async (event) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: toWebRequest(event),
    router: appRouter,
    createContext: async () => createContext(event),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ error }) => console.error('tRPC error:', error)
        : undefined,
  })
})
