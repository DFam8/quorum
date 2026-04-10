import { serverSupabaseUser } from '#supabase/server'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { passkeyCredential, resident } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const supabaseUser = await serverSupabaseUser(event)
  if (!supabaseUser?.email) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing credential ID' })

  const res = await db.query.resident.findFirst({
    where: eq(resident.email, supabaseUser.email),
  })
  if (!res) throw createError({ statusCode: 404, message: 'Resident not found' })

  // Ensure the credential belongs to this resident (no IDOR)
  const deleted = await db
    .delete(passkeyCredential)
    .where(and(
      eq(passkeyCredential.id, id),
      eq(passkeyCredential.residentId, res.id),
    ))
    .returning({ id: passkeyCredential.id })

  if (!deleted.length) throw createError({ statusCode: 404, message: 'Credential not found' })

  return { success: true }
})
