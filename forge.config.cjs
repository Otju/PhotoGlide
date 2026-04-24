const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs/promises')

const pkg = require('./package.json')

function releaseArtifactTag() {
  if (process.env.RELEASE_ARTIFACT_TAG) {
    return process.env.RELEASE_ARTIFACT_TAG.replace(/^refs\/tags\//, '')
  }
  const refName = process.env.GITHUB_REF_NAME
  if (refName) return refName.replace(/^refs\/tags\//, '')
  try {
    return execSync('git describe --tags --abbrev=0', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return `v${pkg.version}`
  }
}

module.exports = async () => {
  const artifactTag = releaseArtifactTag()

  return {
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
      postMake: async (_forgeConfig, makeResults) => {
        for (const result of makeResults) {
          result.artifacts = await Promise.all(
            result.artifacts.map(async (artifact) => {
              if (!artifact.endsWith('.AppImage')) return artifact
              const dir = path.dirname(artifact)
              const next = path.join(dir, `PhotoGlide-${artifactTag}.AppImage`)
              if (artifact !== next) await fs.rename(artifact, next)
              return next
            }),
          )
        }
        return makeResults
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
            artifactName: `Photoglide-${artifactTag}.exe`,
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
}
