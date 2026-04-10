import { serverSupabaseUser, serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event)
  if (!authUser) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { identityId } = await readBody<{ identityId: string }>(event)
  if (!identityId) throw createError({ statusCode: 400, message: 'identityId required' })

  // Fetch identities — prevent unlinking the last one
  const supabase = serverSupabaseServiceRole(event)
  const { data } = await supabase.auth.admin.getUserById(authUser.id)
  const identities = data?.user?.identities ?? []
  if (identities.length <= 1) {
    throw createError({ statusCode: 400, message: 'Cannot remove your only sign-in method.' })
  }

  const identity = identities.find(i => i.id === identityId)
  if (!identity) throw createError({ statusCode: 404, message: 'Identity not found.' })

  const client = await serverSupabaseClient(event)
  const { error } = await client.auth.unlinkIdentity(identity as Parameters<typeof client.auth.unlinkIdentity>[0])
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
