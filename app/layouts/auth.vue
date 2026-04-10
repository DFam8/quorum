<template>
  <div class="auth-shell">
    <header class="auth-header">
      <div class="logo-mark" aria-hidden="true" />
      <span class="logo-text">Quorum</span>
    </header>
    <main class="auth-main">
      <slot />
    </main>
    <footer class="auth-footer">
      <p>Built for your community.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.auth-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface-page);
  padding: var(--space-5) var(--space-4);
}

.auth-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) 0 var(--space-8);

  .logo-mark {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    background: var(--gradient-brand);
    flex-shrink: 0;
  }

  .logo-text {
    font-size: var(--text-xl);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
}

.auth-main {
  width: 100%;
  max-width: 420px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.auth-footer {
  padding: var(--space-6) 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
