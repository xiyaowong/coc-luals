import type { Response } from 'node-fetch'
import type { Ctx } from '@/ctx'
import type { Release } from '@/util'
import * as os from 'node:os'
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

    const osPlatform = ['linux', 'darwin', 'win32'].includes(os.platform())
      ? os.platform()
      : 'linux'
    const targetPlatform = `${osPlatform}-${os.arch()}`

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

  async downloadServer(release?: Release): Promise<void> {
    const statusItem = window.createStatusBarItem(0, { progress: true })
    statusItem.show()

    if (!release) {
      statusItem.text = 'Fetching latest release information'
      release = await this.fetchLatestRelease()
      if (!release) {
        statusItem.hide()
        window.showErrorMessage('Get latest release information failed', 'error')
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
      statusItem.hide()
      throw new Error(
        'Download failed! Maybe the provided target platform is not supported for now',
      )
    }

    const buffer = await resp.buffer()

    const tempDir = await fs.mkdtemp(ROOT_NAME)
    const extTempFile = path.join(tempDir, ROOT_NAME)

    const targetPath = this.targetPath
    statusItem.text = `Writing temp file ${extTempFile}`
    // @ts-expect-error ...
    await fs.writeFile(extTempFile, buffer)

    statusItem.text = `Removing old files`
    await fs.remove(targetPath)

    statusItem.text = `Extracting to ${targetPath}`
    await extract(extTempFile, { dir: targetPath })

    const binPath = path.join(
      targetPath,
      'extension',
      'server',
      'bin',
      'lua-language-server',
    )
    if (fs.existsSync(binPath)) await fs.chmod(binPath, '777')

    statusItem.text = `Removing temp file ${extTempFile}`
    await fs.remove(tempDir)

    window.showInformationMessage(`Installed ${targetPath} successfully`)
    statusItem.hide()
  }
}
