<template>
  <div class="messages-page">

    <!-- Thread list (left panel) -->
    <aside class="thread-panel" :class="{ 'thread-panel--hidden': activeThread && isMobile }">
      <div class="panel-header">
        <h1 class="panel-title">Messages</h1>
        <BaseButton variant="primary" size="sm" @click="openCompose">New message</BaseButton>
      </div>

      <div v-if="threadsLoading" class="panel-loading">
        <div class="spinner" aria-label="Loading" />
      </div>

      <div v-else-if="!threads.length" class="panel-empty">
        <p>No messages yet.</p>
        <p class="panel-empty-sub">Start a conversation with the board or a neighbour.</p>
      </div>

      <ul v-else class="thread-list">
        <li
          v-for="t in threads"
          :key="t.id"
          class="thread-item"
          :class="{ 'thread-item--active': activeThread?.id === t.id, 'thread-item--unread': isThreadUnread(t) }"
        >
          <button type="button" class="thread-row" @click="selectThread(t)">
            <div class="thread-row-top">
              <span class="thread-with">{{ threadDisplayName(t) }}</span>
              <div class="thread-row-right">
                <span v-if="isThreadUnread(t)" class="thread-unread-dot" aria-label="Unread" />
                <time class="thread-time">{{ formatDate(t.lastMessageAt) }}</time>
              </div>
            </div>
            <p class="thread-subject">{{ t.subject }}</p>
            <p v-if="t.lastMessage" class="thread-preview">
              {{ t.lastMessage.sender?.firstName }}: {{ truncate(t.lastMessage.body, 60) }}
            </p>
          </button>
        </li>
      </ul>
    </aside>

    <!-- Conversation (right panel) -->
    <main class="conversation-panel" :class="{ 'conversation-panel--hidden': !activeThread && !composing }">

      <!-- Back button on mobile -->
      <button v-if="isMobile" type="button" class="back-btn" @click="closeThread">← Back</button>

      <!-- Compose new thread -->
      <template v-if="composing">
        <div class="conv-header">
          <h2 class="conv-title">New message</h2>
        </div>
        <form class="compose-form" @submit.prevent="submitCompose">
          <div class="field">
            <label class="label" for="comp-subject">Subject</label>
            <input
              id="comp-subject"
              v-model="compose.subject"
              class="input"
              type="text"
              placeholder="What's this about?"
              maxlength="255"
              required
            />
          </div>

          <div v-if="isBoard" class="field">
            <label class="label" for="comp-type">To</label>
            <select id="comp-type" v-model="compose.recipientType" class="input" @change="compose.recipientId = ''">
              <option value="board">Board (internal)</option>
              <option value="resident">Specific resident</option>
              <option value="unit">All residents on a unit</option>
            </select>
          </div>

          <div v-if="isBoard && compose.recipientType === 'resident'" class="field">
            <label class="label" for="comp-resident">Resident</label>
            <select id="comp-resident" v-model="compose.recipientId" class="input" required>
              <option value="" disabled>Select a resident…</option>
              <option
                v-for="r in recipientResidents"
                :key="r.id"
                :value="r.id"
              >
                {{ r.firstName }} {{ r.lastName }} — {{ r.unit?.unitNumber }}
              </option>
            </select>
          </div>

          <div v-if="isBoard && compose.recipientType === 'unit'" class="field">
            <label class="label" for="comp-unit">Unit</label>
            <select id="comp-unit" v-model="compose.recipientId" class="input" required>
              <option value="" disabled>Select a unit…</option>
              <option v-for="u in recipientUnits" :key="u.id" :value="u.id">
                {{ u.unitNumber }}<template v-if="u.building"> — {{ u.building }}</template>
              </option>
            </select>
          </div>

          <div class="field">
            <label class="label" for="comp-body">Message</label>
            <textarea
              id="comp-body"
              v-model="compose.body"
              class="input textarea"
              placeholder="Write your message…"
              rows="5"
              required
            />
          </div>

          <div v-if="composeError" class="form-error" role="alert">{{ composeError }}</div>

          <div class="compose-footer">
            <BaseButton variant="ghost" type="button" @click="composing = false">Cancel</BaseButton>
            <BaseButton variant="primary" type="submit" :loading="sending">Send</BaseButton>
          </div>
        </form>
      </template>

      <!-- Active thread -->
      <template v-else-if="activeThread">
        <div class="conv-header">
          <div>
            <h2 class="conv-title">{{ activeThread.subject }}</h2>
            <p class="conv-meta">{{ threadDisplayName(activeThread) }}</p>
          </div>
          <button
            v-if="hasIncomingMessages"
            type="button"
            class="mark-unread-btn"
            title="Mark as unread"
            @click="markThreadUnread"
          >
            Mark as unread
          </button>
        </div>

        <div ref="messagesEl" class="messages-scroll">
          <div v-if="messagesLoading" class="msg-loading">
            <div class="spinner" aria-label="Loading" />
          </div>
          <ul v-else class="message-list">
            <li
              v-for="msg in activeMessages"
              :key="msg.id"
              class="message-item"
              :class="{ 'message-item--mine': msg.senderId === user?.id }"
            >
              <div class="msg-bubble">
                <p class="msg-body">{{ msg.body }}</p>
              </div>
              <div class="msg-meta">
                <span class="msg-sender">{{ msg.senderId === user?.id ? 'You' : `${msg.sender?.firstName} ${msg.sender?.lastName}` }}</span>
                <span class="msg-dot" aria-hidden="true">·</span>
                <time class="msg-time">{{ formatTime(msg.createdAt) }}</time>
                <span v-if="msg.senderId === user?.id && msg.readAt" class="msg-read">· Read</span>
              </div>
            </li>
          </ul>
        </div>

        <form class="reply-form" @submit.prevent="submitReply">
          <textarea
            ref="replyInputEl"
            v-model="replyBody"
            class="reply-input"
            placeholder="Write a reply…"
            rows="1"
            required
            @keydown.enter.meta.prevent="submitReply"
            @keydown.enter.ctrl.prevent="submitReply"
          />
          <button type="submit" class="reply-send-btn" :disabled="sending">Send</button>
        </form>
      </template>

      <!-- Nothing selected -->
      <div v-else class="conv-empty">
        <p>Select a conversation or start a new one.</p>
      </div>
    </main>

  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const api = useApi()
