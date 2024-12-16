<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const { ipcRenderer } = window.require("electron");

const folders = ref<{ [key: string]: string[] }>({});
const files = ref<string[]>([]);
const imageIndex = ref<number>(-1);
const currentFolder = ref<string>("");
const showRename = ref<boolean>(false);
const folderRenameName = ref<string>("");
const inputRef = ref<HTMLInputElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const zoomRef = ref<number>(1);
const posRef = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const ctxRef = ref<CanvasRenderingContext2D | null>(null);
const isImage = ref<boolean>(false);
const mouseRef = ref<{
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  button: boolean;
}>({
  x: 0,
  y: 0,
  oldX: 0,
  oldY: 0,
  button: false,
});

const selectImage = async (fileIndex: number) => {
  let index = fileIndex;
  if (!files.value[index]) {
    index = 0;
  }
  if (!currentFolder.value || !imageRef.value) return;
  if (!files.value[index]) {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx) return;
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw text "No image"
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("No image", canvas.width / 2 - 50, canvas.height / 2);
    isImage.value = false;
    return;
  }
  const { imageData }: { imageData: string } = await ipcRenderer.invoke(
    "getImage",
    currentFolder.value,
    files.value[index]
  );
  if (!imageData) {
    isImage.value = false;
    return;
  }
  imageRef.value.src = `data:image/jpg;base64,${imageData}`;
  isImage.value = true;
};

const currentImage = () => {
  return files.value[imageIndex.value];
};

watch([currentFolder, folders], async ([folder], _) => {
  files.value = folders.value[folder];
  await selectImage(imageIndex.value);
  folderRenameName.value = folder;
});

watch(imageIndex, async (index, _) => {
  await selectImage(index);
  zoomRef.value = 1;
  posRef.value = { x: 0, y: 0 };
});

const nextImage = () => {
  if (imageIndex.value >= files.value.length - 1) {
    imageIndex.value = 0;
  } else {
    imageIndex.value++;
  }
};

const previousImage = () => {
  if (imageIndex.value <= 0) {
    imageIndex.value = files.value.length - 1;
  } else {
    imageIndex.value--;
  }
};

const refreshFiles = async () => {
  folders.value = await ipcRenderer.invoke("getFileNames");
};

onMounted(async () => {
  await refreshFiles();
  currentFolder.value = Object.keys(folders.value)[0];
  imageIndex.value = 0;

  imageRef.value = new Image();
  imageRef.value.onload = function () {
    drawImage({ pos: posRef.value, scale: zoomRef.value });
  };
  if (!canvasRef.value) return;
  ctxRef.value = canvasRef.value.getContext("2d");
});

watch([zoomRef, posRef], ([scale, pos]) => {
  drawImage({ scale, pos });
});

const drawImage = ({
  pos,
  scale,
}: {
  pos: { x: number; y: number };
  scale: number;
}) => {
  const canvas = canvasRef.value;
  const ctx = ctxRef.value;
  if (!ctx || !canvas || !imageRef.value || !isImage.value) return;
  const image = imageRef.value;
  canvas.height = window.innerHeight;
  canvas.width = window.innerWidth;

  const m = [1, 0, 0, 1, 0, 0]; // current view transform
  m[3] = m[0] = scale;
  m[2] = m[1] = 0;
  m[4] = pos.x;
  m[5] = pos.y;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

  let renderedWidth = 1;
  let renderedHeight = 1;
  let xOffset = 0;
  let yOffset = 0;

  const isVertical = image.height / canvas.height > image.width / canvas.width;

  if (isVertical) {
    const ratio = canvas.height / image.height;
    renderedHeight = canvas.height;
    renderedWidth = image.width * ratio;
    xOffset = (canvas.width - renderedWidth) / 2;
  } else {
    const ratio = canvas.width / image.width;
    renderedWidth = canvas.width;
    renderedHeight = image.height * ratio;
    yOffset = (canvas.height - renderedHeight) / 2;
  }

  ctx.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    xOffset,
    yOffset,
    renderedWidth,
    renderedHeight
  );
};

const moveItemToFolder = async (folder: string) => {
  await ipcRenderer.invoke(
    "moveImage",
    currentImage(),
    currentFolder.value,
    folder
  );
  await refreshFiles();
};

const moveItemToFolderWithIndex = async (index: number) => {
  const folder = Object.keys(folders.value)[index];
  await ipcRenderer.invoke(
    "moveImage",
    currentImage(),
    currentFolder.value,
    folder
  );
  await refreshFiles();
};

