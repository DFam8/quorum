<template>
  <div class="admin-units">
    <div class="page-header">
      <div>
        <h1 class="page-title">Units</h1>
        <p class="page-subtitle">
          {{ units?.length ?? 0 }} unit{{ units?.length === 1 ? '' : 's' }}
          <template v-if="groupedUnits.length > 1"> across {{ groupedUnits.length }} groups</template>
        </p>
      </div>
      <div class="header-actions">
        <BaseButton variant="secondary" @click="showImport = true">Bulk import CSV</BaseButton>
        <BaseButton variant="primary" @click="showAddUnit = true">Add unit</BaseButton>
      </div>
    </div>

    <div v-if="loading" class="units-loading">
      <div class="spinner" aria-label="Loading units" />
    </div>

    <div v-else-if="!units?.length" class="units-empty">
      <p class="empty-title">No units yet</p>
      <p class="empty-desc">Add your first unit to start inviting residents.</p>
      <BaseButton variant="primary" @click="showAddUnit = true">Add first unit</BaseButton>
    </div>

    <div v-else class="unit-groups">
      <section v-for="group in groupedUnits" :key="group.label" class="unit-group">
        <button
          type="button"
          class="group-header"
          :aria-expanded="!collapsed.has(group.label)"
          @click="toggleGroup(group.label)"
        >
          <span class="group-chevron" :class="{ 'group-chevron--open': !collapsed.has(group.label) }">›</span>
          <h2 class="group-name">{{ group.label }}</h2>
          <span class="group-count">{{ group.units.length }} unit{{ group.units.length === 1 ? '' : 's' }}</span>
        </button>
        <ul v-if="!collapsed.has(group.label)" class="units-list">
          <li v-for="u in group.units" :key="u.id" class="unit-row">
            <div class="unit-info">
              <div class="unit-name-stack">
                <span class="unit-number">{{ unitDisplayName(u) }}</span>
                <span v-if="primaryName(u)" class="unit-primary-name">{{ primaryName(u) }}</span>
              </div>
              <span class="unit-type-badge">{{ typeLabel(u.unitType) }}</span>
              <span v-if="u.floor && u.unitType !== 'sfh'" class="unit-meta">Floor {{ u.floor }}</span>
            </div>
            <div class="unit-occupants">
              <span class="occupant-count">
                {{ activeResidents(u) }} resident{{ activeResidents(u) === 1 ? '' : 's' }}
              </span>
            </div>
            <div class="unit-actions">
              <BaseButton variant="ghost" @click="openInvite(u)">Invite resident</BaseButton>
              <BaseButton variant="ghost" @click="openEdit(u)">Edit</BaseButton>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Add / Edit unit modal -->
    <Teleport to="body">
      <div v-if="showAddUnit || editingUnit" class="modal-backdrop" @click.self="closeModal">
        <div class="modal" role="dialog" :aria-label="editingUnit ? 'Edit unit' : 'Add unit'">
          <h2 class="modal-title">{{ editingUnit ? 'Edit unit' : 'Add unit' }}</h2>

          <form class="modal-form" @submit.prevent="saveUnit">
            <div class="field">
              <label class="field-label" for="unit-type">Property type</label>
              <select id="unit-type" v-model="unitForm.unitType" class="field-select" :disabled="saving">
                <option value="condo">Condo</option>
                <option value="apartment">Apartment</option>
                <option value="sfh">Single Family Home</option>
              </select>
            </div>

            <BaseInput
              v-model="unitForm.unitNumber"
              :label="unitForm.unitType === 'sfh' ? 'Street address' : 'Unit number'"
              :placeholder="unitForm.unitType === 'sfh' ? '469 Maple Drive' : '101'"
              :hint="unitForm.unitType === 'sfh' ? 'Full street address — used as the unique identifier.' : undefined"
              :error="unitErrors.unitNumber"
              :disabled="saving"
              required
            />

            <div v-if="unitForm.unitType !== 'sfh'" class="form-row">
              <BaseInput v-model="unitForm.building" label="Building" placeholder="Building A" :disabled="saving" />
              <BaseInput v-model="unitForm.floor" label="Floor" type="number" placeholder="1" :disabled="saving" />
            </div>

            <BaseInput v-model="unitForm.notes" label="Notes" placeholder="Optional internal notes" :disabled="saving" />

            <p v-if="saveError" class="form-error" role="alert">{{ saveError }}</p>

            <div class="modal-actions">
              <button
                v-if="editingUnit"
                type="button"
                class="delete-trigger"
                :disabled="saving"
                @click="openDeleteConfirm(editingUnit)"
              >
                Delete unit
              </button>
              <BaseButton variant="secondary" type="button" :disabled="saving" @click="closeModal">Cancel</BaseButton>
              <BaseButton variant="primary" type="submit" :loading="saving">
                {{ editingUnit ? 'Save changes' : 'Add unit' }}
              </BaseButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Bulk import modal -->
    <Teleport to="body">
      <div v-if="showImport" class="modal-backdrop" @click.self="closeImport">
        <div class="modal modal--wide" role="dialog" aria-label="Bulk import units">
          <h2 class="modal-title">Bulk import units &amp; residents</h2>

          <!-- Step 1: upload -->
          <template v-if="importStep === 'upload'">
            <p class="import-desc">
              Upload a CSV file with one resident per row. Units are created automatically if they don't already exist.
              Duplicate emails are skipped.
            </p>

            <a href="#" class="template-link" @click.prevent="downloadTemplate">
              Download CSV template
            </a>

            <div class="field">
              <label class="field-label" for="import-file">CSV file</label>
              <input
                id="import-file"
                ref="importFileInput"
                type="file"
                accept=".csv,text/csv"
                class="file-input"
                @change="onImportFileChange"
              />
              <p v-if="importFileError" class="field-error">{{ importFileError }}</p>
            </div>

            <div class="csv-columns">
              <p class="csv-columns-label">Required columns:</p>
              <code class="csv-columns-code">unit_number, unit_type, email, first_name, last_name</code>
              <p class="csv-columns-label" style="margin-top: var(--space-2)">Optional:</p>
              <code class="csv-columns-code">building, floor, resident_type (owner/renter, defaults to owner)</code>
            </div>

            <div class="modal-actions">
              <BaseButton variant="secondary" @click="closeImport">Cancel</BaseButton>
              <BaseButton variant="primary" :disabled="!parsedRows.length" @click="importStep = 'preview'">
                Preview {{ parsedRows.length ? `(${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'})` : '' }}
              </BaseButton>
            </div>
          </template>

          <!-- Step 2: preview -->
          <template v-else-if="importStep === 'preview'">
            <p class="import-desc">
              Review the rows below before importing. Rows with errors will be skipped.
            </p>

            <div class="preview-table-wrap">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Unit</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Resident</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in parsedRows" :key="i" :class="r._error ? 'row--error' : ''">
                    <td>{{ i + 1 }}</td>
                    <td>{{ r.unitNumber }}</td>
                    <td>{{ r.unitType }}</td>
                    <td>{{ r.firstName }} {{ r.lastName }}</td>
                    <td>{{ r.email }}</td>
                    <td>{{ r.residentType ?? 'owner' }}</td>
                    <td>
                      <span v-if="r._error" class="row-error-badge">{{ r._error }}</span>
                      <span v-else class="row-ok-badge">Ready</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="preview-summary">
              {{ validRows.length }} ready · {{ parsedRows.length - validRows.length }} with errors
            </p>

            <div class="modal-actions">
              <BaseButton variant="secondary" :disabled="importing" @click="importStep = 'upload'">Back</BaseButton>
              <BaseButton variant="primary" :disabled="!validRows.length" :loading="importing" @click="runImport">
                Import {{ validRows.length }} row{{ validRows.length === 1 ? '' : 's' }}
              </BaseButton>
            </div>
          </template>

          <!-- Step 3: results -->
          <template v-else-if="importStep === 'results'">
            <div class="import-summary">
              <div class="summary-stat summary-stat--success">
                <span class="stat-num">{{ importResults.created }}</span>
                <span class="stat-label">Created</span>
              </div>
              <div class="summary-stat summary-stat--warn">
                <span class="stat-num">{{ importResults.skipped }}</span>
                <span class="stat-label">Skipped</span>
              </div>
              <div class="summary-stat summary-stat--error">
                <span class="stat-num">{{ importResults.errors }}</span>
                <span class="stat-label">Errors</span>
              </div>
            </div>

            <div class="preview-table-wrap">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Unit</th>
                    <th>Email</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in importResults.results"
                    :key="r.row"
                    :class="`row--${r.status}`"
                  >
                    <td>{{ r.row }}</td>
                    <td>{{ r.unitNumber }}</td>
                    <td>{{ r.email }}</td>
                    <td>
                      <span class="result-badge" :class="`result-badge--${r.status}`">
                        {{ r.status === 'created' ? 'Created' : r.status === 'skipped' ? `Skipped — ${r.reason}` : `Error — ${r.reason}` }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="import-links-note">
              Invite links are generated for all created residents. Share them via
              <NuxtLink to="/admin/units" @click="closeImport">the units page</NuxtLink>.
            </p>

            <div class="modal-actions">
              <BaseButton variant="primary" @click="closeImport">Done</BaseButton>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="deletingUnit" class="modal-backdrop" @click.self="cancelDelete">
        <div class="modal modal--danger" role="alertdialog" aria-labelledby="delete-title">
          <div class="danger-icon" aria-hidden="true">⚠</div>
          <h2 id="delete-title" class="modal-title">Delete this unit?</h2>
          <p class="danger-desc">
            This will permanently remove the unit, all its households, and any
            residents linked to it. This cannot be undone.
          </p>
          <div class="delete-confirm-field">
            <label class="field-label" for="delete-confirm-input">
              Type <strong>{{ unitDisplayName(deletingUnit) }}</strong> to confirm
            </label>
            <input
              id="delete-confirm-input"
              v-model="deleteConfirmText"
              class="field-input"
              type="text"
              :placeholder="unitDisplayName(deletingUnit)"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
          <div class="modal-actions">
            <BaseButton variant="secondary" :disabled="deleting" @click="cancelDelete">Cancel</BaseButton>
            <BaseButton
              variant="danger"
              :loading="deleting"
              :disabled="deleteConfirmText !== unitDisplayName(deletingUnit)"
              @click="confirmDelete"
            >
              Delete permanently
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Invite resident modal -->
    <Teleport to="body">
      <div v-if="invitingUnit" class="modal-backdrop" @click.self="invitingUnit = null">
        <div class="modal" role="dialog" aria-label="Invite resident">
          <h2 class="modal-title">Invite resident — {{ unitDisplayName(invitingUnit) }}</h2>

          <form class="modal-form" @submit.prevent="sendInvite">
            <div class="form-row">
              <BaseInput
                v-model="inviteForm.firstName"
                label="First name"
                placeholder="Jane"
                :error="inviteErrors.firstName"
                :disabled="inviting"
                required
              />
              <BaseInput
                v-model="inviteForm.lastName"
                label="Last name"
                placeholder="Smith"
                :error="inviteErrors.lastName"
                :disabled="inviting"
                required
              />
            </div>
            <BaseInput
              v-model="inviteForm.email"
              label="Email address"
              type="email"
              placeholder="jane@example.com"
              :error="inviteErrors.email"
              :disabled="inviting"
              required
            />
            <div class="field">
              <label class="field-label" for="resident-type">Resident type</label>
              <select id="resident-type" v-model="inviteForm.residentType" class="field-select" :disabled="inviting">
                <option value="owner">Owner</option>
                <option value="renter">Renter</option>
              </select>
            </div>

            <div v-if="inviteResult" class="invite-success">
              <p class="invite-success-msg">✓ Invite created. Share this link with {{ inviteForm.firstName }}:</p>
              <div class="invite-link-row">
                <code class="invite-link">{{ inviteResult }}</code>
                <button type="button" class="copy-btn" @click="copyLink(inviteResult)">Copy</button>
              </div>
            </div>

            <p v-if="inviteError" class="form-error" role="alert">{{ inviteError }}</p>

            <div class="modal-actions">
              <BaseButton variant="secondary" type="button" :disabled="inviting" @click="invitingUnit = null; inviteResult = ''">
                {{ inviteResult ? 'Done' : 'Cancel' }}
              </BaseButton>
              <BaseButton v-if="!inviteResult" variant="primary" type="submit" :loading="inviting">
                Create invite link
              </BaseButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { success: toastSuccess, error: toastError } = useToast()

type UnitRow = Awaited<ReturnType<typeof api.units.list.query>>[number]

type ImportResultRow = { row: number; unitNumber: string; email: string; status: 'created' | 'skipped' | 'error'; inviteToken?: string; reason?: string }
type ParsedRow = { unitNumber: string; unitType: string; building?: string; floor?: number; email: string; firstName: string; lastName: string; residentType: string; _error?: string }

const loading = ref(true)
const units = ref<UnitRow[]>([])
const collapsed = ref(new Set<string>())
const showAddUnit = ref(false)
const showImport = ref(false)
const importStep = ref<'upload' | 'preview' | 'results'>('upload')
const importFileInput = ref<HTMLInputElement | null>(null)
const importFileError = ref('')
const parsedRows = ref<ParsedRow[]>([])
const importing = ref(false)
const importResults = ref<{ results: ImportResultRow[]; created: number; skipped: number; errors: number }>({ results: [], created: 0, skipped: 0, errors: 0 })
const editingUnit = ref<UnitRow | null>(null)
const invitingUnit = ref<UnitRow | null>(null)
const deletingUnit = ref<UnitRow | null>(null)
const saving = ref(false)
const inviting = ref(false)
const deleting = ref(false)
const saveError = ref('')
const inviteError = ref('')
const inviteResult = ref('')
const deleteError = ref('')
const deleteConfirmText = ref('')

const unitForm = reactive({ unitNumber: '', unitType: 'condo' as 'condo' | 'apartment' | 'sfh', building: '', floor: '', notes: '' })
const unitErrors = reactive({ unitNumber: '' })

const inviteForm = reactive({ firstName: '', lastName: '', email: '', residentType: 'owner' as 'owner' | 'renter' })
const inviteErrors = reactive({ firstName: '', lastName: '', email: '' })

onMounted(async () => {
  await loadUnits()
})

async function loadUnits(): Promise<void> {
  loading.value = true
  try {
    units.value = await api.units.list.query()
  } catch {
    toastError('Failed to load units.')
  } finally {
    loading.value = false
  }
}

function activeResidents(u: UnitRow): number {
  return u.households.flatMap(h => h.residents).length
}

function primaryName(u: UnitRow): string | null {
  for (const h of u.households) {
    if (!h.primaryResidentId) continue
    const r = h.residents.find(r => r.id === h.primaryResidentId)
    if (r) return `${r.firstName} ${r.lastName}`
  }
  return null
}

function typeLabel(type: string): string {
  return { condo: 'Condo', apartment: 'Apt', sfh: 'SFH' }[type] ?? type
}

function unitDisplayName(u: { unitNumber: string; unitType: string }): string {
  return u.unitType === 'sfh' ? u.unitNumber : `Unit ${u.unitNumber}`
}

function toggleGroup(label: string): void {
  const next = new Set(collapsed.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  collapsed.value = next
}

type UnitGroup = { label: string; units: UnitRow[] }

const groupedUnits = computed((): UnitGroup[] => {
  const map = new Map<string, UnitRow[]>()

  for (const u of units.value) {
    let key: string
    if (u.unitType === 'sfh') {
      key = 'Single Family Homes'
    } else if (u.building) {
      key = u.building
    } else {
      key = 'Other'
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(u)
  }

  // Sort units within each group by unitNumber naturally
  const collator = new Intl.Collator(undefined, { numeric: true })
  const groups: UnitGroup[] = []
  for (const [label, groupUnits] of map) {
    groups.push({
      label,
      units: [...groupUnits].sort((a, b) => collator.compare(a.unitNumber, b.unitNumber)),
    })
  }

  // Buildings alphabetically, SFH last, Other always last
  return groups.sort((a, b) => {
    if (a.label === 'Other') return 1
    if (b.label === 'Other') return -1
    if (a.label === 'Single Family Homes') return 1
    if (b.label === 'Single Family Homes') return -1
    return a.label.localeCompare(b.label)
  })
})

function openEdit(u: UnitRow): void {
  editingUnit.value = u
  unitForm.unitNumber = u.unitNumber
  unitForm.unitType = u.unitType
  unitForm.building = u.building ?? ''
  unitForm.floor = u.floor?.toString() ?? ''
  unitForm.notes = u.notes ?? ''
}

function openInvite(u: UnitRow): void {
  invitingUnit.value = u
  inviteForm.firstName = ''
  inviteForm.lastName = ''
  inviteForm.email = ''
  inviteForm.residentType = 'owner'
  inviteResult.value = ''
  inviteError.value = ''
}

function closeModal(): void {
  showAddUnit.value = false
  editingUnit.value = null
  unitForm.unitNumber = ''
  unitForm.building = ''
  unitForm.floor = ''
  unitForm.notes = ''
  unitErrors.unitNumber = ''
  saveError.value = ''
}

async function saveUnit(): Promise<void> {
  unitErrors.unitNumber = ''
  saveError.value = ''
  if (!unitForm.unitNumber.trim()) {
    unitErrors.unitNumber = 'Unit number is required.'
    return
  }

  saving.value = true
  try {
    const payload = {
      unitNumber: unitForm.unitNumber.trim(),
      unitType: unitForm.unitType,
      building: unitForm.building.trim() || undefined,
      floor: unitForm.floor ? parseInt(unitForm.floor) : undefined,
      notes: unitForm.notes.trim() || undefined,
    }

    if (editingUnit.value) {
      await api.units.update.mutate({ id: editingUnit.value.id, ...payload })
      toastSuccess('Unit updated.')
    } else {
      await api.units.create.mutate(payload)
      toastSuccess('Unit added.')
    }

    closeModal()
    await loadUnits()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save unit.'
  } finally {
    saving.value = false
  }
}

async function sendInvite(): Promise<void> {
  inviteErrors.firstName = ''
  inviteErrors.lastName = ''
  inviteErrors.email = ''
  inviteError.value = ''

  if (!inviteForm.firstName.trim()) { inviteErrors.firstName = 'Required.'; return }
  if (!inviteForm.lastName.trim()) { inviteErrors.lastName = 'Required.'; return }
  if (!inviteForm.email.trim()) { inviteErrors.email = 'Required.'; return }

  if (!invitingUnit.value) return

  const householdId = invitingUnit.value.households[0]?.id
  if (!householdId) {
    inviteError.value = 'No household found for this unit.'
    return
  }

  inviting.value = true
  try {
    const result = await api.residents.invite.mutate({
      householdId,
      email: inviteForm.email.trim(),
      firstName: inviteForm.firstName.trim(),
      lastName: inviteForm.lastName.trim(),
      residentType: inviteForm.residentType,
    })
    inviteResult.value = `${window.location.origin}/invite?token=${result.token}`
    await loadUnits()
  } catch (err) {
    inviteError.value = err instanceof Error ? err.message : 'Failed to create invite.'
  } finally {
    inviting.value = false
  }
}

const validRows = computed(() =>
  parsedRows.value.filter(r => !r._error)
)

function closeImport(): void {
  showImport.value = false
  importStep.value = 'upload'
  parsedRows.value = []
  importFileError.value = ''
  importResults.value = { results: [], created: 0, skipped: 0, errors: 0 }
  if (importFileInput.value) importFileInput.value.value = ''
}

function downloadTemplate(): void {
  const header = 'unit_number,unit_type,building,floor,email,first_name,last_name,resident_type'
  const examples = [
    '101,condo,Building A,1,jane@example.com,Jane,Smith,owner',
    '202,apartment,,2,john@example.com,John,Doe,renter',
    '469 Maple Drive,sfh,,,sue@example.com,Sue,Jones,owner',
  ]
  const csv = [header, ...examples].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'quorum-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function onImportFileChange(e: Event): void {
  importFileError.value = ''
  parsedRows.value = []
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target?.result as string
    parsedRows.value = parseCsv(text)
  }
  reader.readAsText(file)
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) { importFileError.value = 'CSV must have a header row and at least one data row.'; return [] }

  const headers = lines[0]!.split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))

  const COL: Record<string, string> = {
    unit_number: 'unitNumber', unit_type: 'unitType', building: 'building',
    floor: 'floor', email: 'email', first_name: 'firstName',
    last_name: 'lastName', resident_type: 'residentType',
  }

  const required = ['unit_number', 'unit_type', 'email', 'first_name', 'last_name']
  const missing = required.filter(r => !headers.includes(r))
  if (missing.length) {
    importFileError.value = `Missing required columns: ${missing.join(', ')}`
    return []
  }

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const raw: Record<string, string> = {}
    headers.forEach((h, i) => { raw[COL[h] ?? h] = vals[i] ?? '' })

    const row: ParsedRow = {
      unitNumber: raw.unitNumber ?? '',
      unitType: raw.unitType ?? '',
      building: raw.building || undefined,
      floor: raw.floor ? parseInt(raw.floor) : undefined,
      email: raw.email ?? '',
      firstName: raw.firstName ?? '',
      lastName: raw.lastName ?? '',
      residentType: raw.residentType || 'owner',
    }

    // Inline validation
    if (!row.unitNumber) row._error = 'Missing unit_number'
    else if (!['condo', 'apartment', 'sfh'].includes(row.unitType)) row._error = `Invalid unit_type "${row.unitType}"`
    else if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row._error = 'Invalid email'
    else if (!row.firstName || !row.lastName) row._error = 'Missing first_name or last_name'
    else if (!['owner', 'renter'].includes(row.residentType)) row._error = `Invalid resident_type "${row.residentType}"`

    return row
  })
}

