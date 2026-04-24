## PhotoGlide - Photo Organizer, Captioner & Viewer

_Save all your precious photos, and the information needed to enjoy them later, quickly and easily on your own computer._

![image](https://github.com/user-attachments/assets/5fb0f5c4-9831-4f6d-a061-42115324ac51)
![image](https://github.com/user-attachments/assets/8296e447-b0cd-4bee-bfd5-13a56dbcea20)

### Features

- Set description and date of photograph
- Find people in photographs using a face-detection algorithm, or add them in manually
- Quickly and easily sort photos into folders using shortcuts
- View images in a cozy format with easy controls for zooming and panning

### Development

Requires Node (v20.18.0) and face detection required graphics card that supports WebGL

Install dependencies:

```
npm install
```

Run in local development mode (hot reload UI):

```
npm run dev
```

Build release artifacts:

```
npm run build
```

This runs `electron-forge make` and produces platform-specific outputs:

- Windows: `.exe` artifacts (Squirrel installer + portable `PhotoGlide.exe`)
- Linux: `.AppImage` artifact

You can also target a specific platform:

```
npx electron-forge make --platform=win32
npx electron-forge make --platform=linux
```
