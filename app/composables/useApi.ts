import { createTRPCProxyClient } from '@trpc/client'
import type { AppRouter } from '../../server/trpc/index'

type TRPCClient = ReturnType<typeof createTRPCProxyClient<AppRouter>>

export function useApi(): TRPCClient {
  const { $trpc } = useNuxtApp()
  return $trpc as TRPCClient
}
