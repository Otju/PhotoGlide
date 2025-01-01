type Folders = { [key: string]: string[] }

type FaceDetection = {
  _box: {
    _x: number
    _y: number
    _width: number
    _height: number
  }
}

type Face = {
  id: string
  name: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  imageID: string
  dataUrl: string
  embedding: number[]
}
