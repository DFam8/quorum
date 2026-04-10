import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import { db } from '../db'
import { resident, residentRole, community } from '../db/schema'
import { eq, isNull } from 'drizzle-orm'

async function loadUser(event: H3Event) {
  try {
    const supabaseUser = await serverSupabaseUser(event)
    if (!supabaseUser?.email) return null

    return await db.query.resident.findFirst({
      where: eq(resident.email, supabaseUser.email),
      with: {
        roles: { where: isNull(residentRole.revokedAt) },
        household: { with: { unit: true } },
      },
    })
  } catch {
    return null
  }
}

async function loadCommunityId(): Promise<string> {
  if (process.env.COMMUNITY_ID && process.env.COMMUNITY_ID !== 'your-community-uuid') {
    return process.env.COMMUNITY_ID
  }
  // Single-tenant: auto-discover from the community table
  const found = await db.query.community.findFirst()
  return found?.id ?? ''
}

export async function createContext(event: H3Event) {
  const [user, communityId] = await Promise.all([
    loadUser(event),
    loadCommunityId(),
  ])

  return {
    event,
    db,
    user: user ?? null,
    communityId,
    ipAddress: getRequestIP(event) ?? 'unknown',
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
