<template>
  <nav class="bottom-nav" aria-label="Primary navigation">
    <NuxtLink
      v-for="item in activeBottomNav"
      :key="item.path"
      :to="item.path"
      class="bottom-nav-item"
      :class="{ 'bottom-nav-item--active': isActive(item.path) }"
    >
      <div class="item-icon-wrap">
        <FaIcon :icon="['fajr', item.icon]" class="item-icon" aria-hidden="true" />
        <span v-if="item.path === '/messages' && hasUnreadMessages" class="item-dot" />
        <span v-if="item.path === '/feed' && hasUnreadAnnouncements" class="item-dot" />
      </div>
      <span class="item-label">{{ item.label }}</span>
    </NuxtLink>

    <button
      class="bottom-nav-item"
      :class="{ 'bottom-nav-item--active': isOpen }"
      :aria-label="isOpen ? 'Close navigation' : 'More'"
      :aria-expanded="isOpen"
      aria-controls="mobile-sidebar"
      @click="toggle"
    >
      <div class="item-icon-wrap">
        <FaIcon :icon="['fajr', isOpen ? 'xmark' : 'bars']" class="item-icon" aria-hidden="true" />
      </div>
      <span class="item-label">More</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const api = useApi()
const { user } = useAuth()
const { isOpen, toggle } = useMobileNav()
const { unreadCount } = useAnnouncementRead()
const { activeBottomNav } = useNavItems()

const announcements = ref<Array<{ id: string; hidden: boolean; isRead?: boolean }>>([])
const threads = ref<Array<{ lastMessage: { senderId: string; readAt: string | null } | null }>>([])

const hasUnreadAnnouncements = computed(() => unreadCount(announcements.value) > 0)
const hasUnreadMessages = computed(() =>
  threads.value.some(t => t.lastMessage && t.lastMessage.senderId !== user.value?.id && !t.lastMessage.readAt)
)

onMounted(async () => {
  try {
    const [ann, thr] = await Promise.all([
      api.announcements.list.query(),
      api.messages.list.query(),
    ])
    announcements.value = ann
    const { hydrate } = useAnnouncementRead()
    hydrate(ann)
    threads.value = thr
  } catch { /* non-critical */ }
})

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.bottom-nav {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--surface-nav);
  border-top: 0.5px solid rgba(255, 255, 255, 0.06);
  z-index: 98;
  padding-bottom: env(safe-area-inset-bottom);

  @media (min-width: 48rem) {
    display: none;
  }
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--transition-fast);
  padding: var(--space-2) 0;

  &:hover { color: rgba(255, 255, 255, 0.7); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-md); }

  &.bottom-nav-item--active {
    color: var(--text-inverse);
  }
}

.item-icon-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-icon {
  font-size: 18px;
}

.item-dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue-400);
  border: 1.5px solid var(--surface-nav);
}

.item-label {
  font-size: 10px;
  font-weight: var(--font-medium);
  letter-spacing: 0.01em;
}
</style>
