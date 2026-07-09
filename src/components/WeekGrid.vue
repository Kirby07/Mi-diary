<script setup>
defineProps({
  days:     { type: Array,  required: true },  // { key, short, num, isToday }[]
  selected: { type: String, default: null  },
  entries:  { type: Object, default: () => ({}) }
})
const emit = defineEmits(['select'])
</script>

<template>
  <div class="week-grid">
    <div
      v-for="d in days" :key="d.key"
      @click="emit('select', d.key)"
      :class="['day-card', d.isToday ? 'today' : '', selected === d.key ? 'selected' : '']"
    >
      <!-- Punto de acento si la entrada existe -->
      <span v-if="entries[d.key]?.content" class="entry-dot" />

      <span class="day-name">{{ d.short }}</span>

      <span class="day-num">{{ d.num }}</span>

      <span v-if="entries[d.key]?.mood" class="day-mood">{{ entries[d.key].mood }}</span>

      <span v-if="entries[d.key]?.content" class="day-snip">{{ entries[d.key].content.trim().slice(0, 50) }}</span>
      <span v-else class="day-plus">+</span>
    </div>
  </div>
</template>

<style scoped>
.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 16px;
}
.day-card {
  background: var(--sf); border: 1px solid var(--bd); border-radius: var(--r);
  padding: 9px 5px 7px; cursor: pointer;
  transition: border-color .14s, background .14s;
  min-height: 94px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  position: relative;
}
.day-card:hover    { border-color: var(--a); background: var(--sf2); }
.day-card.selected { border-color: var(--a); background: var(--ad); }
.day-card.today .day-num {
  background: var(--a); color: #fff;
  width: 25px; height: 25px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.entry-dot {
  position: absolute; top: 6px; right: 6px;
  width: 5px; height: 5px; border-radius: 50%; background: var(--a);
}
.day-name { font-size:9px; text-transform:uppercase; letter-spacing:.1em; color:var(--tm); font-weight:600; }
.day-num  { font-size:17px; font-weight:600; color:var(--tx); line-height:1.2; }
.day-mood { font-size:14px; margin-top:1px; }
.day-snip {
  font-family: 'Lora', Georgia, serif; font-style: italic;
  font-size: 9px; color: var(--tm); text-align: center; line-height: 1.3;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  width: 100%; padding: 0 2px; margin-top: 2px;
}
.day-plus { font-size:15px; color:var(--tf); margin-top:auto; line-height:1; }

@media (max-width: 480px) { .day-snip { display: none; } }
</style>
