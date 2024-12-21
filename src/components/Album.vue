<script setup lang="ts">
import { FolderOpenIcon } from '@heroicons/vue/24/solid'
import { ref, watch } from 'vue'

const { ipcRenderer } = window.require('electron')

const props = defineProps<{
  folderName: string
  thumbnail: string | undefined
  refreshFiles: () => Promise<void>
  openAlbum: (folderName: string) => void
}>()

const showRename = defineModel()

const inputRef = ref<HTMLInputElement | null>(null)
const newFolderName = ref(props.folderName)
const isUpdating = ref(false)

const showRenameInput = () => {
  showRename.value = true
}

defineExpose({
  showRenameInput,
})

watch(showRename, (show) => {
  if (show) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 0)
  }
})

watch(
  () => props.folderName,
  () => {
    isUpdating.value = false
  }
)

const handleRename = async () => {
  if (isUpdating.value) {
    return
  }
  if (props.folderName === newFolderName.value || !newFolderName.value) {
    showRename.value = false
    return
  }
  isUpdating.value = true
  await ipcRenderer.invoke('renameFolder', props.folderName, newFolderName.value)
  await props.refreshFiles()
  showRename.value = false
}
</script>

<template>
  <div class="flex flex-col items-center text-center w-40">
    <a class="relative w-32 h-32" href="#" @click="props.openAlbum(props.folderName)">
      <FolderOpenIcon class="w-full absolute" style="clip-path: inset(0px 0px 75px 0px)" />
      <img
        v-if="props.thumbnail"
        :src="`data:image/jpeg;base64, ${props.thumbnail}`"
        class="absolute w-20 bottom-11 left-6 -rotate-[20deg]"
      />
      <FolderOpenIcon class="w-full absolute" style="clip-path: inset(50px 0px 0 0px)" />
    </a>
    <h2
      v-if="!showRename"
      class="text-xl text-black font-semibold w-full h-16"
      @click="showRenameInput"
      @keydown.enter="showRenameInput"
      tabindex="0"
    >
      {{ props.folderName }}
    </h2>
    <textarea
      v-if="showRename"
      class="text-xl text-black font-semibold bg-transparent w-full text-center h-16"
      v-model="newFolderName"
      ref="inputRef"
      @blur="handleRename"
      @keydown.enter="handleRename"
    />
  </div>
</template>
