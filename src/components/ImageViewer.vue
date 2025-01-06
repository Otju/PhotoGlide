<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { split } from 'canvas-hypertxt'
import { randomImageAngle, splitAt } from '../utils'
import DateTimeInput from './DateTimeInput.vue'
import { ArrowTurnUpLeftIcon, DocumentMagnifyingGlassIcon, TrashIcon } from '@heroicons/vue/24/solid'
import dayjs, { Dayjs } from 'dayjs'
import Human, { Config } from '@vladmandic/human'
import { v4 as randomUUID } from 'uuid'
import deepEqual from 'deep-equal'

const { ipcRenderer } = window.require('electron')

const humanConfig: Partial<Config> = {
  cacheSensitivity: 0,
  modelBasePath: '../../models',
  backend: 'webgl', // webgpu might be better but not currently working on my machine
  debug: false,
  filter: { enabled: true, equalization: true, flip: false, width: 0, height: 0, autoBrightness: true },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 100, minConfidence: 0.2, return: false, iouThreshold: 0.01 },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
}

const human = new Human(humanConfig)

const props = defineProps<{
  folders: Folders
  currentFolder: string
  globalFaces: { [key: string]: GlobalFace[] }
  refreshFiles: () => Promise<void>
  closeAlbum: () => void
  setGlobalFacesForImage: (imageID: string, faces: GlobalFace[]) => Promise<void>
}>()

const sideBarWidth = 280

const defaultCaptureDate = '    :  :     :  :  '

const files = ref<string[]>([])
const imageIndex = ref<number>(-1)
const folderRenameName = ref<string>('')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const faceCanvasRef = ref<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const zoomRef = ref<number>(1)
const posRef = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const ctxRef = ref<CanvasRenderingContext2D | null>(null)
const isImage = ref<boolean>(false)
const timer = ref<NodeJS.Timeout | null>(null)
const description = ref<string>('')
const captureDate = ref<string>(defaultCaptureDate) // YYYY:MM:DD HH:mm:ss
const viewMode = ref<'album-mode' | 'edit-mode'>('edit-mode')
const calculatedFontSize = ref<number | null>(null)
const imageAngle = ref<number>(randomImageAngle())
const imageFaces = ref<GlobalFace[]>([])
const currentImageID = ref<string | null>(null)
const faceSquareStart = ref<{ x: number; y: number } | null>(null)
const isAskingForDeletionConfirmation = ref<boolean>(false)
const isImageDrawn = ref<boolean>(false)
const mouseRef = ref<{
  x: number
  y: number
  oldX: number
  oldY: number
  leftButton: boolean
  rightButton: boolean
}>({
  x: 0,
  y: 0,
  oldX: 0,
  oldY: 0,
  leftButton: false,
  rightButton: false,
})
const dateGuessBasedOnFileName = ref<string | null>(null)

const selectImage = async (fileIndex: number) => {
  imageFaces.value = []
  if (fileIndex < 0) return
  let index = fileIndex
  imageAngle.value = randomImageAngle()
  if (!files.value[index]) {
    index = 0
  }
  if (!props.currentFolder || !imageRef.value) return
  if (!files.value[index]) {
    const canvas = canvasRef.value
    const ctx = ctxRef.value
    if (!canvas || !ctx) return
    canvas.height = window.innerHeight
    canvas.width = window.innerWidth - sideBarWidth
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Draw text "No image"
    ctx.font = '30px Arial'
    ctx.fillStyle = 'white'
    ctx.fillText('No image', canvas.width / 2 - 50, canvas.height / 2)
    isImage.value = false
    return
  }
  const imageData = await ipcRenderer.invoke('getImage', props.currentFolder, files.value[index])

  if (!imageData) {
    isImage.value = false
    return
  }
  imageRef.value.src = `data:image/jpg;base64,${imageData}`
  isImage.value = true

  const {
    imageDescription,
    imageDate,
    imageID,
    imageFaces: newLocalFaces,
  } = await ipcRenderer.invoke('getImageMetadata', props.currentFolder, files.value[index])

  const localFaces = (newLocalFaces ?? []) as LocalFace[]

  const globalFaces = props.globalFaces[imageID] ?? []

  const globalFacesAsLocal: LocalFace[] = globalFaces.map(({ name, bounds }) => ({ name, bounds }))

  const localMatchesGlobal = deepEqual(localFaces, globalFacesAsLocal, { strict: true })

  if (!localMatchesGlobal) {
    if (localFaces.length > 0) {
      const newGlobalFaces = localFaces.map(({ name, bounds }) => {
        const dataUrl = getFaceDataUrl(bounds)
        return {
          name,
          bounds,
          dataUrl: dataUrl,
          id: randomUUID(),
          imageID,
        }
      })
      imageFaces.value = newGlobalFaces
      await props.setGlobalFacesForImage(imageID, newGlobalFaces)
    } else {
      imageFaces.value = globalFaces
      await setImageMetadataFaces()
    }
  } else {
    imageFaces.value = globalFaces
  }

  description.value = imageDescription ?? ''
  captureDate.value = imageDate ?? defaultCaptureDate
  currentImageID.value = imageID ?? null
}

