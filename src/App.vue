<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { split } from 'canvas-hypertxt'

const { ipcRenderer } = window.require('electron')

const exifDateFormat = 'YYYY:MM:DD HH:mm:ss'
const inputDateFormat = 'YYYY-MM-DDTHH:mm:ss'

const possibleImageAngles = [-0.07, -0.06, -0.05, 0.05, 0.06, 0.07]

const randomImageAngle = () => {
  return possibleImageAngles[Math.floor(Math.random() * possibleImageAngles.length)]
}

const folders = ref<{ [key: string]: string[] }>({})
const files = ref<string[]>([])
const imageIndex = ref<number>(-1)
const currentFolder = ref<string>('')
const showRename = ref<boolean>(false)
const folderRenameName = ref<string>('')
const inputRef = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const zoomRef = ref<number>(1)
const posRef = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const ctxRef = ref<CanvasRenderingContext2D | null>(null)
const isImage = ref<boolean>(false)
const timer = ref<NodeJS.Timeout | null>(null)
const description = ref<string>('')
const captureDate = ref<string>('2000-01-01T00:00')
const viewMode = ref<'album-mode' | 'edit-mode'>('album-mode')
const calculatedFontSize = ref<number | null>(null)
const imageAngle = ref<number>(randomImageAngle())
const mouseRef = ref<{
  x: number
  y: number
  oldX: number
  oldY: number
  button: boolean
}>({
  x: 0,
  y: 0,
  oldX: 0,
  oldY: 0,
  button: false,
})

const selectImage = async (fileIndex: number) => {
  let index = fileIndex
  imageAngle.value = randomImageAngle()
  if (!files.value[index]) {
    index = 0
  }
  if (!currentFolder.value || !imageRef.value) return
  if (!files.value[index]) {
    const canvas = canvasRef.value
    const ctx = ctxRef.value
    if (!canvas || !ctx) return
    canvas.height = window.innerHeight
    canvas.width = window.innerWidth
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Draw text "No image"
    ctx.font = '30px Arial'
    ctx.fillStyle = 'white'
    ctx.fillText('No image', canvas.width / 2 - 50, canvas.height / 2)
    isImage.value = false
    return
  }
  const { imageData, imageDescription, imageDate }: { imageData: string; imageDescription: string; imageDate: string } =
    await ipcRenderer.invoke('getImage', currentFolder.value, files.value[index])

  description.value = imageDescription
  captureDate.value = dayjs(imageDate, exifDateFormat).format(inputDateFormat)

  if (!imageData) {
    isImage.value = false
    return
  }
  imageRef.value.src = `data:image/jpg;base64,${imageData}`
  isImage.value = true
}

const currentImage = () => {
  return files.value[imageIndex.value]
}

watch([currentFolder, folders], async ([folder], _) => {
  files.value = folders.value[folder]
  await selectImage(imageIndex.value)
  folderRenameName.value = folder
})

watch(imageIndex, async (index, _) => {
  await selectImage(index)
  zoomRef.value = 1
  posRef.value = { x: 0, y: 0 }
})

const nextImage = () => {
  if (imageIndex.value >= files.value.length - 1) {
    imageIndex.value = 0
  } else {
    imageIndex.value++
  }

  const canvas = canvasRef.value
  canvas?.focus()
}

const previousImage = () => {
  if (imageIndex.value <= 0) {
    imageIndex.value = files.value.length - 1
  } else {
    imageIndex.value--
  }

  const canvas = canvasRef.value
  canvas?.focus()
}

const refreshFiles = async () => {
  folders.value = await ipcRenderer.invoke('getFileNames')
}

onMounted(async () => {
  await refreshFiles()
  currentFolder.value = Object.keys(folders.value)[0]
  imageIndex.value = 0

  imageRef.value = new Image()
  imageRef.value.onload = function () {
    drawImage({ pos: posRef.value, scale: zoomRef.value })
  }
  if (!canvasRef.value) return
  ctxRef.value = canvasRef.value.getContext('2d')

  ipcRenderer.on('view-mode-change', (_: any, message: string) => {
    if (message === 'edit-mode') {
      viewMode.value = 'edit-mode'
    } else if (message === 'album-mode') {
      viewMode.value = 'album-mode'
    }
  })
})

watch([zoomRef, posRef, viewMode], ([scale, pos]) => {
  drawImage({ scale, pos })
})

watch([description], () => {
  calculatedFontSize.value = null
})

