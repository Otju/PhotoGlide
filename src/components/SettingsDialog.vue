<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { XMarkIcon, FolderIcon } from '@heroicons/vue/24/solid'

const { ipcRenderer } = window.require('electron')

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', settings: Settings): void
}>()

type Settings = {
  defaultFolder: string
  slideshowInterval: number
  backgroundStyle: 'parchment' | 'black'
}

const defaultFolder = ref('')
const slideshowIntervalSeconds = ref(10)
const backgroundStyle = ref<'parchment' | 'black'>('parchment')

onMounted(async () => {
  await loadSettings()
})

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await loadSettings()
    }
  }
)

const loadSettings = async () => {
  const settings = await ipcRenderer.invoke('getSettings')
  defaultFolder.value = settings.defaultFolder || ''
  slideshowIntervalSeconds.value = Math.round(settings.slideshowInterval / 1000)
  backgroundStyle.value = settings.backgroundStyle || 'parchment'
}

const selectFolder = async () => {
  const folder = await ipcRenderer.invoke('selectFolder')
  if (folder) {
    defaultFolder.value = folder
  }
}

const save = () => {
  const settings: Settings = {
    defaultFolder: defaultFolder.value,
    slideshowInterval: slideshowIntervalSeconds.value * 1000,
    backgroundStyle: backgroundStyle.value,
  }
  emit('save', settings)
}

const cancel = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-neutral-800 rounded-lg shadow-xl w-[500px] max-w-[90vw]">
        <div class="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 class="text-xl font-semibold text-white">Settings</h2>
          <button @click="cancel" class="p-1 hover:bg-neutral-700 rounded">
            <XMarkIcon class="size-6 text-white" />
          </button>
        </div>

        <div class="p-6 space-y-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-neutral-300">Main Folder</label>
            <div class="flex gap-2">
              <input
                type="text"
                :value="defaultFolder"
                readonly
                @click="selectFolder"
                class="flex-1 bg-neutral-700 text-white px-3 py-2 rounded cursor-pointer hover:bg-neutral-600 transition-colors"
                placeholder="Click to select folder..."
              />
              <button
                @click="selectFolder"
                class="bg-neutral-600 hover:bg-neutral-500 text-white px-3 py-2 rounded flex items-center gap-2 transition-colors"
              >
                <FolderIcon class="size-5" />
                Browse
              </button>
            </div>
            <p class="text-xs text-neutral-400">The folder containing all your album folders</p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-neutral-300">Slideshow Interval</label>
            <div class="flex items-center gap-3">
              <input
                type="number"
                v-model.number="slideshowIntervalSeconds"
                min="1"
                max="300"
                class="w-24 bg-neutral-700 text-white px-3 py-2 rounded"
              />
              <span class="text-neutral-400">seconds</span>
            </div>
            <p class="text-xs text-neutral-400">How long each image is shown in slideshow mode</p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-neutral-300">Background Style</label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  v-model="backgroundStyle"
                  value="parchment"
                  class="w-4 h-4 text-amber-600 bg-neutral-700 border-neutral-600"
                />
                <span class="text-white">Parchment</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  v-model="backgroundStyle"
                  value="black"
                  class="w-4 h-4 text-amber-600 bg-neutral-700 border-neutral-600"
                />
                <span class="text-white">Plain black</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 p-4 border-t border-neutral-700">
          <button
            @click="cancel"
            class="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button @click="save" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
