<script setup>
import { ref, computed, nextTick } from 'vue'
import { fullDate } from '@/utils/dates.js'

const MOODS = ['😊','😄','😔','😤','😰','😴','🤩','💪','❤️','🤒']

const props = defineProps({
  date:        { type: String, required: true },
  modelValue:  { type: Object, required: true },  // { title, content, mood }
  saveStatus:  { type: String, default: '' },
  hasExisting: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'save', 'change', 'view'])

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

function toggleMood(m) {
  const mood = props.modelValue.mood === m ? null : m
  emit('update:modelValue', { ...props.modelValue, mood })
  emit('change')
}
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
      <div class="mood-row">
        <button
          v-for="m in MOODS" :key="m"
          @click="toggleMood(m)"
          :class="['mood-btn', modelValue.mood === m ? 'active' : '']"
          :title="m"
        >{{ m }}</button>
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

.mood-row { display:flex; gap:3px; padding-bottom:12px; border-bottom:1px solid var(--bd); flex-wrap:wrap; }
.mood-btn {
  width:30px; height:30px; border-radius:var(--rs); border:1.5px solid transparent;
  background:var(--sf2); display:flex; align-items:center; justify-content:center;
  font-size:15px; cursor:pointer; transition:all .14s;
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
