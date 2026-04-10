<template>
  <div class="directory-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Resident directory</h1>
        <p class="page-subtitle">{{ listedCount }} resident{{ listedCount === 1 ? '' : 's' }} listed</p>
      </div>
      <div class="search-wrap">
        <input
          v-model="search"
          class="search-input"
          type="search"
          placeholder="Search by name or unit…"
          aria-label="Search directory"
        />
      </div>
    </div>

    <div v-if="loading" class="dir-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!filteredUnits.length" class="dir-empty">
      <p>No results found.</p>
    </div>

    <ul v-else class="unit-list">
      <li v-for="u in filteredUnits" :key="u.id" class="unit-item">
        <button
          type="button"
          class="unit-row"
          :aria-expanded="expandedUnit === u.id"
          @click="toggleUnit(u.id)"
        >
          <div class="unit-primary">
            <div class="unit-name-row">
              <span class="unit-name">{{ unitDisplayName(u) }}</span>
              <span class="unit-badge">{{ typeLabel(u.unitType) }}</span>
            </div>
            <span v-if="u.building && u.unitType !== 'sfh'" class="unit-building">{{ u.building }}</span>
          </div>
          <div class="unit-right">
            <span class="unit-primary-contact">
              {{ primaryContactName(u) }}
            </span>
            <span class="unit-chevron" :class="{ 'unit-chevron--open': expandedUnit === u.id }">›</span>
          </div>
        </button>

        <ul v-if="expandedUnit === u.id" class="occupant-list">
          <li
            v-for="r in activeResidents(u)"
            :key="r.id"
            class="occupant-row"
          >
            <div class="occupant-info">
              <span class="occupant-name">
                {{ r.directoryOptOut ? 'Resident (opted out)' : `${r.firstName} ${r.lastName}` }}
              </span>
              <span v-if="isPrimary(u, r.id)" class="occupant-tag">Primary</span>
              <span v-if="hasBoardRole(r)" class="occupant-tag occupant-tag--board">
                {{ boardLabel(r) }}
              </span>
            </div>
            <div class="occupant-right">
              <span v-if="!r.directoryOptOut && r.phone" class="occupant-phone">{{ r.phone }}</span>
              <NuxtLink
                v-if="!r.directoryOptOut && r.allowDirectMessages && r.id !== user?.id"
                :to="`/messages?to=${r.id}`"
                class="occupant-msg-btn"
                :aria-label="`Message ${r.firstName} ${r.lastName}`"
              >
                Message
              </NuxtLink>
            </div>
          </li>
          <li v-if="!activeResidents(u).length" class="occupant-row occupant-row--empty">
            No residents on record.
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const { error: toastError } = useToast()

type DirectoryUnit = Awaited<ReturnType<typeof api.residents.directory.query>>[number]
type DirectoryResident = DirectoryUnit['households'][number]['residents'][number]

const loading = ref(true)
const units = ref<DirectoryUnit[]>([])
const search = ref('')
const expandedUnit = ref<string | null>(null)

onMounted(async () => {
  try {
    units.value = await api.residents.directory.query()
  } catch {
    toastError('Failed to load directory.')
  } finally {
    loading.value = false
  }
})

const listedCount = computed(() =>
  units.value.reduce((sum, u) =>
    sum + u.households.flatMap(h => h.residents).filter(r => !r.directoryOptOut).length, 0)
)

const filteredUnits = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return units.value
  return units.value.filter(u => {
    if (unitDisplayName(u).toLowerCase().includes(q)) return true
    const residents = u.households.flatMap(h => h.residents)
    return residents.some(r =>
      !r.directoryOptOut &&
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)
    )
  })
})

function activeResidents(u: DirectoryUnit): DirectoryResident[] {
  return u.households.flatMap(h => h.residents)
}

function primaryContactName(u: DirectoryUnit): string {
  const primaryId = u.households.find(h => h.primaryResidentId)?.primaryResidentId
  if (!primaryId) return 'No primary contact'
  const r = u.households.flatMap(h => h.residents).find(r => r.id === primaryId)
  if (!r || r.directoryOptOut) return 'Resident'
  return `${r.firstName} ${r.lastName}`
}

function isPrimary(u: DirectoryUnit, residentId: string): boolean {
  return u.households.some(h => h.primaryResidentId === residentId)
}

function hasBoardRole(r: DirectoryResident): boolean {
  return r.roles.some(role => !role.revokedAt && (role.role === 'board_member' || role.role === 'super_admin'))
}

function boardLabel(r: DirectoryResident): string {
  const role = r.roles.find(role => !role.revokedAt && (role.role === 'board_member' || role.role === 'super_admin'))
  if (!role) return 'Board'
  if (role.title) return role.title
  if (role.role === 'super_admin') return 'President'
  const rankLabels: Record<number, string> = { 1: 'President', 2: 'VP', 3: 'Officer', 4: 'Board member' }
  return role.rank ? (rankLabels[role.rank] ?? 'Board member') : 'Board member'
}

function unitDisplayName(u: { unitNumber: string; unitType: string }): string {
  return u.unitType === 'sfh' ? u.unitNumber : `Unit ${u.unitNumber}`
}

function typeLabel(type: string): string {
  return { condo: 'Condo', apartment: 'Apt', sfh: 'SFH' }[type] ?? type
}

function toggleUnit(id: string): void {
  expandedUnit.value = expandedUnit.value === id ? null : id
}
</script>

<style scoped>
.directory-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-medium);
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.search-wrap {
  flex-shrink: 0;
}

.search-input {
  width: 240px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  min-height: 44px;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }

  @media (max-width: 36rem) {
    width: 100%;
  }
}

.dir-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-8);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--blue-400);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.dir-empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.unit-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.unit-item {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.unit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  width: 100%;
  text-align: left;
  min-height: 56px;
  transition: background var(--transition-fast);

  &:hover { background: var(--surface-raised); }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

.unit-primary {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.unit-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.unit-name {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.unit-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--info-text);
  background: var(--info-bg);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
}

.unit-building {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.unit-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.unit-primary-contact {
  font-size: var(--text-sm);
  color: var(--text-secondary);

  @media (max-width: 36rem) {
    display: none;
  }
}

.unit-chevron {
  font-size: var(--text-lg);
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
  line-height: 1;

  &.unit-chevron--open { transform: rotate(90deg); }
}

.occupant-list {
  border-top: 0.5px solid var(--border-subtle);
}

.occupant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }

  &.occupant-row--empty {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
    font-style: italic;
  }
}

.occupant-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.occupant-name {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.occupant-tag {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);

  &.occupant-tag--board {
    color: var(--info-text);
    background: var(--info-bg);
  }
}

.occupant-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.occupant-phone {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.occupant-msg-btn {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-link);
  text-decoration: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border-default);
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: var(--blue-50);
    border-color: var(--blue-100);
    text-decoration: none;
  }

  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}
</style>
