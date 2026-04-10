<template>
  <li
    class="announcement-card"
    :class="{
      'announcement-card--urgent': announcement.priority === 'urgent',
      'announcement-card--hidden': announcement.hidden,
    }"
  >
    <div v-if="announcement.hidden" class="hidden-state">
      <p class="hidden-text">This post was hidden by a moderator.</p>
      <p v-if="announcement.hiddenReason" class="hidden-reason">"{{ announcement.hiddenReason }}"</p>
    </div>

    <template v-else>
      <div class="card-header">
        <div class="badges">
          <span v-if="isUnread" class="badge badge--new">New</span>
          <span v-if="announcement.pinned" class="badge badge--pinned">Pinned</span>
          <span v-if="announcement.priority === 'urgent'" class="badge badge--urgent">Urgent</span>
        </div>
        <div v-if="showActions" class="actions">
          <button
            type="button"
            class="action-btn"
            :class="{ 'action-btn--active': announcement.pinned }"
            :title="announcement.pinned ? 'Unpin' : 'Pin'"
            @click="emit('pin', announcement)"
          >
            <FaIcon :icon="['fajr', 'thumbtack']" />
          </button>
          <button type="button" class="action-btn" title="Edit" @click="emit('edit', announcement)">
            <FaIcon :icon="['fajr', 'pencil']" />
          </button>
          <button type="button" class="action-btn action-btn--danger" title="Hide" @click="emit('hide', announcement)">
            <FaIcon :icon="['fajr', 'eye-slash']" />
          </button>
        </div>
      </div>

      <h2 class="card-title">{{ announcement.title }}</h2>

      <div class="card-body" :class="{ 'card-body--expanded': expanded }">
        <p class="card-text">{{ announcement.body }}</p>
      </div>
      <button v-if="isLong" type="button" class="expand-btn" @click="expanded = !expanded">
        {{ expanded ? 'Show less' : 'Read more' }}
      </button>

      <div class="card-meta">
        <span v-if="announcement.createdByResident" class="meta-author">
          {{ announcement.createdByResident.firstName }} {{ announcement.createdByResident.lastName }}
        </span>
        <span class="meta-dot" aria-hidden="true">·</span>
        <time :datetime="String(announcement.createdAt)" class="meta-date">{{ formattedDate }}</time>
        <template v-if="(announcement.editHistory?.length ?? 0) > 0">
          <span class="meta-dot" aria-hidden="true">·</span>
          <span class="meta-edited">Edited</span>
        </template>
      </div>
    </template>
  </li>
</template>

<script setup lang="ts">
const TRUNCATE_CHARS = 320

type Announcement = {
  id: string
  title: string
  body: string
  priority: string
  pinned: boolean
  hidden: boolean
  hiddenReason?: string | null
  createdAt: string | Date
  editHistory?: unknown[]
  createdByResident?: { firstName: string; lastName: string } | null
}

type Props = {
  announcement: Announcement
  isUnread: boolean
  showActions: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [announcement: Announcement]
  pin: [announcement: Announcement]
  hide: [announcement: Announcement]
}>()

const expanded = ref(false)

const isLong = computed(() => props.announcement.body.length > TRUNCATE_CHARS)

const formattedDate = computed(() => {
  const d = new Date(props.announcement.createdAt)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})
</script>

<style scoped>
.announcement-card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  list-style: none;

  &.announcement-card--urgent {
    border-left: 3px solid var(--danger-mid);
  }

  &.announcement-card--hidden {
    background: var(--surface-raised);
    border-style: dashed;
  }
}

/* ── Header ───────────────────────────────────────────────── */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  min-height: 24px;
}

.badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  line-height: 1.5;

  &.badge--new {
    background: var(--blue-400);
    color: var(--text-inverse);
  }

  &.badge--pinned {
    background: var(--surface-raised);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
  }

  &.badge--urgent {
    background: var(--danger-mid);
    color: var(--text-inverse);
  }
}

.actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-tertiary);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover {
    background: var(--surface-raised);
    color: var(--text-primary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  &.action-btn--active {
    color: var(--blue-400);
    border-color: var(--blue-400);
    background: var(--blue-50);

    &:hover { background: var(--blue-100); }
  }

  &.action-btn--danger {
    color: var(--danger-text);
    border-color: var(--danger-mid);

    &:hover { background: var(--danger-bg); }
  }
}

/* ── Content ──────────────────────────────────────────────── */
.card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 var(--space-3);
  line-height: var(--line-height-tight);
}

.card-body {
  overflow: hidden;
  max-height: 5.4em;

  &.card-body--expanded { max-height: none; }
}

.card-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--line-height-loose);
  margin: 0;
  white-space: pre-line;
}

.expand-btn {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--blue-400);
  background: none;
  border: none;
  padding: var(--space-1) 0;
  margin-top: var(--space-1);
  cursor: pointer;

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: var(--radius-sm); }
}

/* ── Meta ─────────────────────────────────────────────────── */
.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.meta-dot { opacity: 0.5; }
.meta-edited { font-style: italic; }

/* ── Hidden state ─────────────────────────────────────────── */
.hidden-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-1);
  padding: var(--space-2) 0;
}

.hidden-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.hidden-reason {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-style: italic;
  margin: 0;
}
</style>
