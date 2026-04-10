import { isBoardMember } from '../../utils/permissions'

export type NavItemDef = {
  path: string
  label: string
  icon: string
  boardOnly?: boolean
}

export const ALL_NAV_ITEMS: NavItemDef[] = [
  { path: '/feed',             label: 'Feed',      icon: 'newspaper' },
  { path: '/messages',         label: 'Messages',  icon: 'comment-dots' },
  { path: '/meetings',         label: 'Meetings',  icon: 'calendar' },
  { path: '/polls',            label: 'Polls',     icon: 'chart-bar' },
  { path: '/portal/directory', label: 'Directory', icon: 'users' },
  { path: '/portal/documents', label: 'Documents', icon: 'folder' },
  { path: '/portal/maintenance', label: 'Maintenance', icon: 'wrench' },
  { path: '/dashboard',        label: 'Dashboard', icon: 'gauge', boardOnly: true },
]

export const DEFAULT_BOTTOM_NAV = ['/feed', '/messages', '/meetings']

export function useNavItems() {
  const { user } = useAuth()

  const availableItems = computed(() =>
    ALL_NAV_ITEMS.filter(item => !item.boardOnly || (!!user.value && isBoardMember(user.value)))
  )

  const activeBottomNav = computed((): NavItemDef[] => {
    const saved = user.value?.notificationSettings?.bottomNav
    const paths = saved && saved.length === 3 ? saved : DEFAULT_BOTTOM_NAV
    return paths
      .map(p => ALL_NAV_ITEMS.find(item => item.path === p))
      .filter((item): item is NavItemDef => !!item)
  })

  return { availableItems, activeBottomNav }
}
