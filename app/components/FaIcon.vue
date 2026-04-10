<template>
  <ClientOnly>
    <FontAwesomeIcon v-bind="$attrs" />
  </ClientOnly>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

defineOptions({ inheritAttrs: false })
</script>
