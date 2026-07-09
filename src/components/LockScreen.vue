<script setup>
import { ref } from 'vue'

const props = defineProps({
  name:   { type: String,   default: 'Mi Diario' },
  /** async (pin: string) => boolean */
  verify: { type: Function, required: true }
})
const emit = defineEmits(['verified'])

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

const pin    = ref('')
const shake  = ref(false)
const hasErr = ref(false)
const errMsg = ref('')

function pressKey(k) {
  if (k === '')  return
  if (k === '⌫') { pin.value = pin.value.slice(0, -1); errMsg.value = ''; return }
  if (pin.value.length >= 4) return
  pin.value += k
  if (pin.value.length === 4) setTimeout(tryUnlock, 100)
}

async function tryUnlock() {
  const ok = await props.verify(pin.value)
  if (ok) {
    emit('verified')
    pin.value = ''
  } else {
    hasErr.value = true
    shake.value  = true
    errMsg.value = 'PIN incorrecto'
    setTimeout(() => { pin.value = ''; shake.value = false; hasErr.value = false }, 420)
  }
}
</script>

<template>
  <div class="lock-screen">
    <div class="lock-logo">
      <span class="lock-dot"></span>
      {{ name }}
    </div>
    <p class="lock-sub">Ingresa tu PIN para continuar</p>

    <div :class="['pin-dots', shake ? 'shake' : '']">
      <span
        v-for="i in 4" :key="i"
        :class="['pin-dot', pin.length >= i ? (hasErr ? 'err' : 'fill') : '']"
      />
    </div>

    <div class="keypad">
      <button
        v-for="k in KEYS" :key="k"
        @click="pressKey(k)"
        :class="['key', k === '' ? 'key-empty' : '', k === '⌫' ? 'key-del' : '']"
        :disabled="k === ''"
      >{{ k }}</button>
    </div>

    <p class="lock-err">{{ errMsg }}</p>
  </div>
</template>

<style scoped>
.lock-screen {
  position: fixed; inset: 0; z-index: 999;
  background: var(--bg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0; padding: 20px;
}
.lock-logo {
  font-family: var(--fb); font-size: 19px; font-weight: 600; color: var(--tx);
  margin-bottom: 5px; display: flex; align-items: center; gap: 8px;
}
.lock-dot { width:7px; height:7px; border-radius:50%; background:var(--a); flex-shrink:0; }
.lock-sub  { font-size:11px; color:var(--tm); margin-bottom:26px; }

.pin-dots { display:flex; gap:13px; margin-bottom:26px; }
@keyframes shake {
  0%,100% { transform:translateX(0); }
  20%     { transform:translateX(-7px); }
  40%     { transform:translateX( 7px); }
  60%     { transform:translateX(-4px); }
  80%     { transform:translateX( 4px); }
}
.pin-dots.shake { animation: shake .4s ease; }
.pin-dot {
  width:13px; height:13px; border-radius:50%;
  border:2px solid var(--bd); transition:all .12s;
}
.pin-dot.fill { background:var(--a); border-color:var(--a); }
.pin-dot.err  { background:#F87B74; border-color:#F87B74; }

.keypad { display:grid; grid-template-columns:repeat(3, 58px); gap:8px; }
.key {
  width:58px; height:58px; border-radius:50%;
  border:1px solid var(--bd); background:var(--sf); color:var(--tx);
  font-size:17px; font-weight:500; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-family:'Inter',sans-serif; transition:all .12s;
}
.key:hover   { background:var(--sf2); border-color:var(--a); }
.key:active  { transform:scale(.92); }
.key-del     { color:var(--tm); font-size:15px; }
.key-empty   { background:none; border:none; cursor:default; pointer-events:none; }

.lock-err { font-size:11px; color:#F87B74; height:16px; margin-top:10px; }
</style>
