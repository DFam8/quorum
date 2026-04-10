<template>
  <div class="documents-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Documents</h1>
        <p class="page-subtitle">Community governing documents, financials, and meeting minutes</p>
      </div>
      <BaseButton v-if="isBoard" variant="primary" @click="openUpload">Upload document</BaseButton>
    </div>

    <div v-if="loading" class="docs-loading">
      <div class="spinner" aria-label="Loading" />
    </div>

    <div v-else-if="!documents.length" class="docs-empty">
      <p class="empty-title">No documents yet</p>
      <p v-if="isBoard" class="empty-desc">Upload the community's governing documents to get started.</p>
      <p v-else class="empty-desc">Your board hasn't uploaded any documents yet.</p>
      <BaseButton v-if="isBoard" variant="primary" @click="openUpload">Upload first document</BaseButton>
    </div>

    <div v-else class="categories">
      <section v-for="cat in populatedCategories" :key="cat.key" class="category-section">
        <h2 class="category-title">{{ cat.label }}</h2>
        <ul class="doc-list">
          <li v-for="doc in cat.docs" :key="doc.id" class="doc-item">
            <div class="doc-row">
              <div class="doc-icon" :data-ext="fileExt(doc.fileUrl)" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M12 2v4h4" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </div>

              <div class="doc-info">
                <div class="doc-name-row">
                  <span class="doc-name">{{ doc.name }}</span>
                  <span v-if="doc.version > 1" class="doc-version-badge">v{{ doc.version }}</span>
                  <span v-if="isNew(doc.createdAt)" class="doc-new-badge">New</span>
                </div>
                <div class="doc-meta-row">
                  <span class="doc-meta">{{ formatDate(doc.createdAt) }}</span>
                  <span v-if="doc.uploadedByResident" class="doc-meta">·
                    {{ doc.uploadedByResident.firstName }} {{ doc.uploadedByResident.lastName }}
                  </span>
                  <span v-if="doc.fileSizeBytes" class="doc-meta">· {{ formatSize(doc.fileSizeBytes) }}</span>
                  <span v-if="doc.changeNote" class="doc-change-note">{{ doc.changeNote }}</span>
                </div>
              </div>

              <div class="doc-actions">
                <a
                  :href="doc.fileUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="doc-btn doc-btn--link"
                >
                  Download
                </a>

                <template v-if="isBoard">
                  <button
                    type="button"
                    class="doc-btn"
                    @click="openNewVersion(doc)"
                  >
                    New version
                  </button>
                  <button
                    type="button"
                    class="doc-btn doc-btn--history"
                    :class="{ 'doc-btn--active': expandedDocId === doc.id }"
                    :aria-label="expandedDocId === doc.id ? 'Hide history' : 'Show history'"
                    @click="toggleHistory(doc.id)"
                  >
                    History
                  </button>
                  <button
                    type="button"
                    class="doc-btn doc-btn--danger"
                    :aria-label="`Delete ${doc.name}`"
                    @click="openDelete(doc)"
                  >
                    Delete
                  </button>
                </template>
              </div>
            </div>

            <!-- Version history drawer -->
            <div v-if="expandedDocId === doc.id" class="version-history">
              <div v-if="versionsLoading" class="version-loading">
                <div class="spinner spinner--sm" aria-label="Loading" />
              </div>
              <div v-else-if="!versionsList.length" class="version-empty">
                No previous versions.
              </div>
              <ul v-else class="version-list">
                <li v-for="v in versionsList" :key="v.id" class="version-row">
                  <span class="version-num">v{{ v.version }}</span>
                  <span class="version-meta">
                    {{ formatDate(v.createdAt) }}
                    <template v-if="v.uploadedByResident"> · {{ v.uploadedByResident.firstName }} {{ v.uploadedByResident.lastName }}</template>
                  </span>
                  <span v-if="v.changeNote" class="version-note">{{ v.changeNote }}</span>
                  <a :href="v.fileUrl" target="_blank" rel="noopener noreferrer" class="version-download">Download</a>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Upload / New version modal -->
    <BaseModal
      :open="showUpload || !!newVersionFor"
      :title="newVersionFor ? `New version — ${newVersionFor.name}` : 'Upload document'"
      @close="closeUpload"
    >
      <form class="modal-form" @submit.prevent="submitUpload">
        <div class="modal-body">
          <BaseInput
            v-model="uploadForm.name"
            label="Document name"
            placeholder="Community Bylaws 2026"
            :error="uploadErrors.name"
            :disabled="uploading || !!newVersionFor"
            required
          />

          <div v-if="!newVersionFor" class="field">
            <label class="field-label" for="doc-category">Category</label>
            <select id="doc-category" v-model="uploadForm.category" class="field-select" :disabled="uploading">
              <option v-for="cat in CATEGORIES" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="doc-file">File</label>
            <input
              id="doc-file"
              ref="fileInput"
              type="file"
              class="file-input"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
              :disabled="uploading"
              @change="onFileChange"
            />
            <p v-if="uploadErrors.file" class="field-error">{{ uploadErrors.file }}</p>
          </div>

          <BaseInput
            v-model="uploadForm.changeNote"
            label="Change note"
            :placeholder="newVersionFor ? 'What changed in this version?' : 'Optional note'"
            :disabled="uploading"
          />

          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
            <div class="progress-bar" :style="{ width: `${uploadProgress}%` }" />
            <span class="progress-label">Uploading… {{ uploadProgress }}%</span>
          </div>

          <p v-if="uploadError" class="form-error" role="alert">{{ uploadError }}</p>
        </div>

        <div class="modal-footer">
          <BaseButton variant="secondary" type="button" :disabled="uploading" @click="closeUpload">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="uploading">Upload</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Delete confirm modal -->
    <BaseModal
      :open="!!deleteTarget"
      title="Delete document"
      size="sm"
      @close="deleteTarget = null"
    >
      <div class="modal-body">
        <p class="confirm-text">
          Delete <strong>{{ deleteTarget?.name }}</strong>? This will also remove all version history and cannot be undone.
        </p>
      </div>
      <div class="modal-footer">
        <BaseButton variant="secondary" type="button" @click="deleteTarget = null">Cancel</BaseButton>
        <BaseButton variant="danger" type="button" :loading="deleting" @click="confirmDelete">Delete</BaseButton>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { isBoardMember } from '../../../utils/permissions'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const { user } = useAuth()
