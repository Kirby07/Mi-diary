<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import LockScreen   from '@/components/LockScreen.vue'
import AuthScreen   from '@/components/AuthScreen.vue'
import WeekGrid     from '@/components/WeekGrid.vue'
import PaperView    from '@/components/PaperView.vue'
import EntryEditor  from '@/components/EntryEditor.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { sha256 }              from '@/utils/crypto.js'
import { fmtDate, getWeekDays, buildWeekLabel } from '@/utils/dates.js'
import * as api from '@/services/api.js'

// Nota: ya no importamos sanitize.js aquí. La sanitización del CONTENIDO
// del diario ahora ocurre en el servidor (backend/src/utils/sanitize.js),
// porque es ahí donde realmente importa — el servidor es quien decide
// qué se guarda en la base de datos, sin importar qué le mande el cliente.
// sha256() y dates.js se quedan: siguen siendo útiles para el PIN local
// y el cálculo de semanas, que no dependen del servidor.

// ── Vista activa ────────────────────────────────────────────
const view   = ref('diary')           // 'diary' | 'settings'
const wkOff  = ref(0)                 // offset de semana (0 = actual)
const sel    = ref(null)              // clave de día seleccionado ('YYYY-MM-DD')
const mode   = ref(null)              // null | 'view' | 'edit'

// ── Datos ───────────────────────────────────────────────────
const entries = ref({})               // { 'YYYY-MM-DD': { title, content, mood, ... } }
const draft   = ref({ title: '', content: '', mood: null })
const st      = ref('')               // mensaje de estado (auto-save, etc.)

// ── Configuración ───────────────────────────────────────────
const cfg = ref({
  name:      'Mi Diario',
  theme:     'dark',
  accent:    '#9B8EC4',
  font:      'serif',
  fontSize:  'md',
  hasPIN:    false,
  hashedPIN: '',
  pinSalt:   '',
  autoLock:  0
})

// ── Seguridad ────────────────────────────────────────────────
const locked = ref(false)
let ltimer   = null                   // timer de bloqueo automático
let stimer   = null                   // timer de auto-guardado

// ── Sesión (cuenta real, distinta del PIN local) ──────────────
// 'user' es null mientras no hay sesión iniciada — eso es lo que
// decide si mostramos <AuthScreen> o la app real (ver template).
const user        = ref(null)
const loadingData = ref(false)        // true mientras se traen las entradas del servidor

// ── Computed ─────────────────────────────────────────────────
const wkDays  = computed(() => getWeekDays(wkOff.value))
const wkLabel = computed(() => buildWeekLabel(wkDays.value))
const wrdCnt  = computed(() => { const t = draft.value.content.trim(); return t ? t.split(/\s+/).length : 0 })

// ── Watcher: aplica clases CSS cuando cambia la config ──────
watch(cfg, applyAll, { deep: true })

// ── Días y entradas ──────────────────────────────────────────
// Un día "tiene entrada" si tiene texto O al menos una foto — importante
// para el punto indicador en WeekGrid: sin esto, un día con fotos pero
// sin una sola palabra escrita se vería como un día vacío en la cuadrícula.
function hasEntry(key) {
  const e = entries.value[key]
  return !!(e?.content || e?.images?.length)
}

async function pickDay(key) {
  // Auto-guardar borrador actual antes de cambiar de día
  if (sel.value && mode.value === 'edit' && draft.value.content.trim()) {
    await persistEntry()
  }
  sel.value = key
  const e = entries.value[key]
  draft.value = { title: e?.title ?? '', content: e?.content ?? '', mood: e?.mood ?? null }
  mode.value  = hasEntry(key) ? 'view' : 'edit'
  resetActivity()
}

async function saveEntry() {
  if (!sel.value)                     return
  if (!draft.value.content.trim()) { showSt('Escribe algo primero'); return }
  await persistEntry()
  mode.value = 'view'
}

async function persistEntry() {
  const key = sel.value
  // Antes: construíamos el objeto completo (con sanitize, createdAt, etc.)
  // aquí mismo y lo guardábamos directo en localStorage.
  // Ahora: solo mandamos los datos "crudos" — el SERVIDOR es quien
  // sanitiza, valida y decide los timestamps (ver entries.controller.js).
  // Esto es más seguro: si confiáramos en createdAt que pone el cliente,
  // alguien podría falsificar fechas de creación.
  const data = {
    title:   draft.value.title,
    content: draft.value.content,
    mood:    draft.value.mood
  }

  try {
    // saveEntry() hace un PUT a /entries/:date — el backend responde
    // con la entrada ya guardada (incluyendo title/content ya sanitizados
    // y timestamps reales de la base de datos). Usamos ESA respuesta,
    // no nuestro objeto local, para que el estado en pantalla siempre
    // refleje exactamente lo que quedó persistido en Postgres.
    const saved = await api.saveEntry(key, data)
    entries.value[key] = saved
  } catch (err) {
    // Si el servidor rechaza la petición (token expirado, red caída, etc.)
    // avisamos al usuario en vez de fingir que se guardó.
    showSt(err.message || 'No se pudo guardar')
    throw err   // re-lanzamos para que pickDay() sepa que falló si encadena lógica
  }
}