const createNewAlbum = async () => {
  const folderNames = Object.keys(folders.value);
  const lastNewAlbumIndex = Math.max(
    0,
    ...folderNames
      .filter((name) => name.startsWith("New Album"))
      .map((name) => parseInt(name.replace("New Album ", "")))
      .filter((item) => item)
  );
  const newAlbumName = `New Album ${lastNewAlbumIndex + 1}`;

  await ipcRenderer.invoke("createFolder", newAlbumName);
  await refreshFiles();
};

const handleShowRename = () => {
  showRename.value = true;
  setTimeout(() => {
    inputRef.value?.focus();
  }, 0);
};

const handleRename = async () => {
  if (
    folderRenameName.value === currentFolder.value ||
    !folderRenameName.value
  ) {
    showRename.value = false;
    return;
  }
  await ipcRenderer.invoke(
    "renameFolder",
    currentFolder.value,
    folderRenameName.value
  );
  await refreshFiles();
  showRename.value = false;
  currentFolder.value = folderRenameName.value;
};

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === "ArrowRight") {
    nextImage();
  } else if (event.key === "ArrowLeft") {
    previousImage();
  } else if (
    parseInt(event.key) &&
    parseInt(event.key) > 0 &&
    parseInt(event.key) <= Object.keys(folders.value).length
  ) {
    moveItemToFolderWithIndex(parseInt(event.key) - 1);
  }
};

window.addEventListener("resize", () => {
  drawImage({ pos: posRef.value, scale: zoomRef.value });
});

const handleScroll = (event: WheelEvent) => {
  event.preventDefault();
  var x = event.offsetX;
  var y = event.offsetY;
  if (event.deltaY < 0) {
    scaleAt({ x, y }, 1.1);
  } else {
    scaleAt({ x, y }, 1 / 1.1);
  }
};

const handleMouse = (event: MouseEvent) => {
  const mouse = mouseRef.value;
  if (event.type === "mousedown") {
    mouse.button = true;
  }
  if (event.type === "mouseup" || event.type === "mouseout") {
    mouse.button = false;
  }
  mouse.oldX = mouse.x;
  mouse.oldY = mouse.y;
  mouse.x = event.offsetX;
  mouse.y = event.offsetY;
  if (mouse.button) {
    pan({ x: mouse.x - mouse.oldX, y: mouse.y - mouse.oldY });
    drawImage({ pos: posRef.value, scale: zoomRef.value });
  }
};

const scaleAt = (at: { x: number; y: number }, amount: number) => {
  const pos = posRef.value;
  zoomRef.value *= amount;
  if (zoomRef.value < 1) {
    zoomRef.value = 1;
    pos.x = 0;
    pos.y = 0;
    return;
  }
  pos.x = at.x - (at.x - pos.x) * amount;
  pos.y = at.y - (at.y - pos.y) * amount;
};

const pan = (amount: { x: number; y: number }) => {
  const pos = posRef.value;
  pos.x += amount.x;
  pos.y += amount.y;
  const width = window.innerWidth * zoomRef.value;
  const height = window.innerWidth * zoomRef.value;
  if (pos.x > 0) {
    pos.x = 0;
  }
  if (pos.x < -width + window.innerWidth) {
    pos.x = -width + window.innerWidth;
  }
  if (pos.y > 0) {
    pos.y = 0;
  }
  if (pos.y < -height + window.innerHeight) {
    pos.y = -height + window.innerHeight;
  }
};
</script>

<template>
  <main class="relative">
    <div class="flex justify-center gap-4 absolute abs-center-x top-4">
      <input
        v-if="showRename"
        type="text"
        v-model="folderRenameName"
        @blur="handleRename"
        ref="inputRef"
      />
      <select
        v-else
        v-model="currentFolder"
        class="w-fit"
        @dblclick="handleShowRename"
      >
        <option v-for="folder in Object.keys(folders)" :value="folder">
          {{ folder }}
        </option>
      </select>
      <button @click="createNewAlbum">+</button>
    </div>
    <button
      @click="previousImage"
      class="absolute abs-center-y left-4 text-3xl"
    >
      <
    </button>
    <button @click="nextImage" class="absolute abs-center-y right-4 text-3xl">
      >
    </button>
    <div
      class="flex flex-col items-center gap-4 absolute abs-center-x bottom-4 w-full"
    >
      <h3 class="bg-black rounded-lg p-2">Move item to Album</h3>
      <div class="flex flex-wrap gap-4">
        <button
          v-for="(folder, i) in Object.keys(folders)"
          @click="() => moveItemToFolder(folder)"
        >
          {{ i + 1 }}. {{ folder }}
        </button>
      </div>
    </div>
    <canvas
      ref="canvasRef"
      @keydown="handleKeyPress"
      @wheel="handleScroll"
      @mousedown="handleMouse"
      @mouseup="handleMouse"
      @mouseout="handleMouse"
      @mousemove="handleMouse"
      tabindex="0"
    ></canvas>
  </main>
</template>
