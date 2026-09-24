import type { Response } from 'node-fetch'
import type { Ctx } from '@/ctx'
import type { Release } from '@/util'
import path from 'node:path'
import { window } from 'coc.nvim'
import * as fs from 'fs-extra'
import fetch from 'node-fetch'
import { ROOT_NAME } from '@/util'
import { extract } from './extract-zip'

export class Installer {
  constructor(private readonly ctx: Ctx) {}

  async fetchLatestRelease(): Promise<Release | undefined> {
    const headers = {
      'Accept': 'application/json;api-version=6.1-preview.1;',
      'Content-Type': 'application/json',
      'user-agent': 'VSCode',
    }
    const body = JSON.stringify({
      filters: [
        {
          criteria: [
            {
              filterType: 4,
              value: '3a15b5a7-be12-47e3-8445-88ee3eabc8b2',
            },
          ],
        },
      ],
      flags: 950,
    })
    let response: Response
    try {
      response = await fetch(
        'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery ',
        {
          method: 'POST',
          headers,
          body,
          timeout: 10e3,
        },
      )
    } catch (err) {
      console.error(err)
      return
    }

    if (!response.ok) {
      console.error(await response.text())
      return
    }

    const platform = ['linux', 'darwin', 'win32'].includes(process.platform)
      ? process.platform
      : 'linux'
    const targetPlatform = `${platform}-${process.arch}`

    const release = await response.json()

    const extension = release.results[0].extensions[0].versions[0]

    return {
      version: extension.version,
      url: `${extension.assetUri}/Microsoft.VisualStudio.Services.VSIXPackage?redirect=true&targetPlatform=${targetPlatform}&install=true`,
    }
  }

  public get targetPath() {
    return path.join(this.ctx.extCtx.storagePath, ROOT_NAME)
  }

  public get packageJsonPath() {
    return path.join(this.targetPath, 'extension', 'package.json')
  }

  public get serverPath() {
    return path.join(this.targetPath, 'extension', 'server')
  }

  public get tempPath() {
    return path.join(this.ctx.extCtx.storagePath, `${ROOT_NAME}-temp`)
  }

  async downloadServer(release?: Release): Promise<void> {
    const statusItem = window.createStatusBarItem(0, { progress: true })
    statusItem.show()

    try {
      if (!release) {
        statusItem.text = 'Fetching latest release information'
        release = await this.fetchLatestRelease()
        if (!release) {
          statusItem.hide()
          window.showErrorMessage('Get latest release information failed')
          return
        }
      }

      statusItem.text = 'Downloading latest lua-language-server'

      const resp = await fetch(release.url, {
        headers: {
          'user-agent': 'VSCode',
        },
      })
      if (!resp.ok) {
        throw new Error(
          'Download failed! Maybe the provided target platform is not supported for now',
        )
      }

      const buffer = await resp.buffer()
      const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const tempFile = path.join(this.tempPath, ROOT_NAME)

      statusItem.text = 'Installing latest lua-language-server'
      await fs.outputFile(tempFile, bytes)

      const targetPath = this.targetPath
      await fs.remove(targetPath)
      await extract(tempFile, { dir: targetPath })

      const binPath = path.join(this.serverPath, 'bin', 'lua-language-server')
      if (fs.existsSync(binPath)) await fs.chmod(binPath, 0o755)

      window.showInformationMessage(`Installed ${targetPath} successfully`)
    } finally {
      statusItem.hide()
      statusItem.dispose()
      await fs.remove(this.tempPath)
    }
  }
}
