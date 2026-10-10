<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { Picker } from 'emoji-picker-element'
import es from 'emoji-picker-element/i18n/es'
// ?url → Vite lo sirve como archivo propio del sitio. Sin esto el picker
// lo pediría a cdn.jsdelivr.net y la CSP (connect-src) lo bloquearía.
import emojiData from 'emoji-picker-element-data/es/cldr/data.json?url'
import { fullDate } from '@/utils/dates.js'
import ImageCanvas from '@/components/ImageCanvas.vue'

const props = defineProps({
  date:        { type: String, required: true },
  modelValue:  { type: Object, required: true },  // { title, content, mood }
  images:      { type: Array,  default: () => [] },
  saveStatus:  { type: String, default: '' },
  hasExisting: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'save', 'change', 'view', 'images-change'])

const textareaRef = ref(null)

const wordCount = computed(() => {
  const t = props.modelValue.content.trim()
  return t ? t.split(/\s+/).length : 0
})

function updateTitle(e) {
  emit('update:modelValue', { ...props.modelValue, title: e.target.value })
  emit('change')
}

function updateContent(e) {
  emit('update:modelValue', { ...props.modelValue, content: e.target.value })
  emit('change')
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
    }
  })
}

// ── Selector de ánimo (estilo WhatsApp) ─────────────────────────
// El picker se crea la primera vez que se abre: así no se descargan
// los datos de emojis si la persona nunca lo usa.
const pickerOpen = ref(false)
const pickerHost = ref(null)
const moodWrap   = ref(null)
let picker = null

function setMood(mood) {
  emit('update:modelValue', { ...props.modelValue, mood })
  emit('change')
}

function togglePicker() {
  pickerOpen.value = !pickerOpen.value
  if (!pickerOpen.value) return
  if (!picker) {
    picker = new Picker({ locale: 'es', i18n: es, dataSource: emojiData })
    picker.addEventListener('emoji-click', e => {
      setMood(e.detail.unicode)
      pickerOpen.value = false
    })
  }
  nextTick(() => pickerHost.value?.appendChild(picker))
}

function closeOnOutside(e) {
  if (pickerOpen.value && !moodWrap.value?.contains(e.target)) pickerOpen.value = false
}
function closeOnEsc(e) {
  if (e.key === 'Escape') pickerOpen.value = false
}
document.addEventListener('pointerdown', closeOnOutside)
document.addEventListener('keydown', closeOnEsc)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside)
  document.removeEventListener('keydown', closeOnEsc)
})
</script>

<template>
  <div class="editor-wrap">
    <!-- Header del editor -->
    <div class="editor-head">
      <p class="editor-date">{{ fullDate(date) }}</p>

      <!-- Título — maxlength aplicado en HTML y también en sanitize() al guardar -->
      <input
        :value="modelValue.title"
        @input="updateTitle"
        class="editor-title"
        placeholder="¿Cómo fue este día?"
        maxlength="100"
      />

      <!-- Selector de estado de ánimo -->
      <div class="mood-row" ref="moodWrap">
        <button
          @click="togglePicker"
          :class="['mood-btn', modelValue.mood ? 'active' : '']"
          :aria-expanded="pickerOpen"
          aria-label="Elegir estado de ánimo"
          title="Estado de ánimo"
        >
          <span v-if="modelValue.mood">{{ modelValue.mood }}</span>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8"/>
            <circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>
          </svg>
        </button>
        <button v-if="modelValue.mood" @click="setMood(null)" class="mood-clear"
                aria-label="Quitar estado de ánimo" title="Quitar">✕</button>
        <div v-show="pickerOpen" ref="pickerHost" class="mood-pop" />
      </div>
    </div>

    <!-- Área de texto — maxlength aplicado en HTML y también en sanitize() al guardar -->
    <div class="editor-body">
      <textarea
        ref="textareaRef"
        :value="modelValue.content"
        @input="updateContent"
        class="editor-textarea"
        placeholder="Escribe lo que quieras recordar de este día..."
        maxlength="10000"
      />
    </div>

    <!-- Fotos de la entrada -->
    <div class="editor-images">
      <ImageCanvas
        :date="date"
        :images="images"
        :editable="true"
        @change="emit('images-change', $event)"
      />
    </div>

    <!-- Footer con contadores y acciones -->
    <div class="editor-foot">
      <span class="word-count">
        {{ wordCount }} palabras · {{ modelValue.content.length }}/10 000
      </span>
      <div class="editor-acts">
        <span :class="['save-status', saveStatus ? 'visible' : '']">{{ saveStatus }}</span>
        <button v-if="hasExisting" @click="emit('view')" class="btn btn-ghost">Ver</button>
        <button @click="emit('save')" class="btn btn-accent">Guardar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-wrap { background:var(--sf); border:1px solid var(--bd); border-radius:var(--rl); overflow:hidden; }

