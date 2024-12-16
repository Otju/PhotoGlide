import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from "fs";

let defaultFolder = null;

const nonRawFileEndings = [".png", ".jpg", ".jpeg"];

const getFileEnding = (fileName) => {
  return fileName.slice(fileName.lastIndexOf("."));
};

const getFileBaseName = (fileName) => {
  return fileName.slice(0, fileName.lastIndexOf("."));
};

const fileIsViewableImage = (fileName) => {
  const fileEnding = getFileEnding(fileName).toLowerCase();
  return nonRawFileEndings.includes(fileEnding);
};

const getFolders = () => {
  return fs.readdirSync(defaultFolder).filter((file) => {
    return fs.lstatSync(`${defaultFolder}\\${file}`).isDirectory();
  });
};

const moveFile = (filename, startFolder, endFolder) => {
  var oldPath = `${defaultFolder}\\${startFolder}\\${filename}`;
  var newPath = `${defaultFolder}\\${endFolder}\\${filename}`;
  fs.rename(oldPath, newPath, function (err) {
    if (err) throw err;
    console.log(
      `Successfully moved ${filename} from ${startFolder} to ${endFolder}`
    );
  });
};

const moveAllVersionsOfImage = (filename, startFolder, endFolder) => {
  const fileBaseName = getFileBaseName(filename);
  const originalFolderPath = `${defaultFolder}\\${startFolder}`;
  const allVersionsOfImage = fs
    .readdirSync(originalFolderPath)
    .filter((item) => getFileBaseName(item) === fileBaseName);
  console.log(allVersionsOfImage);
  allVersionsOfImage.forEach((version) => {
    moveFile(version, startFolder, endFolder);
  });
};

const getFileNames = () => {
  const fileNames = {};
  getFolders().forEach((folder) => {
    const path = `${defaultFolder}\\${folder}`;

    if (!fileNames[folder]) {
      fileNames[folder] = [];
    }

    fs.readdirSync(path).forEach((file) => {
      if (fileIsViewableImage(file)) {
        fileNames[folder].push(file);
      }
    });
  });
  return fileNames;
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadURL("http://localhost:5173/");
};

app.whenReady().then(async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select a folder for all your albums",
  });
  defaultFolder = result.filePaths[0];

  createWindow();

  ipcMain.handle("readFile", async (event, fileName) => {
    try {
      return fs.readFileSync(`${defaultFolder}${fileName}`, "utf-8");
    } catch (_) {
      console.error(`Can't find file ${fileName}`);
      return null;
    }
  });

  ipcMain.handle("getFileNames", async (event) => {
    const fileNames = getFileNames();
    return fileNames;
  });

  ipcMain.handle("getImage", async (event, folderName, imageName) => {
    const path = `${defaultFolder}\\${folderName}\\${imageName}`;
    const imageData = fs.readFileSync(path).toString("base64");
    return { imageData };
  });

  ipcMain.handle(
    "moveImage",
    async (event, fileName, startFolder, endFolder) => {
      return moveAllVersionsOfImage(fileName, startFolder, endFolder);
    }
  );

  ipcMain.handle("createFolder", async (event, folderName) => {
    fs.mkdirSync(`${defaultFolder}\\${folderName}`);
  });

  ipcMain.handle("renameFolder", async (event, oldName, newName) => {
    fs.renameSync(
      `${defaultFolder}\\${oldName}`,
      `${defaultFolder}\\${newName}`
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