async function deleteEntry() {
  if (!sel.value || !confirm('¿Borrar esta entrada?')) return
  const key = sel.value
  try {
    await api.removeEntry(key)
    delete entries.value[key]
    draft.value = { title: '', content: '', mood: null }
    mode.value  = 'edit'
    showSt('Entrada borrada')
  } catch (err) {
    showSt(err.message || 'No se pudo borrar')
  }
}

// Auto-guardado al escribir (2.5 s de debounce)
function onEditorChange() {
  clearTimeout(stimer)
  stimer = setTimeout(async () => {
    if (draft.value.content.trim()) {
      await persistEntry()
      showSt('Borrador guardado ✓')
    }
  }, 2500)
}

function showSt(msg) { st.value = msg; setTimeout(() => { st.value = '' }, 2400) }

// Se llama cuando ImageCanvas emite 'change' (tras subir, borrar,
// arrastrar o redimensionar una foto). ImageCanvas ya hizo la llamada
// a la API por su cuenta — aquí solo sincronizamos el array resultante
// de vuelta en entries.value, para que WeekGrid y el resto de la UI
// reflejen el cambio sin esperar a una recarga completa.
function onImagesChange(newImages) {
  if (!sel.value) return
  if (!entries.value[sel.value]) entries.value[sel.value] = { date: sel.value, title: '', content: '', mood: null }
  entries.value[sel.value] = { ...entries.value[sel.value], images: newImages }
}

// ── Seguridad: PIN ────────────────────────────────────────────
async function verifyPin(pin) {
  const hash = await sha256(pin + cfg.value.pinSalt)
  return hash === cfg.value.hashedPIN
}

function onUnlocked() {
  locked.value = false
  if (!sel.value) goToToday()
  startAutoLock()
}

function doLock() {
  locked.value = true
  clearTimeout(ltimer)
}

function startAutoLock() {
  clearTimeout(ltimer)
  if (cfg.value.autoLock > 0 && cfg.value.hasPIN) {
    ltimer = setTimeout(() => { locked.value = true }, cfg.value.autoLock * 60 * 1000)
  }
}

function resetActivity() {
  if (cfg.value.hasPIN && cfg.value.autoLock > 0) startAutoLock()
}

// ── Sesión ──────────────────────────────────────────────────────
// Se llama cuando <AuthScreen> emite 'authenticated' (login o registro
// exitoso). Recibe el token y los datos del usuario que devolvió el backend.
async function onAuthenticated({ token, user: u }) {
  api.setToken(token)   // a partir de aquí, api.js adjunta este token a TODAS las peticiones
  user.value = u
  await loadEntriesFromServer()
}

// Trae todas las entradas del usuario desde Postgres y las convierte
// al mismo formato { 'YYYY-MM-DD': {...} } que ya usaba toda la UI —
// así WeekGrid, PaperView y EntryEditor no necesitan saber nada sobre
// si los datos vienen de localStorage o de una API.
async function loadEntriesFromServer() {
  loadingData.value = true
  try {
    const list = await api.fetchEntries()       // array de entradas planas
    const map  = {}
    for (const e of list) map[e.date] = e        // lo convertimos a objeto indexado por fecha
    entries.value = map
  } catch (err) {
    showSt('No se pudieron cargar las entradas')
  } finally {
    loadingData.value = false
  }
}

function logout() {
  api.setToken(null)
  user.value    = null
  entries.value = {}
  sel.value     = null
  mode.value    = null
}

// ── CSS dinámico ──────────────────────────────────────────────
function applyAll() {
  const el = document.getElementById('app')
  if (!el) return
  el.className = `th-${cfg.value.theme} ff-${cfg.value.font} fs-${cfg.value.fontSize}`
  const hex = cfg.value.accent
  document.documentElement.style.setProperty('--a', hex)
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (m) document.documentElement.style.setProperty('--ad', `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},.15)`)
}

function onSettingsChange() {
  localStorage.setItem('diary:settings', JSON.stringify(cfg.value))
}

