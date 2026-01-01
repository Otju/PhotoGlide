<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ImageViewer from './components/ImageViewer.vue'
import Album from './components/Album.vue'
import { FolderPlusIcon } from '@heroicons/vue/24/solid'
const { ipcRenderer } = window.require('electron')

const folders = ref<Folders>({})
const currentFolder = ref<string>('')
const thumbnails = ref<{ [key: string]: string }>({})
const albumHasRenameInputOpen = ref<{ [key: string]: boolean }>({})
const globalFaces = ref<{ [key: string]: GlobalFace[] }>({})

onMounted(async () => {
  await refreshFiles()

  const firstFiles = Object.entries(folders.value).map(([folderName, files]) => ({
    folderName: folderName,
    file: files[0],
  }))

  for (const { folderName, file } of firstFiles) {
    if (!file) continue
    const imageData = await ipcRenderer.invoke('getImage', folderName, file)
    thumbnails.value[folderName] = imageData
  }

  const faces: { [key: string]: GlobalFace[] } = await ipcRenderer.invoke('getFaces')
  globalFaces.value = faces

  ipcRenderer.on('refresh-files', async () => {
    await refreshFiles()
  })
})

const createNewAlbum = async () => {
  const folderNames = Object.keys(folders.value)
  const lastNewAlbumIndex = Math.max(
    0,
    ...folderNames
      .filter((name) => name.startsWith('New Album'))
      .map((name) => parseInt(name.replace('New Album ', '')))
      .filter((item) => item)
  )
  const newAlbumName = `New Album ${lastNewAlbumIndex + 1}`

  await ipcRenderer.invoke('createFolder', newAlbumName)
  await refreshFiles()
  albumHasRenameInputOpen.value[newAlbumName] = true
}

const refreshFiles = async () => {
  folders.value = await ipcRenderer.invoke('getFileNames')
}

const openAlbum = (folderName: string) => {
  currentFolder.value = folderName
}

const closeAlbum = () => {
  currentFolder.value = ''
}

const setGlobalFacesForImage = async (imageID: string, faces: GlobalFace[]) => {
  globalFaces.value[imageID] = faces
  await ipcRenderer.invoke('setFaces', JSON.stringify(globalFaces.value))
}
</script>

<template>
  <main class="relative parchment-background min-h-[100vh] w-[100vw]">
    <div v-if="!currentFolder" class="flex flex-wrap gap-x-12 gap-y-8 py-8 px-24">
      <template v-for="(files, folderName) in folders" :key="folderName">
        <Album
          v-model="albumHasRenameInputOpen[folderName]"
          :folderName="folderName.toString()"
          :thumbnail="thumbnails[folderName]"
          :refreshFiles="refreshFiles"
          :openAlbum="openAlbum"
          :fileCount="files.length"
        />
      </template>
      <div class="flex flex-col items-center text-center justify-center w-40">
        <button @click="createNewAlbum" class="bg-transparent p-0 w-32 h-32">
          <FolderPlusIcon class="text-white" />
        </button>
        <h2 class="text-xl text-black font-semibold w-full h-16">New album</h2>
      </div>
    </div>
    <ImageViewer
      v-if="currentFolder"
      :refreshFiles="refreshFiles"
      :folders="folders"
      :currentFolder="currentFolder"
      :closeAlbum="closeAlbum"
      :globalFaces="globalFaces"
      :setGlobalFacesForImage="setGlobalFacesForImage"
    />
  </main>
</template>
