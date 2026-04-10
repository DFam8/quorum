<template>
  <header class="navbar">
    <div class="navbar-brand">
      <div class="logo-mark" aria-hidden="true" />
      <span class="logo-text">{{ communityName || 'Quorum' }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
const { communityName, fetchCommunity } = useCommunity()
onMounted(fetchCommunity)
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 var(--space-4);
  background: var(--surface-nav);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
  position: sticky;
  top: 0;
  z-index: 50;

  @media (min-width: 48rem) {
    display: none;
  }
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);

  .logo-mark {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    background: var(--gradient-brand);
    flex-shrink: 0;
  }

  .logo-text {
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-inverse);
  }
}
</style>
