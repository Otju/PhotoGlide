import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const app = createApp(App)
app.mount('#app')
