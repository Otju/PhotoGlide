<script setup lang="ts">
import { onMounted, ref } from 'vue'

const { ipcRenderer } = window.require('electron')

const folders = ref<Folders>({})

const refreshFiles = async () => {
  folders.value = await ipcRenderer.invoke('getFileNames')
}

onMounted(async () => {
  await refreshFiles()
})
</script>

<template>
  <ImageViewer :refreshFiles="refreshFiles" :folders="folders" />
</template>
