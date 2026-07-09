<script setup>
import { ref } from 'vue'
import { sha256, generateSalt } from '@/utils/crypto.js'

const KEYS   = ['1','2','3','4','5','6','7','8','9','','0','⌫']
const THEMES = [
  { id:'dark',  name:'Oscuro', bg:'#131219', sf:'#1E1C28', ac:'#9B8EC4', tm:'#8B82A3' },
  { id:'light', name:'Claro',  bg:'#FAF8FF', sf:'#FFFFFF', ac:'#9B8EC4', tm:'#6B5E8A' },
  { id:'sepia', name:'Sepia',  bg:'#F5ECD7', sf:'#FFFDF5', ac:'#9B8EC4', tm:'#7A6040' }
]
const ACCENTS = [
  { name:'Lavanda',   hex:'#9B8EC4' },
  { name:'Índigo',    hex:'#6E7CF9' },
  { name:'Esmeralda', hex:'#4ECCA3' },
  { name:'Coral',     hex:'#F87B74' },
  { name:'Dorado',    hex:'#F5C842' },
  { name:'Rosa',      hex:'#E879A0' }
]
const FONTS   = [{ id:'serif', name:'Serif', fam:"'Lora',serif" }, { id:'sans', name:'Sans', fam:"'Inter',sans-serif" }, { id:'mono', name:'Mono', fam:"'Courier New',monospace" }]
const SIZES   = [{ id:'sm', label:'Pequeño' }, { id:'md', label:'Mediano' }, { id:'lg', label:'Grande' }]
const AL_OPTS = [{ v:0, l:'Nunca' }, { v:1, l:'1 min' }, { v:5, l:'5 min' }, { v:15, l:'15 min' }]

const props = defineProps({
  modelValue: { type: Object, required: true }   // cfg object
})
const emit = defineEmits(['update:modelValue', 'change'])

// ── PIN setup local state ──────────────────────────────────
const pinFlow    = ref(false)
const pinStep    = ref(1)       // 1 = crear, 2 = confirmar
const pinIn      = ref('')
const pinFirst   = ref('')
const pinFlowErr = ref('')

function set(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
  emit('change')
}

// ── PIN setup ──────────────────────────────────────────────
function startPinFlow() {
  pinFlow.value = true; pinStep.value = 1
  pinIn.value = ''; pinFirst.value = ''; pinFlowErr.value = ''
}

function pinKey(k) {
  if (k === '')  return
  if (k === '⌫') { pinIn.value = pinIn.value.slice(0, -1); pinFlowErr.value = ''; return }
  if (pinIn.value.length >= 4) return
  pinIn.value += k
  if (pinIn.value.length === 4) setTimeout(pinNext, 150)
}

async function pinNext() {
  if (pinStep.value === 1) {
    pinFirst.value = pinIn.value; pinIn.value = ''; pinStep.value = 2
  } else if (pinIn.value === pinFirst.value) {
    const salt = generateSalt()
    const hash = await sha256(pinIn.value + salt)
    set({ hasPIN: true, hashedPIN: hash, pinSalt: salt })
    pinFlow.value = false; pinIn.value = ''; pinFirst.value = ''
  } else {
    pinFlowErr.value = 'Los PINs no coinciden. Intenta de nuevo.'
    pinIn.value = ''; pinStep.value = 1; pinFirst.value = ''
  }
}

function removePIN() {
  if (!confirm('¿Desactivar el bloqueo con PIN?')) return
  set({ hasPIN: false, hashedPIN: '', pinSalt: '', autoLock: 0 })
  pinFlow.value = false
}
</script>