// ── Carga inicial ─────────────────────────────────────────────
onMounted(async () => {
  // 1. Cargar configuración LOCAL (tema, PIN, etc.)
  //    Estas son preferencias del dispositivo, no datos del diario —
  //    es una decisión de diseño válida mantenerlas en localStorage:
  //    no tiene sentido sincronizar "modo oscuro" entre dispositivos,
  //    cada persona puede preferir algo distinto en cada uno.
  try {
    const s = localStorage.getItem('diary:settings')
    if (s) Object.assign(cfg.value, JSON.parse(s))
  } catch {}
  applyAll()

  // 2. ¿Ya hay un token guardado de una sesión anterior?
  //    api.getToken() lee de localStorage solo la "llave de sesión",
  //    no datos del diario — eso ya no se guarda ahí.
  const existingToken = api.getToken()

  if (existingToken) {
    // Intentamos usar el token directamente pidiendo las entradas.
    // Si el token expiró o es inválido, el backend responde 403
    // y fetchEntries() lanza un error — lo atrapamos y mandamos
    // de vuelta a la pantalla de login en vez de dejar la app rota.
    try {
      await loadEntriesFromServer()
      user.value = { authenticated: true }   // marcador simple; no tenemos /me todavía
    } catch {
      api.setToken(null)   // el token ya no sirve, lo descartamos
    }
  }

  // 3. Si hay sesión activa, decide si mostrar PIN o ir directo al diario
  if (user.value) {
    if (cfg.value.hasPIN) {
      locked.value = true
    } else {
      goToToday()
      startAutoLock()
    }
  }
  // Si user.value sigue null aquí, el template muestra <AuthScreen>
  // automáticamente — no hace falta lógica adicional para eso.
})

function goToToday() {
  const today = fmtDate(new Date())
  sel.value   = today
  const e     = entries.value[today]
  draft.value = { title: e?.title ?? '', content: e?.content ?? '', mood: e?.mood ?? null }
  mode.value  = hasEntry(today) ? 'view' : 'edit'
}
</script>

<template>
  <!-- SIN SESIÓN — pantalla de registro/login contra el backend -->
  <AuthScreen v-if="!user" @authenticated="onAuthenticated" />

  <!-- CON SESIÓN, PERO BLOQUEADO LOCALMENTE — el PIN del dispositivo -->
  <LockScreen
    v-else-if="locked"
    :name="cfg.name"
    :verify="verifyPin"
    @verified="onUnlocked"
  />

  <!-- APLICACIÓN -->
  <div v-else @click="resetActivity">

    <!-- ── Header ── -->
    <header class="app-bar">
      <div class="app-logo">
        <span class="app-logo-dot" />
        <span>{{ cfg.name }}</span>
      </div>
      <nav class="app-nav">
        <button @click="view='diary'"    :class="['nav-btn', view==='diary'    ? 'active' : '']">📖 <span class="nav-label">Diario</span></button>
        <button @click="view='settings'" :class="['nav-btn', view==='settings' ? 'active' : '']">🎨 <span class="nav-label">Ajustes</span></button>
        <button v-if="cfg.hasPIN" @click="doLock" class="lock-btn" title="Bloquear">🔒</button>
        <button @click="logout" class="lock-btn" title="Cerrar sesión">↪</button>
      </nav>
    </header>

    <!-- ── Contenido principal ── -->
    <main class="app-main">

      <!-- ╔══ DIARIO ══╗ -->
      <div v-if="view === 'diary'">

        <!-- Navegación de semana -->
        <div class="week-nav">
          <button class="icon-btn" @click="wkOff--">←</button>
          <div class="week-center">
            <span class="week-label">{{ wkLabel }}</span>
            <button v-if="wkOff !== 0" class="today-btn" @click="wkOff = 0">HOY</button>
          </div>
          <button class="icon-btn" @click="wkOff++">→</button>
        </div>

        <!-- Cuadrícula de 7 días -->
        <WeekGrid
          :days="wkDays"
          :selected="sel"
          :entries="entries"
          @select="pickDay"
        />

        <!-- Vista del día (transición entre estados) -->
        <transition name="slide" mode="out-in">

          <!-- Vista de papel — después de guardar -->
          <PaperView
            v-if="sel && mode === 'view'"
            key="paper"
            :date="sel"
            :entry="entries[sel]"
            @edit="mode = 'edit'"
            @delete="deleteEntry"
          />

          <!-- Editor de entrada -->
          <EntryEditor
            v-else-if="sel && mode === 'edit'"
            key="editor"
            :date="sel"
            v-model="draft"
            :images="entries[sel]?.images || []"
            :save-status="st"
            :has-existing="hasEntry(sel)"
            @save="saveEntry"
            @change="onEditorChange"
            @view="mode = 'view'"
            @images-change="onImagesChange"
          />

          <!-- Estado vacío (ningún día seleccionado) -->
          <div v-else key="empty" class="empty-state">
            <span class="empty-glyph">✦</span>
            <span class="empty-title">Selecciona un día</span>
            <p class="empty-desc">Elige cualquier día de la semana para ver o crear tu entrada.</p>
          </div>

        </transition>
      </div>

      <!-- ╔══ AJUSTES ══╗ -->
      <SettingsPanel
        v-if="view === 'settings'"
        v-model="cfg"
        @change="onSettingsChange"
      />

    </main>
  </div>
</template>
