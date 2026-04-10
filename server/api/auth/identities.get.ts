import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event)
  if (!authUser) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // getUser() returns the full user including identities without needing service role
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.auth.getUser()
  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data.user.identities ?? []).map(identity => ({
    id: identity.id,
    provider: identity.provider,
    createdAt: identity.created_at,
  }))
})
