<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { init: initTheme } = useTheme()
onMounted(initTheme)

useHead({
  link: [
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
  ],
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Quorum' },
  ],
})
</script>