const getFaces = async () => {
  if (!imageRef.value || !currentImageID.value) return
  imageFaces.value = []
  const imageID = currentImageID.value

  const detectionResult = await human.detect(imageRef.value)

  const otherFaces = Object.entries(props.globalFaces)
    .flatMap(([id, faces]) => (id === currentImageID.value ? [] : faces))
    .filter((face) => face.embedding) as GlobalFaceWithEmbedding[]

  const embeddingArray = otherFaces.map((face) => face.embedding)

  const newGlobalFaces: GlobalFace[] = []

  detectionResult.face.forEach((face) => {
    const { box, embedding } = face
    if (imageRef.value && embedding) {
      const bounds = scaleCoordinatesToImage({
        box,
        imageWidth: detectionResult.width,
        imageHeight: detectionResult.height,
        renderedWidth: imageRef.value.width,
        renderedHeight: imageRef.value.height,
      })

      const dataUrl = getFaceDataUrl(bounds)

      let name = ''

      const best = human.match.find(embedding, embeddingArray)
      const bestMatch = otherFaces[best.index]

      if (bestMatch && best.similarity > 0.5) {
        name = bestMatch.name
      }

      newGlobalFaces.push({ name, dataUrl, embedding, id: randomUUID(), imageID, bounds })
    }
  })

  await props.setGlobalFacesForImage(currentImageID.value, newGlobalFaces)

  imageFaces.value = newGlobalFaces
  await setImageMetadataFaces()

  drawImage({ pos: posRef.value, scale: zoomRef.value })
}

const getFaceDataUrl = ({ x, y, width, height }: Bounds) => {
  const canvas = faceCanvasRef.value
  if (!canvas || !imageRef.value) return ''
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, 100, 100)
  ctx.drawImage(imageRef.value, x, y, width, height, 0, 0, 50, 50)
  const dataUrl = canvas.toDataURL('image/jpeg')
  return dataUrl
}

const setImageMetadataFaces = async () => {
  const newLocalFaces = imageFaces.value.map(({ name, bounds }) => ({ name, bounds: { ...bounds } }))

  await ipcRenderer.invoke('setFacesForImage', props.currentFolder, currentImage(), {
    imageWidth: imageRef.value?.width || 0,
    imageHeight: imageRef.value?.height || 0,
    faces: newLocalFaces.map(({ name, bounds }) => ({ name, bounds })),
  })
}

const currentImage = () => {
  return files.value[imageIndex.value]
}

watch([() => props.currentFolder, () => props.folders], async ([folder], _) => {
  files.value = props.folders[folder]
  await selectImage(imageIndex.value)
  folderRenameName.value = folder
})

watch(imageIndex, async (index, _) => {
  await selectImage(index)
  zoomRef.value = 1
  posRef.value = { x: 0, y: 0 }
})

watch(
  () => currentImage(),
  async (image, _) => {
    dateGuessBasedOnFileName.value = getDateFromFileName(image)
  }
)

const nextImage = () => {
  if (imageIndex.value >= files.value.length - 1) {
    imageIndex.value = 0
  } else {
    imageIndex.value++
  }
  canvasRef.value?.focus()
}

const previousImage = () => {
  if (imageIndex.value <= 0) {
    imageIndex.value = files.value.length - 1
  } else {
    imageIndex.value--
  }

  canvasRef.value?.focus()
}

