<script setup>
import { ref } from 'vue'
import { register, login, ApiError } from '@/services/api.js'

const emit = defineEmits(['authenticated'])

const mode  = ref('login')   // 'login' | 'register'
const email = ref('')
const password = ref('')
const name  = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    // Llamamos a register() o login() según el modo activo —
    // ambas funciones devuelven { token, user } si todo va bien.
    const fn = mode.value === 'login' ? login : register
    const { token, user } = await fn(email.value, password.value, name.value)

    // Avisamos al componente padre (App.vue) con los datos de sesión.
    // App.vue decide qué hacer con ellos (guardar token, cargar entradas, etc.)
    emit('authenticated', { token, user })
  } catch (err) {
    // ApiError la lanzamos nosotros mismos en api.js cuando el servidor
    // responde con un error — su .message ya viene del backend
    // (ej: "Credenciales inválidas"), seguro de mostrar al usuario.
    error.value = err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-logo">
      <span class="auth-dot" />
      Mi Diario
    </div>

    <div class="auth-tabs">
      <button :class="['tab', mode === 'login' ? 'active' : '']" @click="mode = 'login'">Iniciar sesión</button>
      <button :class="['tab', mode === 'register' ? 'active' : '']" @click="mode = 'register'">Crear cuenta</button>
    </div>

    <form class="auth-form" @submit.prevent="submit">
      <input
        v-if="mode === 'register'"
        v-model="name"
        type="text"
        placeholder="Nombre del diario (opcional)"
        class="auth-input"
      />
      <input v-model="email"    type="email"    placeholder="Email"      class="auth-input" required />
      <input v-model="password" type="password" placeholder="Contraseña" class="auth-input" required minlength="8" />

      <p v-if="error" class="auth-error">{{ error }}</p>

      <button type="submit" class="auth-submit" :disabled="loading">
        {{ loading ? 'Conectando...' : (mode === 'login' ? 'Entrar' : 'Crear cuenta') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.auth-screen {
  position: fixed; inset: 0; z-index: 999;
  background: var(--bg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 20px; gap: 0;
}
.auth-logo {
  font-family: var(--fb); font-size: 19px; font-weight: 600; color: var(--tx);
  margin-bottom: 24px; display: flex; align-items: center; gap: 8px;
}
.auth-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--a); }

.auth-tabs { display: flex; gap: 2px; margin-bottom: 18px; background: var(--sf); border-radius: var(--r); padding: 3px; }
.tab {
  padding: 7px 14px; border-radius: var(--rs); border: none; background: none;
  color: var(--tm); font-size: 12px; font-weight: 500; cursor: pointer;
  font-family: 'Inter', sans-serif; transition: all .14s;
}
.tab.active { background: var(--ad); color: var(--a); }

.auth-form { display: flex; flex-direction: column; gap: 9px; width: 100%; max-width: 280px; }
.auth-input {
  padding: 10px 13px; border-radius: var(--rs); border: 1px solid var(--bd);
  background: var(--sf2); color: var(--tx); font-size: 13px; outline: none;
  font-family: 'Inter', sans-serif; transition: border-color .14s;
}
.auth-input:focus { border-color: var(--a); }
.auth-error { font-size: 11px; color: #F87B74; text-align: center; }
.auth-submit {
  padding: 10px; border-radius: var(--rs); border: none; background: var(--a);
  color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: 'Inter', sans-serif; transition: opacity .14s; margin-top: 4px;
}
.auth-submit:hover:not(:disabled) { opacity: .85; }
.auth-submit:disabled { opacity: .5; cursor: default; }
</style>