async function runImport(): Promise<void> {
  if (!validRows.value.length) return
  importing.value = true
  try {
    const result = await api.units.bulkImport.mutate({
      rows: validRows.value.map(r => ({
        unitNumber: r.unitNumber,
        unitType: r.unitType as 'condo' | 'apartment' | 'sfh',
        building: r.building,
        floor: r.floor,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        residentType: (r.residentType as 'owner' | 'renter') ?? 'owner',
      })),
    })
    importResults.value = result
    importStep.value = 'results'
    await loadUnits()
  } catch (err) {
    toastError(err instanceof Error ? err.message : 'Import failed.')
  } finally {
    importing.value = false
  }
}

async function copyLink(link: string): Promise<void> {
  await navigator.clipboard.writeText(link)
  toastSuccess('Link copied!')
}

function openDeleteConfirm(u: UnitRow): void {
  deleteError.value = ''
  deleteConfirmText.value = ''
  deletingUnit.value = u
  closeModal()
}

function cancelDelete(): void {
  deletingUnit.value = null
  deleteConfirmText.value = ''
  deleteError.value = ''
}

async function confirmDelete(): Promise<void> {
  if (!deletingUnit.value) return
  if (deleteConfirmText.value !== unitDisplayName(deletingUnit.value)) return
  deleteError.value = ''
  deleting.value = true
  try {
    await api.units.delete.mutate({ id: deletingUnit.value.id })
    toastSuccess(`${unitDisplayName(deletingUnit.value)} deleted.`)
    cancelDelete()
    await loadUnits()
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete unit.'
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.admin-units {
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

.header-actions {
  display: flex;
  gap: var(--space-2);
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

.units-loading {
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

.units-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-4);
  text-align: center;
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.unit-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.unit-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-1);
  border-radius: var(--radius-md);
  min-height: 44px;
  text-align: left;
  transition: background var(--transition-fast);

  &:hover { background: var(--surface-raised); }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
}

.group-chevron {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
  line-height: 1;
  width: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &.group-chevron--open { transform: rotate(90deg); }
}

.group-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-left: var(--space-1);
}

.units-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.unit-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }

  @media (max-width: 40rem) {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}