const toast = useToast()

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

// ── Thread list ────────────────────────────────────────────────────────────
type Thread = Awaited<ReturnType<typeof api.messages.list.query>>[number]
type FullThread = Awaited<ReturnType<typeof api.messages.get.query>>

const threads = ref<Thread[]>([])
const threadsLoading = ref(true)

async function loadThreads(): Promise<void> {
  threadsLoading.value = true
  try {
    threads.value = await api.messages.list.query()
  } catch {
    toast.error('Failed to load messages')
  } finally {
    threadsLoading.value = false
  }
}

const route = useRoute()

onMounted(async () => {
  updateMobile()
  await loadThreads()

  const threadId = route.query.thread as string | undefined
  if (threadId) {
    const target = threads.value.find(t => t.id === threadId)
    if (target) selectThread(target)
    return
  }

  // ?to=residentId — pre-populate compose for a direct message from directory
  const toResidentId = route.query.to as string | undefined
  if (toResidentId) {
    await openCompose()
    compose.recipientType = 'resident'
    compose.recipientId = toResidentId
    return
  }

  // Auto-select the most recent thread on desktop
  if (!isMobile.value && threads.value.length) {
    selectThread(threads.value[0]!)
  }
})

// ── Active thread ──────────────────────────────────────────────────────────
const activeThread = ref<FullThread | null>(null)
const activeMessages = computed(() => activeThread.value?.messages ?? [])
const messagesLoading = ref(false)
const messagesEl = ref<HTMLElement | null>(null)