const drawImage = ({ pos, scale }: { pos: { x: number; y: number }; scale: number }) => {
  const canvas = canvasRef.value
  const ctx = ctxRef.value
  if (!ctx || !canvas || !imageRef.value || !isImage.value) return
  const image = imageRef.value
  canvas.height = window.innerHeight
  canvas.width = window.innerWidth

  if (canvas.height < 200 || canvas.width < 200) {
    return
  }

  const m = [1, 0, 0, 1, 0, 0] // current view transform
  m[3] = m[0] = scale
  m[2] = m[1] = 0
  m[4] = pos.x
  m[5] = pos.y
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])

  let renderedWidth = 1
  let renderedHeight = 1
  let xOffset = 0
  let yOffset = 0

  const isVertical = image.height / canvas.height > image.width / canvas.width

  if (isVertical) {
    const ratio = canvas.height / image.height
    renderedHeight = canvas.height
    renderedWidth = image.width * ratio
    xOffset = (canvas.width - renderedWidth) / 2
  } else {
    const ratio = canvas.width / image.width
    renderedWidth = canvas.width
    renderedHeight = image.height * ratio
    yOffset = (canvas.height - renderedHeight) / 2
  }

  const scaleRatio = 0.6
  const x = canvas.width / 2
  const y = canvas.height / 2
  ctx.fillStyle = 'white'

  const labelHeight = renderedWidth * 0.2
  const labelPercentageWidth = 0.8
  const labelWidth = renderedWidth * labelPercentageWidth
  const labelOffset = renderedWidth * 0.1

  const borderSize = renderedWidth * 0.04

  if (viewMode.value === 'edit-mode') {
    ctx.drawImage(image, 0, 0, image.width, image.height, xOffset, yOffset, renderedWidth, renderedHeight)
  } else {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(imageAngle.value)
    ctx.scale(scaleRatio, scaleRatio)
    ctx.translate(-x, -y)
    ctx.translate(0, -renderedHeight * scaleRatio * 0.25)
    ctx.fillRect(
      -borderSize + xOffset,
      -borderSize + yOffset,
      renderedWidth + 2 * borderSize,
      renderedHeight + 2 * borderSize
    )
    ctx.drawImage(image, 0, 0, image.width, image.height, xOffset, yOffset, renderedWidth, renderedHeight)
    ctx.fillRect(
      -borderSize + xOffset + ((1 - labelPercentageWidth) * renderedWidth) / 2,
      renderedHeight + yOffset + labelOffset,
      labelWidth + 2 * borderSize,
      labelHeight
    )
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const text = description.value

    if (text) {
      let fontSize = calculatedFontSize.value || 120
      let font = `${fontSize}px Kalam`

      let lines = split(ctx, text, font, labelWidth, true)
      let lineHeight = fontSize * 1.2

      if (!calculatedFontSize.value) {
        while (lines.length * lineHeight > labelHeight - 1.5 * lineHeight) {
          fontSize -= 5
          lineHeight = fontSize * 1.2
          font = `${fontSize}px Kalam`
          ctx.font = font
          lines = split(ctx, text, font, labelWidth, true)
        }

        calculatedFontSize.value = fontSize
      }

      ctx.font = font

      let textYOffset = 0
      const lineCount = lines.length
      const totalTextHeight = lineCount * lineHeight

      for (const line of lines) {
        ctx.fillText(
          line,
          x,
          yOffset + renderedHeight + labelHeight / 2 - totalTextHeight / 2 + lineHeight / 8 + labelOffset + textYOffset
        )
        textYOffset += lineHeight
      }
    }

    const tapeImage = document.getElementById('tapeImage') as HTMLImageElement

    if (tapeImage) {
      let tapeScale = renderedWidth * 0.00025 * 2.75
      const tapeImageWidth = tapeImage.width * tapeScale
      const tapeImageHeight = tapeImage.height * tapeScale

      ctx.globalAlpha = 0.8
      ctx.font = '65px PermanentMarker'

      ctx.save()
      ctx.translate(renderedWidth / 2 - tapeImageWidth / 2 + xOffset, -tapeImageHeight * 1.15 + yOffset)
      ctx.scale(tapeScale, tapeScale)
      ctx.drawImage(tapeImage, 0, 0)
      ctx.fillText(dayjs(captureDate.value).format('D.M.YYYY'), tapeImage.width / 2 - 20, tapeImage.height / 4)

      ctx.restore()

      tapeScale = tapeScale * 0.8

      ctx.translate(
        renderedWidth / 2 - tapeImageWidth / 2 + xOffset,
        renderedHeight + labelOffset + yOffset - 75 * tapeScale
      )
      ctx.scale(tapeScale, tapeScale)
      ctx.drawImage(tapeImage, 0, 0)
    }

    //ctx.restore()
    //ctx.rotate(-imageAngle)
  }
}

const moveItemToFolder = async (folder: string) => {
  await ipcRenderer.invoke('moveImage', currentImage(), currentFolder.value, folder)
  await refreshFiles()
}

const moveItemToFolderWithIndex = async (index: number) => {
  const folder = Object.keys(folders.value)[index]
  await ipcRenderer.invoke('moveImage', currentImage(), currentFolder.value, folder)
  await refreshFiles()
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
}

const handleShowRename = () => {
  showRename.value = true
  setTimeout(() => {
    inputRef.value?.focus()
  }, 0)
}

const handleRename = async () => {
  if (folderRenameName.value === currentFolder.value || !folderRenameName.value) {
    showRename.value = false
    return
  }
  await ipcRenderer.invoke('renameFolder', currentFolder.value, folderRenameName.value)
  await refreshFiles()
  showRename.value = false
  currentFolder.value = folderRenameName.value
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'ArrowRight') {
    nextImage()
  } else if (event.key === 'ArrowLeft') {
    previousImage()
  } else if (
    parseInt(event.key) &&
    parseInt(event.key) > 0 &&
    parseInt(event.key) <= Object.keys(folders.value).length
  ) {
    moveItemToFolderWithIndex(parseInt(event.key) - 1)
  }
}

