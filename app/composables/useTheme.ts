const STORAGE_KEY = 'quorum:theme'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')

function resolvedTheme(): 'light' | 'dark' {
  if (theme.value === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme.value
}

function apply(): void {
  if (typeof document === 'undefined') return
  const t = resolvedTheme()
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  function init(): void {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    theme.value = stored ?? 'system'
    apply()

    // Reactively follow system preference when in "system" mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') apply()
    })
  }

  function setTheme(t: Theme): void {
    theme.value = t
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, t)
    }
    apply()
  }

  const isDark = computed(() => resolvedTheme() === 'dark')

  return { theme: readonly(theme), isDark, setTheme, init }
}
