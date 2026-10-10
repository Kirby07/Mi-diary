import { createApp } from 'vue'
import App from './App.vue'
import SharedView from './components/SharedView.vue'
import './styles/main.css'

// /v#<token> → modo visitante (solo lectura, sin cuenta ni PIN).
// vercel.json ya reescribe cualquier ruta a index.html, así que no hace
// falta un router para esto.
createApp(location.pathname === '/v' ? SharedView : App).mount('#app')