const handleTextAreaType = () => {
  if (timer.value) {
    clearTimeout(timer.value)
  }

  timer.value = setTimeout(async () => {
    await ipcRenderer.invoke('updateImageDescription', currentFolder.value, currentImage(), description.value)
  }, 200)
}

const handleDateTimeChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const date = dayjs(target.value).format(exifDateFormat)
  await ipcRenderer.invoke('updateImageDate', currentFolder.value, currentImage(), date)
}

window.addEventListener('resize', () => {
  drawImage({ pos: posRef.value, scale: zoomRef.value })
  calculatedFontSize.value = null
})

const handleScroll = (event: WheelEvent) => {
  event.preventDefault()
  var x = event.offsetX
  var y = event.offsetY
  if (event.deltaY < 0) {
    scaleAt({ x, y }, 1.1)
  } else {
    scaleAt({ x, y }, 1 / 1.1)
  }
}

const handleMouse = (event: MouseEvent) => {
  const mouse = mouseRef.value
  if (event.type === 'mousedown') {
    mouse.button = true
  }
  if (event.type === 'mouseup' || event.type === 'mouseout') {
    mouse.button = false
  }
  mouse.oldX = mouse.x
  mouse.oldY = mouse.y
  mouse.x = event.offsetX
  mouse.y = event.offsetY
  if (mouse.button) {
    pan({ x: mouse.x - mouse.oldX, y: mouse.y - mouse.oldY })
    drawImage({ pos: posRef.value, scale: zoomRef.value })
  }
}

const scaleAt = (at: { x: number; y: number }, amount: number) => {
  const pos = posRef.value
  zoomRef.value *= amount
  if (zoomRef.value < 1) {
    zoomRef.value = 1
    pos.x = 0
    pos.y = 0
    return
  }
  pos.x = at.x - (at.x - pos.x) * amount
  pos.y = at.y - (at.y - pos.y) * amount
}

const pan = (amount: { x: number; y: number }) => {
  const pos = posRef.value
  pos.x += amount.x
  pos.y += amount.y
  const width = window.innerWidth * zoomRef.value
  const height = window.innerWidth * zoomRef.value
  if (pos.x > 0) {
    pos.x = 0
  }
  if (pos.x < -width + window.innerWidth) {
    pos.x = -width + window.innerWidth
  }
  if (pos.y > 0) {
    pos.y = 0
  }
  if (pos.y < -height + window.innerHeight) {
    pos.y = -height + window.innerHeight
  }
}
</script>

<template>
  <main class="relative parchment-background">
    <template v-if="viewMode === 'edit-mode'">
      <div class="flex justify-center gap-4 absolute abs-center-x top-4">
        <input v-if="showRename" type="text" v-model="folderRenameName" @blur="handleRename" ref="inputRef" />
        <select v-else v-model="currentFolder" class="w-fit" @dblclick="handleShowRename">
          <option v-for="folder in Object.keys(folders)" :value="folder">
            {{ folder }}
          </option>
        </select>
        <button @click="createNewAlbum">+</button>
      </div>
      <button @click="previousImage" class="absolute abs-center-y left-4 text-3xl"><</button>
      <button @click="nextImage" class="absolute abs-center-y right-4 text-3xl" tabindex="4">></button>
      <div class="flex flex-col items-center gap-4 absolute abs-center-x bottom-4 w-full">
        <div class="w-full flex flex-col justify-center px-40">
          <label class="bg-black w-fit px-2 rounded-t-md">Description</label>
          <textarea
            class="w-full bg-black px-4 p-2 rounded-b-md rounded-r-md"
            tabindex="2"
            @input="handleTextAreaType"
            v-model="description"
          ></textarea>
        </div>

        <div class="w-full flex flex-col justify-center px-40">
          <label class="bg-black w-fit px-2 rounded-t-md">Capture Date</label>
          <input
            type="datetime-local"
            class="w-full bg-black px-4 p-2 rounded-none rounded-b-md rounded-r-md"
            tabindex="3"
            @change="handleDateTimeChange"
            v-model="captureDate"
            step="1"
          />
        </div>

        <div class="flex flex-wrap gap-4">
          <button v-for="(folder, i) in Object.keys(folders)" @click="() => moveItemToFolder(folder)">
            {{ i + 1 }}. {{ folder }}
          </button>
        </div>
      </div>
    </template>
    <canvas
      ref="canvasRef"
      @keydown="handleKeyPress"
      @wheel="handleScroll"
      @mousedown="handleMouse"
      @mouseup="handleMouse"
      @mouseout="handleMouse"
      @mousemove="handleMouse"
      tabindex="1"
    ></canvas>
  </main>
  <img src="./assets/tape.png" id="tapeImage" alt="tape" class="hidden" />
</template>