.unit-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  flex-wrap: wrap;
}

.unit-name-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.unit-number {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: 1.2;
}

.unit-primary-name {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.2;
}

.unit-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.unit-type-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--info-text);
  background: var(--info-bg);
  border-radius: var(--radius-full);
  padding: 2px var(--space-2);
}

.unit-occupants {
  flex-shrink: 0;
}

.occupant-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.unit-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 27, 45, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 200;
}

.modal {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  width: 100%;
  max-width: 480px;
  max-height: 90dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.field-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  min-height: 44px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 0.5px solid var(--border-subtle);
}

.delete-trigger {
  font-size: var(--text-sm);
  color: var(--danger-text);
  margin-right: auto;
  padding: var(--space-2);
  min-height: 44px;
  border-radius: var(--radius-sm);

  &:hover { text-decoration: underline; }

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.modal--danger {
  text-align: center;
  gap: var(--space-4);
}

.danger-icon {
  font-size: 2rem;
  color: var(--danger-text);
}

.danger-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.delete-confirm-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;

  strong {
    font-weight: var(--font-medium);
    color: var(--text-primary);
    font-family: monospace;
  }
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
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

  &::placeholder {
    color: var(--text-tertiary);
  }
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.invite-success {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--success-bg);
  border-radius: var(--radius-md);
}

