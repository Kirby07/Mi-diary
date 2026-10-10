<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import PaperView from '@/components/PaperView.vue'
import { fmtDate } from '@/utils/dates.js'
import { applyTheme } from '@/utils/theme.js'
import * as api from '@/services/api.js'

// Modo visitante: alguien SIN cuenta abre /v#<token> y puede leer el
// diario del dueño. Todo es solo lectura — este componente no importa
// nada que escriba (EntryEditor, subida de imágenes, etc.).

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const status  = ref('loading')        // 'loading' | 'ready' | 'error'
const errMsg  = ref('')
const name    = ref('Mi Diario')
const entries = ref({})               // { 'YYYY-MM-DD': entry }
const sel     = ref(null)
const paperRef = ref(null)

const today = new Date()
const year  = ref(today.getFullYear())
const month = ref(today.getMonth())   // 0-11

function hasEntry(key) {
  const e = entries.value[key]
  return !!(e?.content || e?.images?.length)
}

// Celdas del mes, empezando en lunes (igual que WeekGrid). Los huecos
// antes del día 1 son null.
const cells = computed(() => {
  const first   = new Date(year.value, month.value, 1)
  const lead    = (first.getDay() + 6) % 7          // domingo=0 → 6
  const days    = new Date(year.value, month.value + 1, 0).getDate()
  const todayKey = fmtDate(today)
  const out = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) {
    const key = fmtDate(new Date(year.value, month.value, d))
    out.push({ key, num: d, isToday: key === todayKey, entry: hasEntry(key) ? entries.value[key] : null })
  }
  return out
})

function moveMonth(delta) {
  const d = new Date(year.value, month.value + delta, 1)
  year.value = d.getFullYear()
  month.value = d.getMonth()
}

function pick(cell) {
  if (!cell?.entry) return
  sel.value = cell.key
  nextTick(() => paperRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

onMounted(async () => {
  // Que los buscadores no indexen la página aunque el link se publique.
  const robots = document.createElement('meta')
  robots.name = 'robots'; robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)

  // Cambiar solo el "#" no recarga la página: si pegan otro link en la
  // misma pestaña, recargamos para leer el token nuevo.
  window.addEventListener('hashchange', () => location.reload())

  const token = location.hash.slice(1)
  try {
    if (!token) throw new api.ApiError('Este link está incompleto', 404)
    const data = await api.fetchSharedDiary(token)
    const s = data.settings || {}
    applyTheme({ theme: s.theme || 'dark', font: s.font || 'serif', fontSize: s.fontSize || 'md', accent: s.accent || '#9B8EC4' })
    name.value = s.name || 'Mi Diario'
    document.title = name.value
    const map = {}
    for (const e of data.entries) map[e.date] = e
    entries.value = map
    status.value = 'ready'
  } catch (err) {
    applyTheme({ theme: 'dark', font: 'serif', fontSize: 'md', accent: '#9B8EC4' })
    errMsg.value = err.status === 404
      ? 'Este link no existe o fue revocado por su dueño.'
      : 'No se pudo cargar el diario. Intenta de nuevo en un momento.'
    status.value = 'error'
  }
})
</script>

<template>
  <div class="shared">
    <header class="sh-bar">
      <div class="sh-logo"><span class="sh-dot" />{{ name }}</div>
      <span class="sh-badge">Solo lectura</span>
    </header>

    <main class="sh-main">
      <p v-if="status === 'loading'" class="sh-msg">Cargando diario…</p>

      <div v-else-if="status === 'error'" class="sh-msg">
        <span class="sh-glyph">✦</span>
        <p>{{ errMsg }}</p>
      </div>

      <template v-else>
        <div class="sh-nav">
          <button class="sh-arrow" @click="moveMonth(-1)" aria-label="Mes anterior">←</button>
          <span class="sh-month">{{ MONTHS[month] }} {{ year }}</span>
          <button class="sh-arrow" @click="moveMonth(1)" aria-label="Mes siguiente">→</button>
        </div>

        <div class="sh-grid">
          <span v-for="w in WEEKDAYS" :key="w" class="sh-wd">{{ w }}</span>
          <template v-for="(c, i) in cells" :key="c?.key || 'pad' + i">
            <span v-if="!c" class="sh-cell sh-cell--pad" />
            <button
              v-else
              :disabled="!c.entry"
              @click="pick(c)"
              :class="['sh-cell', c.entry ? 'has' : '', c.isToday ? 'today' : '', sel === c.key ? 'selected' : '']"
            >
              <span class="sh-num">{{ c.num }}</span>
              <span v-if="c.entry?.mood" class="sh-mood">{{ c.entry.mood }}</span>
              <span v-if="c.entry" :class="['sh-title', c.entry.title ? '' : 'sh-title--empty']">
                {{ c.entry.title || 'Sin título' }}
              </span>
            </button>
          </template>
        </div>

        <div ref="paperRef" class="sh-paper">
          <PaperView v-if="sel" :key="sel" :date="sel" :entry="entries[sel]" readonly />
          <p v-else class="sh-hint">Elige un día marcado para leer lo que se escribió.</p>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.shared { min-height:100vh; background:var(--bg); color:var(--tx); }

.sh-bar {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px; border-bottom:1px solid var(--bd); background:var(--sf);
}
.sh-logo  { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; }
.sh-dot   { width:8px; height:8px; border-radius:50%; background:var(--a); }
.sh-badge {
  font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.1em;
  color:var(--a); background:var(--ad); padding:3px 8px; border-radius:4px;
}

.sh-main { max-width:760px; margin:0 auto; padding:18px 16px 40px; }
.sh-msg  { text-align:center; color:var(--tm); padding:60px 0; font-size:13px; }
.sh-glyph { display:block; font-size:26px; color:var(--a); margin-bottom:10px; }

.sh-nav   { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.sh-month { font-family:var(--fb); font-size:var(--fsl); font-weight:600; }
.sh-arrow {
  width:34px; height:34px; border-radius:var(--rs); border:1px solid var(--bd);
  background:var(--sf); color:var(--tm); cursor:pointer; font-size:14px;
}
.sh-arrow:hover { background:var(--sf2); color:var(--tx); }

.sh-grid { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:4px; }
.sh-wd   { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--tf); text-align:center; padding-bottom:4px; }

.sh-cell {
  min-height:78px; padding:6px; border-radius:var(--rs);
  border:1px solid var(--bd); background:var(--sf);
  display:flex; flex-direction:column; align-items:flex-start; gap:2px;
  text-align:left; color:var(--tf); font:inherit; overflow:hidden;
}
.sh-cell--pad { border-color:transparent; background:none; }
.sh-cell.has  { cursor:pointer; color:var(--tx); }
.sh-cell.has:hover { border-color:var(--a); }
.sh-cell.today    { box-shadow:inset 0 0 0 1px var(--a); }
.sh-cell.selected { background:var(--ad); border-color:var(--a); }
.sh-cell:disabled { cursor:default; }

.sh-num   { font-size:11px; font-weight:600; }
.sh-mood  { font-size:15px; line-height:1; }
.sh-title {
  font-size:11px; line-height:1.3; word-break:break-word;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
}
.sh-title--empty { font-style:italic; color:var(--tm); }

.sh-paper { margin-top:20px; scroll-margin-top:16px; }
.sh-hint  { text-align:center; color:var(--tm); font-size:12px; font-style:italic; }

@media (max-width: 520px) {
  .sh-cell  { min-height:64px; padding:4px; }
  .sh-mood  { font-size:13px; }
  .sh-title { font-size:9.5px; -webkit-line-clamp:2; }
}
</style>