const supabase = useSupabaseClient()
const { success: toastSuccess, error: toastError } = useToast()

type DocRow = Awaited<ReturnType<typeof api.documents.list.query>>[number]
type VersionRow = Awaited<ReturnType<typeof api.documents.getVersions.query>>[number]

const STORAGE_BUCKET = 'documents'

const CATEGORIES = [
  { key: 'governing', label: 'Governing Documents' },
  { key: 'budget', label: 'Budget & Financials' },
  { key: 'minutes', label: 'Meeting Minutes' },
  { key: 'other', label: 'Other' },
] as const

const loading = ref(true)
const documents = ref<DocRow[]>([])
const showUpload = ref(false)
const newVersionFor = ref<DocRow | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const deleteTarget = ref<DocRow | null>(null)
const deleting = ref(false)
const expandedDocId = ref<string | null>(null)
const versionsList = ref<VersionRow[]>([])
const versionsLoading = ref(false)

const uploadForm = reactive({ name: '', category: 'governing' as string, changeNote: '' })
const uploadErrors = reactive({ name: '', file: '' })

const isBoard = computed(() => !!user.value && isBoardMember(user.value))

const populatedCategories = computed(() =>
  CATEGORIES.map(cat => ({
    ...cat,
    docs: documents.value.filter(d => d.category === cat.key),
  })).filter(c => c.docs.length > 0)
)

onMounted(loadDocs)

async function loadDocs(): Promise<void> {
  loading.value = true
  try {
    documents.value = await api.documents.list.query()
  } catch {
    toastError('Failed to load documents.')
  } finally {
    loading.value = false
  }
}

function openUpload(): void {
  showUpload.value = true
  uploadForm.name = ''
  uploadForm.category = 'governing'
  uploadForm.changeNote = ''
  uploadErrors.name = ''
  uploadErrors.file = ''
  uploadError.value = ''
}

function openNewVersion(doc: DocRow): void {
  newVersionFor.value = doc
  uploadForm.name = doc.name
  uploadForm.changeNote = ''
  uploadErrors.name = ''
  uploadErrors.file = ''
  uploadError.value = ''
}

function closeUpload(): void {
  showUpload.value = false
  newVersionFor.value = null
  uploadForm.name = ''
  uploadForm.changeNote = ''
  uploadErrors.name = ''
  uploadErrors.file = ''
  uploadError.value = ''
  selectedFile.value = null
  uploadProgress.value = 0
  if (fileInput.value) fileInput.value.value = ''
}

function openDelete(doc: DocRow): void {
  deleteTarget.value = doc
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.documents.delete.mutate({ id: deleteTarget.value.id })
    toastSuccess('Document deleted.')
    deleteTarget.value = null
    if (expandedDocId.value === deleteTarget.value?.id) expandedDocId.value = null
    await loadDocs()
  } catch {
    toastError('Failed to delete document.')
  } finally {
    deleting.value = false
  }
}

