import type { AuthUser } from '../../types/index'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  needsOnboarding: boolean
}

const state = reactive<AuthState>({
  user: null,
  loading: false,
  needsOnboarding: false,
})

export function useAuth() {
  const api = useApi()
  const supabaseUser = useSupabaseUser()
  const router = useRouter()

  async function fetchProfile(): Promise<void> {
    if (!supabaseUser.value) {
      state.user = null
      return
    }

    state.loading = true
    try {
      const profile = await api.residents.me.query()
      state.user = profile
      state.needsOnboarding = profile.inviteStatus !== 'accepted'
    } catch {
      state.user = null
    } finally {
      state.loading = false
    }
  }

  async function signOut(): Promise<void> {
    const supabase = useSupabaseClient()
    await supabase.auth.signOut()
    state.user = null
    router.push('/login')
  }

  watch(supabaseUser, async (next, prev) => {
    if (next && !prev) {
      await fetchProfile()
    } else if (!next) {
      state.user = null
    }
  })

  return {
    user: computed(() => state.user),
    loading: computed(() => state.loading),
    needsOnboarding: computed(() => state.needsOnboarding),
    fetchProfile,
    signOut,
  }
}
