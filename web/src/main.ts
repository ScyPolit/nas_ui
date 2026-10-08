import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'highlight.js/styles/github.css'
import App from '@/App.vue'
import { router } from '@/router'
import '@/styles/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