async function selectThread(t: Thread): Promise<void> {
  composing.value = false
  messagesLoading.value = true
  try {
    activeThread.value = await api.messages.get.query({ threadId: t.id })
    await api.messages.markRead.mutate({ threadId: t.id })
    // Update thread in list to reflect read state
    await nextTick()
    messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
  } catch {
    toast.error('Failed to load conversation')
  } finally {
    messagesLoading.value = false
  }
}

function closeThread(): void {
  activeThread.value = null
  composing.value = false
}

// ── Compose ────────────────────────────────────────────────────────────────
const composing = ref(false)
const sending = ref(false)
const composeError = ref('')

const compose = reactive({
  subject: '',
  body: '',
  recipientType: 'board' as 'board' | 'resident' | 'unit',
  recipientId: '',
})

const recipientResidents = ref<Awaited<ReturnType<typeof api.messages.listResidents.query>>>([])
const recipientUnits = computed(() => {
  const seen = new Map<string, { id: string; unitNumber: string; building: string | null }>()
  for (const r of recipientResidents.value) {
    if (r.unit && !seen.has(r.unit.id)) seen.set(r.unit.id, r.unit)
  }
  return [...seen.values()]
})

async function openCompose(): Promise<void> {
  composing.value = true
  activeThread.value = null
  compose.subject = ''
  compose.body = ''
  compose.recipientType = 'board'
  compose.recipientId = ''
  composeError.value = ''

  if (isBoard.value && !recipientResidents.value.length) {
    try {
      recipientResidents.value = await api.messages.listResidents.query()
    } catch { /* non-critical */ }
  }
}

async function submitCompose(): Promise<void> {
  composeError.value = ''
  sending.value = true
  try {
    await api.messages.create.mutate({
      subject: compose.subject,
      body: compose.body,
      recipientType: compose.recipientType,
      recipientId: compose.recipientId || undefined,
    })
    composing.value = false
    await loadThreads()
    toast.success('Message sent')
  } catch {
    composeError.value = 'Failed to send. Please try again.'
  } finally {
    sending.value = false
  }
}

const hasIncomingMessages = computed(() =>
  activeMessages.value.some(m => m.senderId !== user.value?.id)
)

async function markThreadUnread(): Promise<void> {
  if (!activeThread.value) return
  try {
    await api.messages.markUnread.mutate({ threadId: activeThread.value.id })
    activeThread.value = null
    await loadThreads()
  } catch {
    toast.error('Failed to mark as unread')
  }
}

// ── Reply ──────────────────────────────────────────────────────────────────
const replyBody = ref('')
const replyInputEl = ref<HTMLTextAreaElement | null>(null)

