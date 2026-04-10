<template>
  <div ref="root" class="dtp">
    <!-- Trigger -->
    <button ref="triggerEl" type="button" class="dtp-trigger" :class="{ 'dtp-trigger--open': open }" @click="toggleOpen">
      <span class="dtp-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M1 7h14" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 1v4M11 1v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      <span>{{ displayValue }}</span>
    </button>

    <!-- Popover teleported to body so modal overflow doesn't clip it -->
    <Teleport to="body">
    <div v-if="open" class="dtp-popover" :style="popoverStyle" role="dialog" aria-label="Date and time picker">
      <!-- Calendar header -->
      <div class="cal-header">
        <button type="button" class="cal-nav" aria-label="Previous month" @click="prevMonth">‹</button>
        <span class="cal-month-label">{{ monthYearLabel }}</span>
        <button type="button" class="cal-nav" aria-label="Next month" @click="nextMonth">›</button>
      </div>

      <!-- Day-of-week labels -->
      <div class="cal-grid">
        <span v-for="d in DAY_LABELS" :key="d" class="cal-dow">{{ d }}</span>

        <!-- Leading blanks -->
        <span v-for="n in leadingBlanks" :key="`b${n}`" class="cal-blank" />

        <!-- Days -->
        <button
          v-for="day in daysInMonth"
          :key="day"
          type="button"
          class="cal-day"
          :class="{
            'cal-day--today': isToday(day),
            'cal-day--selected': isSelected(day),
          }"
          @click="selectDay(day)"
        >
          {{ day }}
        </button>
      </div>

      <!-- Time row -->
      <div class="dtp-time">
        <select v-model="hour" class="time-select" aria-label="Hour">
          <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
        </select>
        <span class="time-sep">:</span>
        <select v-model="minute" class="time-select" aria-label="Minute">
          <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
        </select>
        <select v-model="ampm" class="time-select" aria-label="AM/PM">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>

      <div class="dtp-footer">
        <button type="button" class="dtp-done" @click="open = false">Done</button>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const HOURS = ['1','2','3','4','5','6','7','8','9','10','11','12']
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55']

// ── State ──────────────────────────────────────────────────────────────────
const open = ref(false)
const root = ref<HTMLElement | null>(null)

// Calendar navigation month (independent of selection)
const navDate = ref(new Date())

// Selected date parts
const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)
const selectedDay = ref<number | null>(null)
const hour = ref('6')
const minute = ref('00')
const ampm = ref<'AM' | 'PM'>('PM')

// ── Init from modelValue ───────────────────────────────────────────────────
function parseValue(v: string): void {
  if (!v) return
  const d = new Date(v)
  if (isNaN(d.getTime())) return
  selectedYear.value = d.getFullYear()
  selectedMonth.value = d.getMonth()
  selectedDay.value = d.getDate()
  navDate.value = new Date(d.getFullYear(), d.getMonth(), 1)
  let h = d.getHours()
  ampm.value = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  hour.value = String(h)
  const m = d.getMinutes()
  minute.value = String(Math.round(m / 5) * 5).padStart(2, '0')
  if (minute.value === '60') minute.value = '55'
}

watch(() => props.modelValue, parseValue, { immediate: true })

// ── Emit combined value ────────────────────────────────────────────────────
function emitValue(): void {
  if (selectedYear.value === null || selectedMonth.value === null || selectedDay.value === null) return
  let h = parseInt(hour.value)
  if (ampm.value === 'PM' && h !== 12) h += 12
  if (ampm.value === 'AM' && h === 12) h = 0
  const d = new Date(selectedYear.value, selectedMonth.value, selectedDay.value, h, parseInt(minute.value))
  emit('update:modelValue', d.toISOString())
}

watch([selectedYear, selectedMonth, selectedDay, hour, minute, ampm], emitValue)

