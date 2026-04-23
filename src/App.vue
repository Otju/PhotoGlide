<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import ImageViewer from './components/ImageViewer.vue'
import Album from './components/Album.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { FolderPlusIcon } from '@heroicons/vue/24/solid'
const { ipcRenderer } = window.require('electron')

type Settings = {
  defaultFolder: string
  slideshowInterval: number
  backgroundStyle: 'parchment' | 'black'
}

const folders = ref<Folders>({})
const currentFolder = ref<string | null>(null)
const thumbnails = ref<{ [key: string]: string }>({})
const albumHasRenameInputOpen = ref<{ [key: string]: boolean }>({})
const globalFaces = ref<{ [key: string]: GlobalFace[] }>({})
const showSettingsDialog = ref(false)
const mainFolderName = ref<string>('')
const settings = ref<Settings>({
  defaultFolder: '',
  slideshowInterval: 10000,
  backgroundStyle: 'parchment',
})

const backgroundClass = computed(() => {
  return settings.value.backgroundStyle === 'black' ? 'black-background' : 'parchment-background'
})

const sortedFolderNames = computed(() => {
  return Object.keys(folders.value)
    .filter((name) => name !== '')
    .sort((a, b) => a.localeCompare(b))
})

const getDisplayName = (folderName: string) => {
  if (folderName === '') {
    return `${mainFolderName.value} (Main)`
  }
  return folderName
}

const hasRootAlbum = computed(() => {
  return '' in folders.value && folders.value[''].length > 0
})

onMounted(async () => {
  const loadedSettings = await ipcRenderer.invoke('getSettings')
  settings.value = loadedSettings
  mainFolderName.value = await ipcRenderer.invoke('getMainFolderName')

  await refreshFiles()

  const firstFiles = Object.entries(folders.value).map(([folderName, files]) => ({
    folderName: folderName,
    file: files[0],
  }))

  for (const { folderName, file } of firstFiles) {
    if (!file) continue
    const imagePath = await ipcRenderer.invoke('getImagePath', folderName, file)
    thumbnails.value[folderName] = `photo:///${imagePath.replace(/\\\\/g, '/')}`
  }

  const faces: { [key: string]: GlobalFace[] } = await ipcRenderer.invoke('getFaces')
  globalFaces.value = faces

  ipcRenderer.on('refresh-files', async () => {
    await refreshFiles()
  })

  ipcRenderer.on('open-settings', () => {
    showSettingsDialog.value = true
  })
})

const handleSaveSettings = async (newSettings: Settings) => {
  await ipcRenderer.invoke('saveSettings', newSettings)
  settings.value = newSettings
  showSettingsDialog.value = false
}

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
  currentFolder.value = null
}

const setGlobalFacesForImage = async (imageID: string, faces: GlobalFace[]) => {
  globalFaces.value[imageID] = faces
  await ipcRenderer.invoke('setFaces', JSON.stringify(globalFaces.value))
}
</script>

<template>
  <main class="relative min-h-[100vh] w-[100vw]" :class="backgroundClass">
    <div v-if="currentFolder === null" class="flex flex-wrap gap-x-12 gap-y-8 py-8 px-24">
      <Album
        v-if="hasRootAlbum"
        :folderName="''"
        :displayName="getDisplayName('')"
        :thumbnail="thumbnails['']"
        :refreshFiles="refreshFiles"
        :openAlbum="openAlbum"
        :fileCount="folders[''].length"
        :backgroundStyle="settings.backgroundStyle"
      />
      <template v-for="folderName in sortedFolderNames" :key="folderName">
        <Album
          v-model="albumHasRenameInputOpen[folderName]"
          :folderName="folderName"
          :displayName="getDisplayName(folderName)"
          :thumbnail="thumbnails[folderName]"
          :refreshFiles="refreshFiles"
          :openAlbum="openAlbum"
          :fileCount="folders[folderName].length"
          :backgroundStyle="settings.backgroundStyle"
        />
      </template>
      <div class="flex flex-col items-center text-center justify-center w-40">
        <button @click="createNewAlbum" class="bg-transparent p-0 w-32 h-32">
          <FolderPlusIcon class="text-white" />
        </button>
        <h2 class="text-xl font-semibold w-full h-16" :class="settings.backgroundStyle === 'black' ? 'text-white' : 'text-black'">New album</h2>
      </div>
    </div>
    <ImageViewer
      v-if="currentFolder !== null"
      :refreshFiles="refreshFiles"
      :folders="folders"
      :currentFolder="currentFolder"
      :closeAlbum="closeAlbum"
      :globalFaces="globalFaces"
      :setGlobalFacesForImage="setGlobalFacesForImage"
      :sortedFolderNames="sortedFolderNames"
      :slideshowInterval="settings.slideshowInterval"
    />
    <SettingsDialog
      :visible="showSettingsDialog"
      @close="showSettingsDialog = false"
      @save="handleSaveSettings"
    />
  </main>
</template>
