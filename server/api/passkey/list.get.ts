import { serverSupabaseUser } from '#supabase/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { passkeyCredential, resident } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const res = await db.query.resident.findFirst({
    where: eq(resident.email, supabaseUser.email),
  })
  if (!res) throw createError({ statusCode: 404, message: 'Resident not found' })

  const credentials = await db
    .select({
      id: passkeyCredential.id,
      deviceType: passkeyCredential.deviceType,
      backedUp: passkeyCredential.backedUp,
      createdAt: passkeyCredential.createdAt,
      lastUsedAt: passkeyCredential.lastUsedAt,
    })
    .from(passkeyCredential)
    .where(eq(passkeyCredential.residentId, res.id))

  return credentials
})