<template>
  <div class="settings-stack">

    <!-- Nombre -->
    <div class="card">
      <p class="label">Nombre del diario</p>
      <input :value="modelValue.name" @input="set({ name: $event.target.value })" @change="$emit('change')" class="text-input" placeholder="Mi Diario" />
    </div>

    <!-- Tema -->
    <div class="card">
      <p class="label">Tema</p>
      <div class="theme-grid">
        <div v-for="t in THEMES" :key="t.id" @click="set({ theme: t.id })" :class="['theme-tile', modelValue.theme === t.id ? 'active' : '']">
          <div class="theme-swatch" :style="{background: t.bg}">
            <div class="swatch-bar" :style="{background: t.sf, width:'65%'}" />
            <div class="swatch-bar" :style="{background: t.ac, width:'40%'}" />
          </div>
          <div class="theme-name" :style="{background: t.sf, color: t.tm}">{{ t.name }}</div>
        </div>
      </div>
    </div>

    <!-- Acento -->
    <div class="card">
      <p class="label">Color de acento</p>
      <div class="color-row">
        <button v-for="c in ACCENTS" :key="c.hex" @click="set({ accent: c.hex })" :class="['color-swatch', modelValue.accent === c.hex ? 'active' : '']" :style="{background: c.hex}" :title="c.name" />
      </div>
    </div>

    <!-- Fuente -->
    <div class="card">
      <p class="label">Tipografía del contenido</p>
      <div class="opt-row">
        <button v-for="f in FONTS" :key="f.id" @click="set({ font: f.id })" :class="['opt-btn', modelValue.font === f.id ? 'active' : '']" :style="{fontFamily: f.fam}">{{ f.name }}</button>
      </div>
    </div>

    <!-- Tamaño -->
    <div class="card">
      <p class="label">Tamaño de texto</p>
      <div class="opt-row">
        <button v-for="s in SIZES" :key="s.id" @click="set({ fontSize: s.id })" :class="['opt-btn', modelValue.fontSize === s.id ? 'active' : '']">{{ s.label }}</button>
      </div>
    </div>

    <!-- Seguridad -->
    <div class="card">
      <p class="label">Seguridad</p>

      <!-- PIN status -->
      <div class="sec-row">
        <div>
          <span class="sec-lbl">Bloqueo con PIN</span>
          <span :class="['badge', modelValue.hasPIN ? 'badge-on' : 'badge-off']">
            {{ modelValue.hasPIN ? '🔒 Activo' : 'Desactivado' }}
          </span>
        </div>
      </div>
      <p class="sec-desc">El PIN se hashea con SHA-256 + sal aleatoria (Web Crypto API). Nunca se almacena en texto plano.</p>

      <div v-if="!modelValue.hasPIN && !pinFlow" class="sec-btns">
        <button @click="startPinFlow" class="sm-btn">Activar PIN</button>
      </div>
      <div v-if="modelValue.hasPIN && !pinFlow" class="sec-btns">
        <button @click="removePIN" class="sm-btn sm-btn-danger">Eliminar PIN</button>
      </div>

      <!-- PIN setup flow -->
      <div v-if="pinFlow" class="pin-flow">
        <p class="pin-step-lbl">{{ pinStep === 1 ? 'Establece un PIN de 4 dígitos' : 'Confirma tu PIN' }}</p>
        <div class="pin-disp">
          <span v-for="i in 4" :key="i" :class="['pin-disp-dot', pinIn.length >= i ? 'fill' : '']" />
        </div>
        <div class="mini-kpad">
          <button v-for="k in KEYS" :key="'sf'+k" @click="pinKey(k)" :class="['mini-key', k === '' ? 'key-empty' : '']" :disabled="k === ''">{{ k }}</button>
        </div>
        <p class="pin-err">{{ pinFlowErr }}</p>
      </div>

      <!-- Auto-lock (solo si PIN activo) -->
      <div v-if="modelValue.hasPIN" class="sep">
        <p class="sec-lbl" style="margin-bottom:6px">Bloqueo automático</p>
        <div class="opt-row">
          <button v-for="al in AL_OPTS" :key="al.v" @click="set({ autoLock: al.v })" :class="['opt-btn', modelValue.autoLock === al.v ? 'active' : '']">{{ al.l }}</button>
        </div>
      </div>

      <!-- XSS / validación -->
      <div class="sep">
        <div class="sec-row">
          <span class="sec-lbl">Validación de contenido</span>
          <span class="badge badge-on">✓ Activa</span>
        </div>
        <p class="sec-desc">El texto se sanitiza antes de guardarse (elimina etiquetas HTML y vectores XSS). Límites: título 100 chars, contenido 10 000 chars.</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.settings-stack { display:flex; flex-direction:column; gap:12px; }
