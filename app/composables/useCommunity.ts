type CommunityState = {
  name: string
  address: string | null
  loaded: boolean
}

const state = reactive<CommunityState>({
  name: '',
  address: null,
  loaded: false,
})

export function useCommunity() {
  const api = useApi()

  async function fetchCommunity(force = false): Promise<void> {
    if (state.loaded && !force) return
    try {
      const data = await api.setup.community.query()
      state.name = data.name
      state.address = data.address
      state.loaded = true
    } catch {
      // Non-critical — fall back to empty
    }
  }

  return {
    communityName: computed(() => state.name),
    communityAddress: computed(() => state.address),
    fetchCommunity,
  }
}
