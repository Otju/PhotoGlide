type Folders = { [key: string]: string[] }

type GlobalFace = {
  id: string
  name: string
  bounds: Bounds
  imageID: string
  dataUrl: string
  embedding?: number[]
}

type GlobalFaceWithEmbedding = GlobalFace & { embedding: number[] }

type LocalFace = {
  name: string
  bounds: Bounds
}

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}
