<template>
  <div class="app-shell">
    <TheSidebar />
    <div class="app-content">
      <TheNavbar />
      <main class="app-main">
        <div class="app-inner">
          <slot />
        </div>
      </main>
    </div>
    <TheBottomNav />
    <TheToastContainer />
    <PasskeyEnrollPrompt />
    <AddToHomeScreenPrompt />
  </div>
</template>

<script setup lang="ts">
const { isOpen } = useMobileNav()
watchEffect(() => {
  if (import.meta.client) {
    document.body.style.overflow = isOpen.value ? 'hidden' : ''
  }
})
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100dvh;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 64px;

  @media (min-width: 48rem) {
    padding-bottom: 0;
    margin-left: 220px;
  }
}

.app-main {
  flex: 1;
  padding: var(--space-5) var(--space-4);

  @media (min-width: 48rem) {
    padding: var(--space-6) var(--space-6);
  }
}

.app-inner {
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}
</style>