async function toggleHistory(docId: string): Promise<void> {
  if (expandedDocId.value === docId) {
    expandedDocId.value = null
    return
  }
  expandedDocId.value = docId
  versionsList.value = []
  versionsLoading.value = true
  try {
    versionsList.value = await api.documents.getVersions.query({ documentId: docId })
  } catch {
    toastError('Failed to load version history.')
    expandedDocId.value = null
  } finally {
    versionsLoading.value = false
  }
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
  uploadErrors.file = ''
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(url: string): string {
  return url.split('.').pop()?.toLowerCase().split('?')[0] ?? 'file'
}

function isNew(d: Date | string): boolean {
  return Date.now() - new Date(d).getTime() < 30 * 24 * 60 * 60 * 1000
}

async function submitUpload(): Promise<void> {
  uploadErrors.name = ''
  uploadErrors.file = ''
  uploadError.value = ''

  if (!uploadForm.name.trim()) { uploadErrors.name = 'Required.'; return }
  if (!selectedFile.value) { uploadErrors.file = 'Please select a file.'; return }

  uploading.value = true
  uploadProgress.value = 10
  try {
    const file = selectedFile.value
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${crypto.randomUUID()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false })

    if (storageError) throw new Error(storageError.message)
    uploadProgress.value = 70

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    uploadProgress.value = 85

    await api.documents.create.mutate({
      name: uploadForm.name.trim(),
      category: newVersionFor.value ? newVersionFor.value.category : uploadForm.category as 'governing' | 'budget' | 'minutes' | 'other',
      fileUrl: urlData.publicUrl,
      fileSizeBytes: file.size,
      changeNote: uploadForm.changeNote.trim() || undefined,
      parentId: newVersionFor.value?.id,
    })

    uploadProgress.value = 100
    toastSuccess(newVersionFor.value ? 'New version uploaded.' : 'Document uploaded.')

    // Refresh version history if this doc was expanded
    if (newVersionFor.value && expandedDocId.value === newVersionFor.value.id) {
      versionsList.value = await api.documents.getVersions.query({ documentId: newVersionFor.value.id })
    }

    closeUpload()
    await loadDocs()
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Upload failed.'
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.documents-page {
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

.docs-loading {
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

  &.spinner--sm {
    width: 18px;
    height: 18px;
    border-width: 2px;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }

.docs-empty {
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

/* ── Categories ─────────────────────────────────────────────────── */
.categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.category-title {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.doc-list {
  background: var(--surface-card);
  border: 0.5px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Document row ───────────────────────────────────────────────── */
.doc-item {
  border-bottom: 0.5px solid var(--border-subtle);

  &:last-child { border-bottom: none; }
}

.doc-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.doc-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
  display: flex;

  /* Tint by file type */
  &[data-ext="pdf"] { color: var(--danger-text); }
  &[data-ext="xls"],
  &[data-ext="xlsx"] { color: var(--success-text); }
  &[data-ext="doc"],
  &[data-ext="docx"] { color: var(--blue-400); }
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.doc-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.doc-version-badge {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--surface-raised);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
}

.doc-new-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--success-text);
  background: var(--success-bg);
  border-radius: var(--radius-full);
  padding: 1px var(--space-2);
}

.doc-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}

.doc-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.doc-change-note {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-style: italic;
}

/* ── Doc action buttons ─────────────────────────────────────────── */
.doc-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.doc-btn {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  min-height: 32px;
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
  white-space: nowrap;
  text-decoration: none;
  display: flex;
  align-items: center;

  &:hover { color: var(--text-primary); background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.doc-btn--link {
    color: var(--text-link);
    &:hover { text-decoration: none; }
  }

  &.doc-btn--history.doc-btn--active {
    color: var(--blue-600);
    background: var(--blue-50);
  }

  &.doc-btn--danger:hover {
    color: var(--danger-text);
    background: var(--danger-bg);
  }
}

/* ── Version history drawer ─────────────────────────────────────── */
.version-history {
  background: var(--surface-raised);
  border-top: 0.5px solid var(--border-subtle);
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 16px + var(--space-3));
}

.version-loading {
  display: flex;
  align-items: center;
  padding: var(--space-2) 0;
}

.version-empty {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: var(--space-1) 0;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.version-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.version-num {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  min-width: 24px;
}

.version-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex: 1;
}

.version-note {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-style: italic;
}

.version-download {
  font-size: var(--text-xs);
  color: var(--text-link);
  text-decoration: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);

  &:hover { text-decoration: underline; }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Modal shared ───────────────────────────────────────────────── */
.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 0.5px solid var(--border-subtle);
}

.confirm-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;

  strong { font-weight: var(--font-medium); color: var(--text-primary); }
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
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  min-height: 44px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.file-input {
  font-size: var(--text-sm);
  color: var(--text-primary);
  padding: var(--space-2) 0;
  cursor: pointer;

  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-radius: var(--radius-sm);
  }
}

.field-error {
  font-size: var(--text-xs);
  color: var(--danger-text);
}

.upload-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.progress-bar {
  height: 4px;
  background: var(--blue-400);
  border-radius: var(--radius-full);
  transition: width 0.2s ease;
}

.progress-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.form-error {
  font-size: var(--text-sm);
  color: var(--danger-text);
  background: var(--danger-bg);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
</style>
