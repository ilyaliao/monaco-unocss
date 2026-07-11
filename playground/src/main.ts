// @env browser
import { createApp } from 'vue'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import 'splitpanes/dist/splitpanes.css'
import './styles.css'

createApp(App).mount('#app')
