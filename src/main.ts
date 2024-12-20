import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import DateTimeInput from './components/DateTimeInput.vue'
import ImageViewer from './components/ImageViewer.vue'

dayjs.extend(customParseFormat)

const app = createApp(App)

app.component('DateTimeInput', DateTimeInput)
app.component('ImageViewer', ImageViewer)

app.mount('#app')
