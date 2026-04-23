<script setup lang="ts">
import { FolderOpenIcon, XMarkIcon } from '@heroicons/vue/24/solid'
import { ref, watch } from 'vue'

const { ipcRenderer } = window.require('electron')

const props = defineProps<{
  folderName: string
  displayName?: string
  thumbnail: string | undefined
  fileCount: number
  refreshFiles: () => Promise<void>
  openAlbum: (folderName: string) => void
  backgroundStyle: 'parchment' | 'black'
}>()

const isRootAlbum = props.folderName === ''

const inputRef = ref<HTMLInputElement | null>(null)
const newFolderName = ref(props.folderName)
const showRename = ref(false)

const externalShowRename = defineModel<boolean>()

const showRenameInput = () => {
  if (isRootAlbum) return
  showRename.value = true
}

watch(
  externalShowRename,
  (value) => {
    setTimeout(() => {
      showRename.value = value || false
    }, 100)
  },
  {
    immediate: true,
  }
)

watch(showRename, () => {
  if (showRename.value) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 0)
  }
})

const handleRename = async () => {
  setTimeout(async () => {
    if (props.folderName === newFolderName.value || !newFolderName.value) {
      showRename.value = false
      return
    }

    await ipcRenderer.invoke('renameFolder', props.folderName, newFolderName.value)
    await props.refreshFiles()
    showRename.value = false
  }, 100)
}

const blurInput = () => {
  inputRef.value?.blur()
}

const handleDelete = async () => {
  if (props.fileCount > 0) {
    const response = confirm(
      `Are you sure you want to delete this album? This will PERMANETELY DELETE ALL ${props.fileCount} IMAGES in the album.`
    )
    if (!response) {
      return
    }
  }

  await ipcRenderer.invoke('deleteFolder', props.folderName)
  await props.refreshFiles()
}
</script>

<template>
  <div class="text-white flex flex-col items-center text-center w-40">
    <a class="relative w-32 h-32" href="#" @click="props.openAlbum(props.folderName)">
      <FolderOpenIcon class="w-full absolute" style="clip-path: inset(0px 0px 75px 0px)" />
      <img v-if="props.thumbnail" :src="props.thumbnail" class="absolute w-20 bottom-11 left-6 -rotate-[20deg]" />
      <FolderOpenIcon class="w-full absolute" style="clip-path: inset(50px 0px 0 0px)" />
      <button v-if="showRename && !isRootAlbum" class="absolute top-0 -right-2 bg-transparent p-0">
        <XMarkIcon class="text-red-600 size-7 z-100" @click.prevent.stop="handleDelete" />
      </button>
    </a>
    <div>
      <h2
        v-if="!showRename"
        class="text-xl font-semibold w-full"
        :class="props.backgroundStyle === 'black' ? 'text-white' : 'text-black'"
        @click="showRenameInput"
        @keydown.enter="showRenameInput"
        tabindex="0"
      >
        {{ props.displayName || props.folderName }}
        <p class="text-sm text-gray-500 font-normal ml-1">({{ props.fileCount }})</p>
      </h2>
      <textarea
        v-if="showRename"
        class="text-xl font-semibold bg-transparent w-full text-center"
        :class="props.backgroundStyle === 'black' ? 'text-white' : 'text-black'"
        v-model="newFolderName"
        ref="inputRef"
        @blur="handleRename"
        @keydown.enter="blurInput"
      />
    </div>
  </div>
</template>