onMounted(async () => {
  await props.refreshFiles()
  imageIndex.value = 0

  const fontKalam = new FontFace('Kalam', 'url(Kalam.ttf)')
  document.fonts.add(fontKalam)
  fontKalam.load()

  const fontPermanentMarker = new FontFace('PermanentMarker', 'url(PermanentMarker.ttf)')
  document.fonts.add(fontPermanentMarker)
  fontPermanentMarker.load()

  imageRef.value = new Image()
  if (!canvasRef.value) return
  ctxRef.value = canvasRef.value.getContext('2d')

  ipcRenderer.on('view-mode-change', (_: any, message: string) => {
    if (message === 'edit-mode') {
      viewMode.value = 'edit-mode'
    } else if (message === 'album-mode') {
      viewMode.value = 'album-mode'
    }
  })

  canvasRef.value?.focus()

  human.load(humanConfig)
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
  canvas.width = window.innerWidth - sideBarWidth

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

  const scaleRatio = 0.6
  const x = canvas.width / 2
  const y = canvas.height / 2
  ctx.fillStyle = 'white'

  const { renderedWidth, renderedHeight, xOffset, yOffset } = calculateSizeAndOffset(image, canvas)

  const labelHeight = renderedWidth * 0.2
  const labelPercentageWidth = 0.8
  const labelWidth = renderedWidth * labelPercentageWidth
  const labelOffset = renderedWidth * 0.1

  const borderSize = renderedWidth * 0.04

  if (viewMode.value === 'edit-mode') {
    ctx.drawImage(image, 0, 0, image.width, image.height, xOffset, yOffset, renderedWidth, renderedHeight)

    if (mouseRef.value.rightButton && faceSquareStart.value) {
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2

      const { x, y, width, height } = getSquareFromMouse()

      ctx.strokeRect(x, y, width, height)
    }

    imageFaces.value.forEach((face) => {
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2

      const { x, y, width, height } = face.bounds

      const scaled = scaleCoordinatesToImage({
        box: [x, y, width, height],
        imageWidth: image.width,
        imageHeight: image.height,
        renderedWidth,
        renderedHeight,
        xOffset,
        yOffset,
      })

      ctx.strokeRect(scaled.x, scaled.y, scaled.width, scaled.height)
    })
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
      ctx.fillText(exifDateToPrettyDate(captureDate.value), tapeImage.width / 2 - 20, tapeImage.height / 4)

      ctx.restore()

      tapeScale = tapeScale * 0.8

      ctx.translate(
        renderedWidth / 2 - tapeImageWidth / 2 + xOffset,
        renderedHeight + labelOffset + yOffset - 75 * tapeScale
      )
      ctx.scale(tapeScale, tapeScale)
      ctx.drawImage(tapeImage, 0, 0)
    }
  }

  isImageDrawn.value = true
}

const getSquareFromMouse = () => {
  if (!faceSquareStart.value) return { x: 0, y: 0, width: 0, height: 0 }
  const x = faceSquareStart.value.x
  const y = faceSquareStart.value.y
  const width = Math.abs(mouseRef.value.x - x) * (mouseRef.value.x < x ? -1 : 1)
  const height = Math.abs(width) * (mouseRef.value.y < y ? -1 : 1)
  return { x, y, width, height }
}

const calculateSizeAndOffset = (image: HTMLImageElement, canvas: HTMLCanvasElement) => {
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

  return { renderedWidth, renderedHeight, xOffset, yOffset }
}

const exifDateToPrettyDate = (exifDate: string) => {
  const [date] = splitAt(10, exifDate).map((x) => x.replace(/ /g, ''))
  const [year, month, day] = date.split(':')

  if (year && month && day) {
    return `${day}.${month}.${year}`
  }

  if (year && month) {
    return `${month}.${year}`
  }

  if (year) {
    return year
  }

  return ''
}

const scaleCoordinatesToImage = ({
  box,
  imageWidth,
  imageHeight,
  renderedWidth,
  renderedHeight,
  xOffset = 0,
  yOffset = 0,
}: {
  box: [number, number, number, number]
  imageWidth: number
  imageHeight: number
  renderedWidth: number
  renderedHeight: number
  xOffset?: number
  yOffset?: number
  reverse?: boolean
}) => {
  const x = (box[0] / imageWidth) * renderedWidth + xOffset
  const y = (box[1] / imageHeight) * renderedHeight + yOffset
  const width = (box[2] / imageWidth) * renderedWidth
  const height = (box[3] / imageHeight) * renderedHeight
  return { x, y, width, height }
}

const moveItemToFolder = async (folder: string) => {
  await ipcRenderer.invoke('moveImage', currentImage(), props.currentFolder, folder)
  await props.refreshFiles()
}

