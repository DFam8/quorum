<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const router = useRouter()
const { user } = useAuth()
const { isBoardMember } = await import('../../utils/permissions')

onMounted(() => {
  const dest = user.value && isBoardMember(user.value) ? '/dashboard' : '/feed'
  router.replace(dest)
})
</script>