.card           { background:var(--sf); border:1px solid var(--bd); border-radius:var(--r); padding:16px 18px; }
.label          { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--tm); margin-bottom:10px; }

.text-input {
  width:100%; padding:8px 11px; border-radius:var(--rs); border:1px solid var(--bd);
  background:var(--sf2); color:var(--tx); font-size:13px; outline:none;
  transition:border-color .14s; font-family:'Inter',sans-serif;
}
.text-input:focus { border-color:var(--a); }

.theme-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.theme-tile { border-radius:var(--rs); border:2px solid var(--bd); overflow:hidden; cursor:pointer; transition:border-color .14s; }
.theme-tile:hover, .theme-tile.active { border-color:var(--a); }
.theme-swatch { height:46px; padding:7px; display:flex; flex-direction:column; gap:4px; }
.swatch-bar   { border-radius:2px; height:9px; }
.theme-name   { font-size:11px; font-weight:500; text-align:center; padding:4px; border-top:1px solid var(--bd); }

.color-row { display:flex; gap:7px; flex-wrap:wrap; }
.color-swatch {
  width:31px; height:31px; border-radius:50%; cursor:pointer;
  border:3px solid transparent; transition:all .14s; outline:none;
}
.color-swatch:hover  { transform:scale(1.12); }
.color-swatch.active { border-color:var(--tx); }

.opt-row { display:flex; gap:6px; }
.opt-btn {
  flex:1; padding:7px; border-radius:var(--rs); border:1px solid var(--bd);
  background:none; color:var(--tm); font-size:12px; cursor:pointer;
  transition:all .14s; font-family:'Inter',sans-serif; text-align:center;
}
.opt-btn:hover  { background:var(--sf2); }
.opt-btn.active { background:var(--ad); border-color:var(--a); color:var(--a); }

/* Security */
.sec-row  { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
.sec-lbl  { font-size:13px; color:var(--tx); font-weight:500; }
.sec-desc { font-size:11px; color:var(--tm); line-height:1.6; margin-bottom:8px; }
.badge    { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:600; margin-left:6px; }
.badge-on  { background:rgba(78,204,163,.15); color:#4ECCA3; }
.badge-off { background:var(--sf2); color:var(--tm); }
.sec-btns { display:flex; gap:7px; flex-wrap:wrap; margin-top:6px; }
.sm-btn {
  padding:5px 12px; border-radius:var(--rs); font-size:11px; font-weight:500;
  cursor:pointer; border:1px solid var(--bd); background:none; color:var(--tm);
  transition:all .14s; font-family:'Inter',sans-serif;
}
.sm-btn:hover         { background:var(--sf2); color:var(--tx); }
.sm-btn-danger        { border-color:rgba(248,123,116,.3); color:#F87B74; }
.sm-btn-danger:hover  { background:rgba(248,123,116,.1); border-color:#F87B74; }

.pin-flow { background:var(--sf2); border-radius:var(--r); padding:14px; margin-top:10px; }
.pin-step-lbl { font-size:11px; color:var(--tm); margin-bottom:10px; text-align:center; }
.pin-disp { display:flex; gap:11px; justify-content:center; margin-bottom:12px; }
.pin-disp-dot { width:11px; height:11px; border-radius:50%; border:2px solid var(--bd); transition:all .12s; }
.pin-disp-dot.fill { background:var(--a); border-color:var(--a); }
.mini-kpad { display:grid; grid-template-columns:repeat(3,46px); gap:7px; justify-content:center; }
.mini-key {
  width:46px; height:46px; border-radius:50%; border:1px solid var(--bd);
  background:var(--sf3); color:var(--tx); font-size:15px; font-weight:500;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-family:'Inter',sans-serif; transition:all .12s;
}
.mini-key:hover    { background:var(--sf); border-color:var(--a); }
.mini-key:active   { transform:scale(.92); }
.mini-key.key-empty{ background:none; border:none; cursor:default; pointer-events:none; }
.pin-err { font-size:10px; color:#F87B74; text-align:center; height:14px; margin-top:6px; }

.sep { border-top:1px solid var(--bd); margin-top:14px; padding-top:14px; }
</style>
