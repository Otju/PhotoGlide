import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import fs from 'fs'
import piexif, { TagValues } from 'piexif-ts'
import Store from 'electron-store'

const store = new Store()

let defaultFolder = store.get('defaultFolder')

const imageFileEndings = ['.png', '.jpg', '.jpeg']

const getFileEnding = (fileName) => {
  return fileName.slice(fileName.lastIndexOf('.'))
}

const fileIsViewableImage = (fileName) => {
  const fileEnding = getFileEnding(fileName).toLowerCase()
  return imageFileEndings.includes(fileEnding)
}

const getFolders = () => {
  return fs.readdirSync(defaultFolder).filter((file) => {
    return fs.lstatSync(`${defaultFolder}\\${file}`).isDirectory()
  })
}

const moveFile = (filename, startFolder, endFolder) => {
  var oldPath = `${defaultFolder}\\${startFolder}\\${filename}`
  var newPath = `${defaultFolder}\\${endFolder}\\${filename}`
  fs.rename(oldPath, newPath, function (err) {
    if (err) throw err
    console.log(`Successfully moved ${filename} from ${startFolder} to ${endFolder}`)
  })
}

const getFileNames = () => {
  const fileNames = {}
  getFolders().forEach((folder) => {
    const path = `${defaultFolder}\\${folder}`

    if (!fileNames[folder]) {
      fileNames[folder] = []
    }

    fs.readdirSync(path).forEach((file) => {
      if (fileIsViewableImage(file)) {
        fileNames[folder].push(file)
      }
    })
  })
  return fileNames
}

const getImageData = (folderName, imageName) => {
  const path = `${defaultFolder}\\${folderName}\\${imageName}`
  const raw = fs.readFileSync(path)
  const imageData = raw.toString('base64')
  const binary = raw.toString('binary')
  const exif = piexif.load(binary)
  const imageDescription = exif['0th'][TagValues.ImageIFD.ImageDescription]
  const imageDate = exif['Exif'][TagValues.ExifIFD.DateTimeOriginal]
  return { imageData, imageDescription, imageDate }
}

const updateImageMetaData = (folderName, imageName, metadataCategory, metadataTag, newValue) => {
  const path = `${defaultFolder}\\${folderName}\\${imageName}`
  const raw = fs.readFileSync(path)
  const binary = raw.toString('binary')
  const exif = piexif.load(binary)
  exif[metadataCategory][metadataTag] = newValue
  const exifBytes = piexif.dump(exif)
  const newData = piexif.insert(exifBytes, binary)
  fs.writeFileSync(path, Buffer.from(newData, 'binary'))
}

const updateImageDescription = (folderName, imageName, newDescription) => {
  updateImageMetaData(folderName, imageName, '0th', TagValues.ImageIFD.ImageDescription, newDescription)
}

const updateImageDate = (folderName, imageName, newDate) => {
  updateImageMetaData(folderName, imageName, 'Exif', TagValues.ExifIFD.DateTimeOriginal, newDate)
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  win.loadURL('http://localhost:5173/')

  let menuTemplate = [
    {
      label: 'File',
      submenu: [{ label: 'Select folder', click: setDefaultFolder }],
    },
    {
      label: 'View',
      submenu: [
        {
          id: 'edit-mode',
          label: 'Edit mode',
          type: 'radio',
          checked: true,
          click: () => selectMode('edit-mode'),
        },
        {
          id: 'album-mode',
          label: 'Album mode',
          type: 'radio',
          click: () => selectMode('album-mode'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  win.webContents.openDevTools()

  const selectMode = (mode) => {
    const item = menu.getMenuItemById(mode)
    item.checked = true
    win.webContents.send('view-mode-change', mode)
  }
}

const setDefaultFolder = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a folder for all your albums',
  })
  if (result.filePaths[0]) {
    defaultFolder = result.filePaths[0]
    store.set('defaultFolder', defaultFolder)
  }
}

app.whenReady().then(async () => {
  if (!defaultFolder) {
    await setDefaultFolder()
  }

  createWindow()

  ipcMain.handle('readFile', async (event, fileName) => {
    try {
      return fs.readFileSync(`${defaultFolder}${fileName}`, 'utf-8')
    } catch (_) {
      console.error(`Can't find file ${fileName}`)
      return null
    }
  })

  ipcMain.handle('getFileNames', (event) => {
    const fileNames = getFileNames()
    return fileNames
  })

  ipcMain.handle('getImage', (event, folderName, imageName) => {
    return getImageData(folderName, imageName)
  })

  ipcMain.handle('updateImageDescription', (event, folderName, imageName, newDescription) => {
    return updateImageDescription(folderName, imageName, newDescription)
  })

  ipcMain.handle('updateImageDate', (event, folderName, imageName, newDate) => {
    return updateImageDate(folderName, imageName, newDate)
  })

  ipcMain.handle('moveImage', (event, fileName, startFolder, endFolder) => {
    return moveFile(fileName, startFolder, endFolder)
  })

  ipcMain.handle('createFolder', (event, folderName) => {
    fs.mkdirSync(`${defaultFolder}\\${folderName}`)
  })

  ipcMain.handle('renameFolder', (event, oldName, newName) => {
    fs.renameSync(`${defaultFolder}\\${oldName}`, `${defaultFolder}\\${newName}`)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
