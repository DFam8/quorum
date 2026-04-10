export default defineNuxtRouteMiddleware(async (to) => {
  const supabaseUser = useSupabaseUser()

  if (!supabaseUser.value) {
    return navigateTo('/login')
  }

  const { needsOnboarding, fetchProfile, user } = useAuth()

  if (!user.value) {
    await fetchProfile()
  }

  if (needsOnboarding.value && !to.path.startsWith('/onboarding')) {
    return navigateTo('/onboarding')
  }
})
