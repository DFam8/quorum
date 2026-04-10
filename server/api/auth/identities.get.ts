import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event)
  if (!authUser) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = serverSupabaseServiceRole(event)
  const { data, error } = await supabase.auth.admin.getUserById(authUser.id)
  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data.user.identities ?? []).map(identity => ({
    id: identity.id,
    provider: identity.provider,
    createdAt: identity.created_at,
  }))
})
