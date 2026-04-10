import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '../../server/trpc/index'

export default defineNuxtPlugin(() => {
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
      }),
    ],
  })

  return {
    provide: { trpc: client },
  }
})