.invite-success-msg {
  font-size: var(--text-sm);
  color: var(--success-text);
  font-weight: var(--font-medium);
}

.invite-link-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.invite-link {
  font-size: var(--text-xs);
  font-family: monospace;
  color: var(--text-primary);
  background: var(--surface-raised);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  word-break: break-all;
  flex: 1;
}

/* Bulk import */
.modal--wide {
  max-width: 720px;
}

.import-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.template-link {
  font-size: var(--text-sm);
  color: var(--text-link);
  font-weight: var(--font-medium);

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-radius: var(--radius-sm);
  }
}

.csv-columns {
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.csv-columns-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.csv-columns-code {
  font-size: var(--text-xs);
  font-family: monospace;
  color: var(--text-primary);
}

.preview-table-wrap {
  max-height: 320px;
  overflow-y: auto;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);

  th {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    background: var(--surface-raised);
    border-bottom: 0.5px solid var(--border-subtle);
    position: sticky;
    top: 0;
  }

  td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 0.5px solid var(--border-subtle);
    color: var(--text-primary);
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }

  .row--error td { background: var(--danger-bg); }
  .row--skipped td { background: var(--warning-bg, var(--surface-raised)); }
}

.row-error-badge {
  color: var(--danger-text);
  font-weight: var(--font-medium);
}

.row-ok-badge {
  color: var(--success-text);
}

.result-badge {
  font-weight: var(--font-medium);

  &.result-badge--created { color: var(--success-text); }
  &.result-badge--skipped { color: var(--text-secondary); }
  &.result-badge--error { color: var(--danger-text); }
}

.preview-summary {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: right;
}

.import-summary {
  display: flex;
  gap: var(--space-4);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-md);

  &.summary-stat--success { background: var(--success-bg); }
  &.summary-stat--warn { background: var(--surface-raised); }
  &.summary-stat--error { background: var(--danger-bg); }
}

.stat-num {
  font-size: var(--text-2xl);
  font-weight: var(--font-medium);
  line-height: 1;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.import-links-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);

  a {
    color: var(--text-link);
  }
}

.copy-btn {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-link);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-height: 44px;
  min-width: 44px;
  flex-shrink: 0;

  &:focus-visible {
    box-shadow: var(--shadow-focus);
    outline: none;
  }
}
</style>
