<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="sheet-backdrop" @click.self="dismiss">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="a2hs-title">

          <div class="sheet-handle" aria-hidden="true" />

          <div class="sheet-head">
            <div class="sheet-logo" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="qgrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#818cf8" />
                    <stop offset="100%" stop-color="#6366f1" />
                  </linearGradient>
                </defs>
                <rect width="40" height="40" rx="10" fill="url(#qgrad)" />
                <text x="20" y="27" text-anchor="middle" font-size="18" fill="white" font-weight="500" font-family="system-ui">Q</text>
              </svg>
            </div>
            <div>
              <h2 id="a2hs-title" class="sheet-title">
                {{ isAndroid ? 'Install Quorum' : 'Get notifications from Quorum' }}
              </h2>
              <p class="sheet-subtitle">
                {{ isAndroid ? 'Add to your home screen for the best experience' : 'Add to your home screen in 3 taps' }}
              </p>
            </div>
          </div>

          <!-- Android: single-tap native install -->
          <div v-if="isAndroid" class="android-body">
            <p class="android-desc">
              Install Quorum on your home screen to get push notifications for announcements, meetings, and messages — even when your browser is closed.
            </p>
          </div>

          <!-- iOS: step-by-step instructions -->
          <ol v-else class="steps">
            <li class="step">
              <div class="step-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v12M8 6l4-4 4 4" />
                  <path d="M8 10H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-3" />
                </svg>
              </div>
              <div class="step-text">
                <span class="step-label">Tap the <strong>Share</strong> button</span>
                <span class="step-hint">The box with an arrow at the bottom of Safari</span>
              </div>
            </li>
            <li class="step">
              <div class="step-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div class="step-text">
                <span class="step-label">Tap <strong>"Add to Home Screen"</strong></span>
                <span class="step-hint">Scroll down in the share sheet to find it</span>
              </div>
            </li>
            <li class="step">
              <div class="step-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="step-text">
                <span class="step-label">Tap <strong>"Add"</strong> to confirm</span>
                <span class="step-hint">Quorum will appear on your home screen</span>
              </div>
            </li>
          </ol>

          <div class="sheet-actions">
            <button v-if="isAndroid" type="button" class="sheet-install-btn" @click="installAndroid">
              Add to Home Screen
            </button>
            <button type="button" class="sheet-skip" @click="dismiss">Not now</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { user } = useAuth()

const visible = ref(false)
const isAndroid = ref(false)

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferredPrompt: BeforeInstallPromptEvent | null = null

onMounted(() => {
  if (!import.meta.client) return
  if (!user.value) return
  if (localStorage.getItem('a2hs_dismissed')) return
  if (isStandalone()) return

  // Android: capture the install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    isAndroid.value = true
    setTimeout(() => { visible.value = true }, 2000)
  })

  // iOS Safari: show manual steps
  if (isIosSafari()) {
    setTimeout(() => { visible.value = true }, 2000)
  }
})

async function installAndroid(): Promise<void> {
  if (!deferredPrompt) return
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    localStorage.setItem('a2hs_dismissed', '1')
    visible.value = false
  }
  deferredPrompt = null
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|opios|chrome/i.test(ua)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  )
}

function dismiss(): void {
  localStorage.setItem('a2hs_dismissed', '1')
  visible.value = false
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9990;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet {
  background: var(--surface-card);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: var(--space-3) var(--space-5) var(--space-6);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  margin: 0 auto var(--space-1);
  flex-shrink: 0;
}

.sheet-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.sheet-logo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;

  svg { width: 100%; height: 100%; display: block; }
}

.sheet-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin: 0 0 2px;
}

.sheet-subtitle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Steps ────────────────────────────────────────────────────── */
.steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.step {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  border: 0.5px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);

  svg { width: 20px; height: 20px; }
}

.step-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.step-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* ── Android ──────────────────────────────────────────────────── */
.android-body {
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.android-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* ── Actions ──────────────────────────────────────────────────── */
.sheet-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.sheet-install-btn {
  width: 100%;
  min-height: 50px;
  background: var(--gradient-brand);
  color: #fff;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:hover { opacity: 0.9; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

.sheet-skip {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  min-height: 44px;
  padding: var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  transition: color var(--transition-fast);

  &:hover { color: var(--text-secondary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Transition ───────────────────────────────────────────────── */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;

  .sheet { transition: transform 0.25s ease; }
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;

  .sheet { transform: translateY(100%); }
}
</style>