const moveItemToFolderWithIndex = async (index: number) => {
  const folder = Object.keys(props.folders)[index]
  await ipcRenderer.invoke('moveImage', currentImage(), props.currentFolder, folder)
  await props.refreshFiles()
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'ArrowRight') {
    nextImage()
  } else if (event.key === 'ArrowLeft') {
    previousImage()
  } else if (
    parseInt(event.key) &&
    parseInt(event.key) > 0 &&
    parseInt(event.key) <= Object.keys(props.folders).length
  ) {
    moveItemToFolderWithIndex(parseInt(event.key) - 1)
  }
}

const handleTextAreaType = () => {
  if (timer.value) {
    clearTimeout(timer.value)
  }

  timer.value = setTimeout(async () => {
    await ipcRenderer.invoke('updateImageDescription', props.currentFolder, currentImage(), description.value)
  }, 200)
}

const handleDateTimeChange = async (newDate: string) => {
  await ipcRenderer.invoke('updateImageDate', props.currentFolder, currentImage(), newDate)
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
    if (event.button === 0) {
      mouse.leftButton = true
    } else {
      startFaceSquare()
    }
  }
  if (event.type === 'mouseup') {
    if (event.button === 0) {
      mouse.leftButton = false
    } else {
      finishFaceSquare()
    }
  }
  if (event.type === 'mouseout') {
    if (mouse.rightButton) {
      finishFaceSquare()
    }
    mouse.leftButton = false
  }
  mouse.oldX = mouse.x
  mouse.oldY = mouse.y
  mouse.x = event.offsetX
  mouse.y = event.offsetY
  if (mouse.leftButton) {
    pan({ x: mouse.x - mouse.oldX, y: mouse.y - mouse.oldY })
    drawImage({ pos: posRef.value, scale: zoomRef.value })
  }

  if (mouse.rightButton) {
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

const startFaceSquare = () => {
  const mouse = mouseRef.value
  faceSquareStart.value = { x: mouse.x, y: mouse.y }

  mouseRef.value.rightButton = true
}

const finishFaceSquare = async () => {
  mouseRef.value.rightButton = false

  if (!faceSquareStart.value || !currentImageID.value) return

  const { x, y, width, height } = getSquareFromMouse()

  const canvas = canvasRef.value
  const image = imageRef.value
  if (!canvas || !image) return

  const { renderedWidth, renderedHeight, xOffset, yOffset } = calculateSizeAndOffset(image, canvas)

  const bounds = scaleCoordinatesToImage({
    box: [x, y, width, height],
    imageWidth: renderedWidth,
    imageHeight: renderedHeight,
    renderedWidth: image.width,
    renderedHeight: image.height,
    xOffset: (-xOffset / renderedWidth) * image.width,
    yOffset: (-yOffset / renderedHeight) * image.height,
  })

  const dataUrl = getFaceDataUrl(bounds)
  const name = ''
  const imageID = currentImageID.value

  imageFaces.value.push({ name, dataUrl, id: randomUUID(), imageID, bounds })

  await props.setGlobalFacesForImage(imageID, imageFaces.value)

  await setImageMetadataFaces()

  faceSquareStart.value = null
  drawImage({ pos: posRef.value, scale: zoomRef.value })
}

const getDateFromFileName = (fileName: string) => {
  const dateMatch = fileName.match(/\d{8}/)
  if (!dateMatch) {
    return null
  }
  const dateString = dateMatch[0]
  let date = dayjs(dateString, 'YYYYMMDD')
  if (dateIsValid(date)) {
    return date.format('YYYY:MM:DD HH:mm:ss')
  }

  date = dayjs(dateString, 'DDMMYYYY')
  if (dateIsValid(date)) {
    return date.format('YYYY:MM:DD HH:mm:ss')
  }

  return null
}

const dateIsValid = (date: Dayjs) => {
  return date.isValid() && date.isAfter('1900-01-01') && date.isBefore('2100-01-01')
}

const setNewDateBasedOnFileName = async () => {
  if (dateGuessBasedOnFileName.value) {
    captureDate.value = dateGuessBasedOnFileName.value
    handleDateTimeChange(dateGuessBasedOnFileName.value)
  }
}

const handleFaceNameChange = async (id: string, newName: string) => {
  const face = imageFaces.value.find((face) => face.id === id)
  if (!face) return
  face.name = newName
  if (currentImageID.value) {
    await props.setGlobalFacesForImage(currentImageID.value, imageFaces.value)
  }
  await setImageMetadataFaces()
}

const handleFaceDelete = async (id: string) => {
  if (!currentImageID.value) return

  if (isAskingForDeletionConfirmation.value) {
    const index = imageFaces.value.findIndex((face) => face.id === id)
    const nextFace = imageFaces.value[index + 1] ?? imageFaces.value[index - 1]

    imageFaces.value = imageFaces.value.filter((face) => face.id !== id)

    await props.setGlobalFacesForImage(currentImageID.value, imageFaces.value)
    await setImageMetadataFaces()

    drawImage({ pos: posRef.value, scale: zoomRef.value })

    const idToFocus = nextFace?.id ?? 'canvas'
    const element = document.getElementById(idToFocus)

    if (element) {
      element.focus()
    }
  } else {
    isAskingForDeletionConfirmation.value = true
  }
}
</script>

<template>
  <div class="flex">
    <canvas
      ref="canvasRef"
      id="canvas"
      @keydown="handleKeyPress"
      @wheel="handleScroll"
      @mousedown="handleMouse"
      @mouseup="handleMouse"
      @mouseout="handleMouse"
      @mousemove="handleMouse"
      tabindex="1"
    ></canvas>
    <template v-if="viewMode === 'edit-mode' && isImageDrawn">
      <div class="bg-black h-[100vh] p-4 flex flex-col gap-8 overflow-y-auto" :style="{ width: sideBarWidth + 'px' }">
        <div class="flex flex-col">
          <label class="bg-white text-black w-fit px-2 rounded-t-md">Description</label>
          <textarea
            class="w-full bg-white text-black px-4 p-2 rounded-b-md rounded-r-md"
            tabindex="2"
            rows="4"
            @input="handleTextAreaType"
            v-model="description"
          ></textarea>
        </div>

        <div class="flex flex-col">
          <label class="bg-white w-fit px-2 rounded-t-md border-none">Capture Date</label>
          <div class="w-full flex">
            <DateTimeInput :onChange="handleDateTimeChange" v-model="captureDate" class="flex-1" />
            <div class="bg-white rounded-r-lg border-none p-2 h-10">
              <button
                v-if="dateGuessBasedOnFileName"
                @click="setNewDateBasedOnFileName"
                title="Guess date from filename"
                class="p-0"
              >
                <DocumentMagnifyingGlassIcon class="size-6 bg-white text-black" />
              </button>
            </div>
          </div>
        </div>

        <button @click="getFaces" class="bg-white text-black p-2 rounded-md">Detect Faces</button>

        <canvas ref="faceCanvasRef" class="hidden" width="50" height="50"></canvas>

        <div class="grid grid-cols-2 gap-3 w-full">
          <div v-for="face in imageFaces" class="text-white flex flex-col items-center w-full">
            <input
              class="bg-black text-white text-center w-full"
              :id="face.id"
              :value="face.name"
              placeholder="?"
              @blur="(event: any) => handleFaceNameChange(face.id, event.target.value)"
            />
            <div class="relative">
              <img :src="face.dataUrl" class="rounded-full w-16" />
              <button
                @click="handleFaceDelete(face.id)"
                class="absolute top-0 right-0 bg-white text-black p-1 rounded-full w-16 h-16 flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity ease-in-out duration-200"
                @blur="isAskingForDeletionConfirmation = false"
              >
                <span v-if="isAskingForDeletionConfirmation" class="font-bold text-sm">Are you sure?</span>
                <TrashIcon v-else class="size-8" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        @click="props.closeAlbum"
        class="absolute left-4 top-2 text-3xl abs-button"
        :style="{ marginRight: sideBarWidth + 'px' }"
      >
        <ArrowTurnUpLeftIcon class="size-8" />
      </button>
      <button
        @click="previousImage"
        class="absolute abs-center-y left-4 text-3xl abs-button"
        :style="{ marginRight: sideBarWidth + 'px' }"
      >
        <
      </button>
      <button
        @click="nextImage"
        class="absolute abs-center-y right-4 text-3xl abs-button"
        :style="{ marginRight: sideBarWidth + 'px' }"
      >
        >
      </button>

      <div
        class="flex flex-wrap justify-center gap-4 absolute bottom-4 w-full"
        :style="{ paddingRight: sideBarWidth + 'px' }"
      >
        <button v-for="(folder, i) in Object.keys(folders)" @click="() => moveItemToFolder(folder)" class="abs-button">
          {{ i + 1 }}. {{ folder }}
        </button>
      </div>
    </template>
  </div>
  <img src="../assets/tape.png" id="tapeImage" alt="tape" class="hidden" />
</template>