function resizeReplyInput(): void {
  const el = replyInputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(replyBody, () => nextTick(resizeReplyInput))

async function submitReply(): Promise<void> {
  if (!activeThread.value || !replyBody.value.trim()) return
  sending.value = true
  try {
    await api.messages.reply.mutate({ threadId: activeThread.value.id, body: replyBody.value })
    replyBody.value = ''
    await nextTick()
    if (replyInputEl.value) replyInputEl.value.style.height = 'auto'
    // Refresh the thread
    activeThread.value = await api.messages.get.query({ threadId: activeThread.value.id })
    await nextTick()
    messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
    // Update thread list preview
    await loadThreads()
  } catch {
    toast.error('Failed to send reply')
  } finally {
    sending.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const isMobile = ref(false)

function updateMobile(): void {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
})

function threadDisplayName(t: Thread | FullThread): string {
  if (t.recipientType === 'board') {
    return t.createdBy === user.value?.id ? 'Board' : `${t.createdByResident?.firstName} ${t.createdByResident?.lastName}`
  }
  if (t.recipientType === 'unit') return `Unit residents`
  // resident-to-resident — show the other party
  return t.createdBy === user.value?.id ? 'Resident' : `${t.createdByResident?.firstName} ${t.createdByResident?.lastName}`
}

function isThreadUnread(t: Thread): boolean {
  if (!t.lastMessage) return false
  return t.lastMessage.senderId !== user.value?.id && !t.lastMessage.readAt
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + '…' : s
}

function formatDate(raw: string | Date): string {
  const d = new Date(raw)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(raw: string | Date): string {
  return new Date(raw).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.messages-page {
  display: flex;
  /* Cancel app-main mobile padding (--space-5 top, --space-4 sides) */
  margin: calc(var(--space-5) * -1) calc(var(--space-4) * -1) calc(var(--space-5) * -1);
  /* 52px navbar + 64px bottom nav */
  height: calc(100dvh - 52px - 64px);
  overflow: hidden;

  @media (min-width: 48rem) {
    margin: calc(var(--space-6) * -1) calc(var(--space-6) * -1) 0;
    height: calc(100dvh - 64px);
  }
}

/* ── Thread list panel ─────────────────────────────────────────────────── */
.thread-panel {
  width: 100%;
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-card);

  @media (min-width: 768px) {
    width: 300px;
    flex-shrink: 0;
  }

  &.thread-panel--hidden {
    display: none;

    @media (min-width: 768px) {
      display: flex;
    }
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.panel-title {
  font-size: var(--text-base);
  font-weight: 500;
  margin: 0;
}

.panel-loading,
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--space-6);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  gap: var(--space-2);
}

.panel-empty-sub {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.thread-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.thread-item {
  border-bottom: 1px solid var(--border-subtle);

  &.thread-item--active .thread-row {
    background: var(--blue-50);
  }

  &.thread-item--unread .thread-subject {
    font-weight: 500;
    color: var(--text-primary);
  }
}

.thread-row {
  width: 100%;
  background: none;
  border: none;
  padding: var(--space-3) var(--space-4);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 44px;
  transition: background 0.1s;

  &:hover { background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--border-focus); }
}

.thread-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.thread-row-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.thread-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue-400);
  flex-shrink: 0;
}

.thread-with {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.thread-time {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.thread-subject {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-preview {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Conversation panel ────────────────────────────────────────────────── */
.conversation-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;

  &.conversation-panel--hidden {
    display: none;

    @media (min-width: 768px) {
      display: flex;
    }
  }
}

.back-btn {
  background: none;
  border: none;
  font-size: var(--text-sm);
  color: var(--text-link);
  padding: var(--space-3) var(--space-4);
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--border-default);

  &:hover { text-decoration: underline; }
}

.conv-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.conv-title {
  font-size: var(--text-base);
  font-weight: 500;
  margin: 0 0 var(--space-1);
  color: var(--text-primary);
}

.conv-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mark-unread-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.conv-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

/* ── Messages scroll ───────────────────────────────────────────────────── */
.messages-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
}

.msg-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: auto;
}

.message-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  max-width: 75%;

  &.message-item--mine {
    align-self: flex-end;
    align-items: flex-end;

    .msg-bubble {
      background: var(--blue-400);
      color: #fff;
    }
  }
}

.msg-bubble {
  background: var(--surface-raised);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  max-width: 100%;
}

.msg-body {
  font-size: var(--text-sm);
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.msg-dot { opacity: 0.5; }
.msg-read { color: var(--blue-400); }

/* ── Reply form ────────────────────────────────────────────────────────── */
.reply-form {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}

.reply-send-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  min-height: 44px;
  background: var(--gradient-brand);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}


.reply-input {
  flex: 1;
  width: 100%;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  font-family: inherit;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  color: var(--text-primary);
  background: var(--surface-card);
  min-height: 44px;
  max-height: 160px;

  &:focus {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-color: var(--border-focus);
  }
}

/* ── Compose form ──────────────────────────────────────────────────────── */
.compose-form {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.compose-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

/* ── Form fields ───────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  box-sizing: border-box;

  &:focus {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-color: var(--border-focus);
  }

  &.textarea {
    resize: vertical;
    font-family: inherit;
    line-height: 1.6;
  }
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 1px solid var(--danger-mid);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

/* ── Spinner ───────────────────────────────────────────────────────────── */
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
