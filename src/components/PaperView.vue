<script setup>
import { fullDate } from '@/utils/dates.js'

defineProps({
  date:  { type: String, required: true },
  entry: { type: Object, required: true }   // { title, content, mood }
})
const emit = defineEmits(['edit', 'delete'])
</script>

<template>
  <div class="paper-scene">
    <!-- Hoja de papel -->
    <div class="paper">
      <!-- Línea de margen vertical (estilo cuaderno) -->
      <div class="margin-line" />

      <div class="paper-inner">
        <p class="pa-date">{{ fullDate(date) }}</p>

        <div class="pa-header">
          <span v-if="entry.mood" class="pa-mood">{{ entry.mood }}</span>
          <div>
            <h2 v-if="entry.title" class="pa-title">{{ entry.title }}</h2>
            <h2 v-else class="pa-title pa-title--empty">Sin título</h2>
          </div>
        </div>

        <div class="pa-divider" />

        <!-- white-space:pre-wrap preserva los saltos de línea del textarea -->
        <div class="pa-body">{{ entry.content }}</div>
      </div>

      <!-- Esquina doblada (sello visual de papel) -->
      <div class="paper-fold" />
    </div>

    <div class="paper-actions">
      <button @click="emit('delete')" class="pa-btn pa-btn--danger">✕ Borrar</button>
      <button @click="emit('edit')"   class="pa-btn">✎ Editar</button>
    </div>
  </div>
</template>

<style scoped>
.paper-scene { display:flex; flex-direction:column; align-items:center; gap:12px; }

.paper {
  width: 100%; max-width: 600px; position: relative;
  background-color: #FFF9F0;
  /* Líneas rayadas sutiles comenzando debajo del encabezado */
  background-image:
    linear-gradient(to right, #F5CFC4 0, #F5CFC4 1.5px, transparent 1.5px),
    repeating-linear-gradient(transparent, transparent 30px, rgba(160,140,118,.13) 30px, rgba(160,140,118,.13) 31px);
  background-position: 50px 0, 0 54px;
  background-size: 100% 100%, 100% 31px;
  border-radius: 2px 2px 3px 3px;
  border: 1px solid rgba(190,170,145,.35);
  color: #2C2416;
  overflow: hidden;
}
.margin-line {
  position: absolute; top: 0; bottom: 0; left: 50px;
  width: 1.5px; background: rgba(230,180,180,.5);
  pointer-events: none;
}
.paper-fold {
  position: absolute; bottom: 0; right: 0;
  width: 0; height: 0; border-style: solid;
  border-width: 0 0 22px 22px;
  border-color: transparent transparent rgba(0,0,0,.07) transparent;
}
.paper-inner { padding: 30px 34px 36px 72px; }

.pa-date {
  font-family: 'Lora', Georgia, serif; font-style: italic;
  font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--a); margin-bottom: 14px;
}
.pa-header { display:flex; align-items:flex-start; gap:12px; margin-bottom:6px; }
.pa-mood   { font-size:26px; flex-shrink:0; margin-top:2px; }
.pa-title  { font-family:'Lora',Georgia,serif; font-size:21px; font-weight:700; line-height:1.2; color:#1C1208; }
.pa-title--empty { font-weight:400; font-style:italic; color:#B8A898; }
.pa-divider { width:40px; height:2px; background:var(--a); margin:16px 0; border-radius:1px; opacity:.7; }
.pa-body {
  font-family: var(--fb, 'Lora', serif);
  font-size: var(--fsb, 14px);
  line-height: 2;
  color: #2C2416;
  white-space: pre-wrap; word-break: break-word;
}

.paper-actions { display:flex; gap:8px; justify-content:flex-end; width:100%; max-width:600px; }
.pa-btn {
  padding: 7px 16px; border-radius: var(--rs);
  font-size: 12px; font-weight: 500; cursor: pointer;
  font-family: 'Inter', sans-serif; transition: all .14s;
  border: 1px solid var(--bd); background: none; color: var(--tm);
}
.pa-btn:hover          { background: var(--sf2); color: var(--tx); }
.pa-btn--danger        { color: var(--tf); }
.pa-btn--danger:hover  { border-color: #F87B74; color: #F87B74; background: rgba(248,123,116,.08); }
</style>
