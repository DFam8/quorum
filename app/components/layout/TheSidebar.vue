<template>
  <!-- Overlay (mobile only) -->
  <Transition name="overlay">
    <div
      v-if="isOpen"
      class="sidebar-overlay"
      aria-hidden="true"
      @click="close"
    />
  </Transition>

  <nav
    id="mobile-sidebar"
    class="sidebar"
    :class="{ 'sidebar--open': isOpen }"
    aria-label="Main navigation"
  >
    <div class="sidebar-header">
      <div class="logo-mark" aria-hidden="true" />
      <div class="logo-text-group">
        <span class="logo-community">{{ communityName || 'Quorum' }}</span>
        <span v-if="communityName" class="logo-platform">Powered by Quorum</span>
      </div>
      <!-- Close button — mobile only -->
      <button class="sidebar-close" aria-label="Close navigation" @click="close">
        <FaIcon :icon="['fajr', 'xmark']" aria-hidden="true" />
      </button>
    </div>

    <ul class="sidebar-nav">
      <li v-for="item in navItems" :key="item.path">
        <NuxtLink :to="item.path" class="nav-item" :aria-current="isActive(item.path) ? 'page' : undefined" @click="close">
          <FaIcon :icon="['fajr', item.icon]" class="nav-icon" aria-hidden="true" fixed-width />
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.path === '/announcements' && hasUnreadAnnouncements" class="nav-dot" aria-label="New announcements" />
          <span v-if="item.path === '/messages' && hasUnreadMessages" class="nav-dot" aria-label="Unread messages" />
        </NuxtLink>
      </li>
    </ul>

    <div v-if="isBoard" class="sidebar-section">
      <span class="section-label">Admin</span>
      <ul class="sidebar-nav sidebar-nav--compact">
        <li v-for="item in adminItems" :key="item.path">
          <NuxtLink :to="item.path" class="nav-item" :aria-current="isActive(item.path) ? 'page' : undefined" @click="close">
            <FaIcon :icon="['fajr', item.icon]" class="nav-icon" aria-hidden="true" fixed-width />
            <span class="nav-label">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div class="sidebar-footer">
      <NuxtLink to="/portal/profile" class="nav-item nav-profile" @click="close">
        <div class="avatar" aria-hidden="true">
          {{ userInitials }}
        </div>
        <span class="nav-label">{{ userName }}</span>
      </NuxtLink>
      <button class="nav-item nav-signout" @click="signOut">
        <FaIcon :icon="['fajr', 'arrow-right-from-bracket']" class="nav-icon" aria-hidden="true" fixed-width />
        <span class="nav-label">Sign out</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../../utils/permissions'

const route = useRoute()
const { user, signOut } = useAuth()
const api = useApi()
const { unreadCount } = useAnnouncementRead()
const { isOpen, close } = useMobileNav()

const announcements = ref<Array<{ id: string; hidden: boolean; isRead?: boolean }>>([])
const hasUnreadAnnouncements = computed(() => unreadCount(announcements.value) > 0)

const threads = ref<Array<{ lastMessage: { senderId: string; readAt: string | null } | null }>>([])
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

// Close on route change and Escape key
watch(() => route.path, close)

onMounted(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})

const boardNavItems = [
  { path: '/dashboard',        label: 'Dashboard',     icon: 'gauge' },
  { path: '/feed',             label: 'Feed',          icon: 'newspaper' },
  { path: '/meetings',         label: 'Meetings',      icon: 'calendar' },
  { path: '/polls',            label: 'Polls',         icon: 'chart-bar' },
  { path: '/messages',         label: 'Messages',      icon: 'comment-dots' },
  { path: '/portal/directory', label: 'Directory',     icon: 'users' },
  { path: '/portal/documents', label: 'Documents',     icon: 'folder' },
]

const residentNavItems = [
  { path: '/feed',             label: 'Feed',          icon: 'newspaper' },
  { path: '/meetings',         label: 'Meetings',      icon: 'calendar' },
  { path: '/polls',            label: 'Polls',         icon: 'chart-bar' },
  { path: '/messages',         label: 'Messages',      icon: 'comment-dots' },
  { path: '/portal/directory', label: 'Directory',     icon: 'users' },
  { path: '/portal/documents', label: 'Documents',     icon: 'folder' },
]

const navItems = computed(() => isBoard.value ? boardNavItems : residentNavItems)

const adminItems = [
  { path: '/admin/units',     label: 'Units',     icon: 'building' },
  { path: '/admin/residents', label: 'Residents', icon: 'user' },
  { path: '/admin/settings',  label: 'Settings',  icon: 'gear' },
  { path: '/admin/dev',       label: 'Dev tools', icon: 'wrench' },
]

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

const { communityName, fetchCommunity } = useCommunity()
onMounted(fetchCommunity)

const userName = computed(() => {
  if (!user.value) return ''
  return `${user.value.firstName} ${user.value.lastName}`
})

const userInitials = computed(() => {
  if (!user.value) return '?'
  return `${user.value.firstName[0] ?? ''}${user.value.lastName[0] ?? ''}`.toUpperCase()
})

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
/* ── Overlay ──────────────────────────────────────────────────── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;

  @media (min-width: 48rem) {
    display: none;
  }
}

.overlay-enter-active,
.overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from,
.overlay-leave-to { opacity: 0; }

/* ── Sidebar / tray ───────────────────────────────────────────── */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100dvh;
  background: var(--surface-nav);
  display: flex;
  flex-direction: column;
  padding: var(--space-4) 0;
  z-index: 100;
  overflow-y: auto;

  /* Mobile: hidden by default, slides in when open */
  transform: translateX(-100%);
  transition: transform 0.25s ease;

  &.sidebar--open {
    transform: translateX(0);
  }

  @media (min-width: 48rem) {
    transform: none;
    transition: none;
    width: 220px;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) var(--space-6);

  .logo-mark {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--gradient-brand);
    flex-shrink: 0;
  }
}

.sidebar-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-left: auto;
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.4);
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-inverse);
  }

  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  @media (min-width: 48rem) {
    display: none;
  }
}

.logo-text-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.logo-community {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-inverse);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logo-platform {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.01em;
}

.sidebar-nav {
  flex: 1;
  padding: 0 var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--slate-400);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  min-height: 44px;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-inverse);
    text-decoration: none;
  }

  &[aria-current='page'] {
    background: rgba(79, 127, 255, 0.18);
    color: var(--text-inverse);
  }

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }
}

.nav-icon {
  width: 16px;
  flex-shrink: 0;
}

.nav-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--blue-400);
  margin-left: auto;
  flex-shrink: 0;
}

.sidebar-section {
  padding: var(--space-4) var(--space-2) 0;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 var(--space-3);
}

.sidebar-nav--compact {
  gap: 0;
}

.sidebar-footer {
  padding: var(--space-4) var(--space-2) 0;
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  margin-top: var(--space-4);
}

.nav-profile {
  gap: var(--space-3);
}

.nav-signout {
  color: rgba(255, 255, 255, 0.35);
  width: 100%;

  &:hover {
    color: var(--danger-mid);
    background: rgba(239, 68, 68, 0.1);
  }
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--blue-800);
  color: var(--blue-100);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