// ── Calendar ───────────────────────────────────────────────────────────────
const monthYearLabel = computed(() =>
  navDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const leadingBlanks = computed(() =>
  new Date(navDate.value.getFullYear(), navDate.value.getMonth(), 1).getDay()
)

const daysInMonth = computed(() =>
  new Date(navDate.value.getFullYear(), navDate.value.getMonth() + 1, 0).getDate()
)

function prevMonth(): void {
  navDate.value = new Date(navDate.value.getFullYear(), navDate.value.getMonth() - 1, 1)
}

function nextMonth(): void {
  navDate.value = new Date(navDate.value.getFullYear(), navDate.value.getMonth() + 1, 1)
}

function selectDay(day: number): void {
  selectedYear.value = navDate.value.getFullYear()
  selectedMonth.value = navDate.value.getMonth()
  selectedDay.value = day
}

function isToday(day: number): boolean {
  const t = new Date()
  return (
    navDate.value.getFullYear() === t.getFullYear() &&
    navDate.value.getMonth() === t.getMonth() &&
    day === t.getDate()
  )
}

function isSelected(day: number): boolean {
  return (
    selectedYear.value === navDate.value.getFullYear() &&
    selectedMonth.value === navDate.value.getMonth() &&
    selectedDay.value === day
  )
}

// ── Display label ──────────────────────────────────────────────────────────
const displayValue = computed(() => {
  if (selectedYear.value === null) return 'Select date & time'
  const d = new Date(selectedYear.value, selectedMonth.value!, selectedDay.value!)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${dateStr} at ${hour.value}:${minute.value} ${ampm.value}`
})

// ── Popover position (fixed, relative to trigger) ─────────────────────────
const triggerEl = ref<HTMLButtonElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

function updatePosition(): void {
  const el = triggerEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const popoverWidth = 280
  const spaceRight = window.innerWidth - rect.left
  const left = spaceRight >= popoverWidth ? rect.left : Math.max(8, rect.right - popoverWidth)
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${left}px`,
    zIndex: '9999',
  }
}

// ── Toggle & click-outside ─────────────────────────────────────────────────
function toggleOpen(): void {
  if (!open.value) updatePosition()
  open.value = !open.value
}

function onClickOutside(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onScroll(): void {
  if (open.value) updatePosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<style scoped>
.dtp {
  position: relative;
  display: inline-block;
  width: 100%;
}

.dtp-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-height: 36px;

  &:hover { border-color: var(--border-strong); }

  &:focus-visible,
  &.dtp-trigger--open {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--shadow-focus);
  }
}

.dtp-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
  display: flex;
}

/* ── Popover (teleported to body, positioned via inline style) ────── */
.dtp-popover {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  width: 280px;
  box-shadow: 0 4px 24px rgba(0 0 0 / 0.12);
}

/* ── Calendar header ──────────────────────────────────────────────── */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.cal-month-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.cal-nav {
  background: none;
  border: none;
  font-size: var(--text-lg);
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  line-height: 1;

  &:hover { background: var(--surface-raised); color: var(--text-primary); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}

/* ── Calendar grid ────────────────────────────────────────────────── */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: var(--space-4);
}

.cal-dow {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-1) 0;
}

.cal-blank {
  /* empty cell */
}

.cal-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  min-height: 30px;

  &:hover { background: var(--surface-raised); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  &.cal-day--today {
    color: var(--blue-400);
    font-weight: 500;
  }

  &.cal-day--selected {
    background: var(--blue-400);
    color: #fff;
    font-weight: 500;

    &:hover { background: var(--blue-600); }
  }
}

/* ── Time row ─────────────────────────────────────────────────────── */
.dtp-time {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-3);
}

.time-select {
  flex: 1;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card);
  cursor: pointer;

  &:focus {
    outline: none;
    box-shadow: var(--shadow-focus);
    border-color: var(--border-focus);
  }
}

.time-sep {
  font-weight: 500;
  color: var(--text-tertiary);
}

/* ── Footer ───────────────────────────────────────────────────────── */
.dtp-footer {
  display: flex;
  justify-content: flex-end;
}

.dtp-done {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--blue-600);
  background: var(--blue-50);
  border: 1px solid var(--blue-100);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-4);
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: var(--blue-100); }
  &:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
}
</style>