.editor-head { padding:16px 18px 0; }
.editor-date {
  font-size:10px; text-transform:uppercase; letter-spacing:.12em;
  color:var(--tm); font-weight:600; margin-bottom:8px;
}
.editor-title {
  width:100%; border:none; background:transparent;
  font-family:var(--fb); font-size:var(--fsxl); font-weight:600;
  color:var(--tx); outline:none; margin-bottom:12px; line-height:1.25;
}
.editor-title::placeholder { color:var(--tf); }

.mood-row {
  position:relative; display:flex; align-items:center; gap:6px;
  padding-bottom:12px; border-bottom:1px solid var(--bd);
}
.mood-btn {
  width:34px; height:34px; border-radius:var(--rs); border:1.5px solid transparent;
  background:var(--sf2); color:var(--tm); display:flex; align-items:center; justify-content:center;
  font-size:18px; cursor:pointer; transition:all .14s;
}
.mood-clear {
  border:none; background:none; color:var(--tf); font-size:11px; cursor:pointer; padding:4px;
}
.mood-clear:hover { color:var(--tx); }
.mood-pop {
  position:absolute; top:calc(100% - 6px); left:0; z-index:20;
  max-width:calc(100vw - 32px);
  box-shadow:0 8px 24px rgba(0,0,0,.18); border-radius:var(--rl); overflow:hidden;
}
/* Las variables CSS atraviesan el shadow DOM del picker: lo pintamos
   con los colores del tema activo (oscuro/claro/sepia). */
.mood-pop :deep(emoji-picker) {
  --background: var(--sf);
  --border-color: var(--bd);
  --input-border-color: var(--bd);
  --input-font-color: var(--tx);
  --input-placeholder-color: var(--tf);
  --category-font-color: var(--tm);
  --indicator-color: var(--a);
  --outline-color: var(--a);
  --button-hover-background: var(--sf3);
  --button-active-background: var(--sf2);
  width:min(340px, calc(100vw - 32px));
  height:360px;
}
.mood-btn:hover  { background:var(--sf3); transform:scale(1.1); }
.mood-btn.active { border-color:var(--a); background:var(--ad); }

.editor-body { padding:14px 18px; }
.editor-textarea {
  width:100%; min-height:200px; border:none; background:transparent;
  font-family:var(--fb); font-size:var(--fsb); color:var(--tx);
  line-height:1.85; resize:none; outline:none;
}
.editor-textarea::placeholder { color:var(--tf); font-style:italic; }

.editor-images { padding: 0 18px 14px; }

.editor-foot {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 18px; border-top:1px solid var(--bd);
}
.word-count  { font-size:10px; color:var(--tf); }
.editor-acts { display:flex; align-items:center; gap:6px; }
.save-status { font-size:11px; color:var(--tm); font-style:italic; opacity:0; transition:opacity .3s; }
.save-status.visible { opacity:1; }

.btn {
  padding:6px 14px; border-radius:var(--rs); font-size:12px; font-weight:500;
  cursor:pointer; border:none; transition:all .14s; font-family:'Inter',sans-serif;
}
.btn-ghost  { background:none; border:1px solid var(--bd); color:var(--tm); }
.btn-ghost:hover { background:var(--sf2); color:var(--tx); }
.btn-accent { background:var(--a); color:#fff; }
.btn-accent:hover { opacity:.85; }
</style>

