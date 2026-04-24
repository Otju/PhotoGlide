const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const path = require('path')
const fs = require('fs/promises')

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: ['./node_modules/exiftool-vendored.' + (process.platform === 'win32' ? 'exe' : 'pl'), './models'],
    icon: './icons/icon',
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      if (packageResult.platform !== 'linux') return

      await Promise.all(
        packageResult.outputPaths.map(async (outputPath) => {
          const wrapperPath = path.join(outputPath, 'PhotoGlide')
          const binaryPath = path.join(outputPath, 'PhotoGlide-bin')

          const wrapper = [
            '#!/usr/bin/env bash',
            'set -e',
            'SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"',
            'SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"',
            'exec "$SCRIPT_DIR/PhotoGlide-bin" --no-sandbox "$@"',
            '',
          ].join('\n')

          await fs.rename(wrapperPath, binaryPath)
          await fs.writeFile(wrapperPath, wrapper, { encoding: 'utf-8', mode: 0o755 })
        }),
      )
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {},
    },
    {
      name: '@rabbitholesyndrome/electron-forge-maker-portable',
      platforms: ['win32'],
      config: {
        portable: {
          artifactName: 'PhotoGlide.exe',
        },
        icon: './icons/icon',
      },
    },
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: {
          bin: 'PhotoGlide',
          icon: './icons/512x512.png',
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
