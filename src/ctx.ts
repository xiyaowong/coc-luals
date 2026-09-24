import type {
  Disposable,
  ExtensionContext,
  LanguageClientOptions,
  OutputChannel,
  ServerOptions,
} from 'coc.nvim'
import { execSync } from 'node:child_process'
import path from 'node:path'
import * as coc from 'coc.nvim'
import { disposeAll, events, LanguageClient, services, window, workspace } from 'coc.nvim'
import * as fs from 'fs-extra'
import { ExecuteCommandRequest } from 'vscode-languageserver-protocol'
import { Config } from './config'
import { Installer } from './installer'
import { compareVersion, isLuaDocument, registerCommand } from './util'

export class Ctx implements Disposable {
  private readonly disposables: Disposable[] = []

  private client: LanguageClient | undefined
  public readonly config = new Config()
  private readonly outputChannel: OutputChannel
  public readonly installer: Installer

  private usage = ''
  private readonly queue: Promise<void> = Promise.resolve()

  constructor(public readonly extCtx: ExtensionContext) {
    this.installer = new Installer(this)
    this.outputChannel = window.createOutputChannel('lua')

    this.disposables.push(
      // this.installer,
      this.outputChannel,
      registerCommand('install', async () => {
        if (this.client && this.client.needsStop()) {
          await this.client.stop()
        }
        await this.installer.downloadServer()
        setTimeout(() => {
          coc.commands.executeCommand('lua.restart')
        }, 1000)
      }),
      registerCommand('showVersion', async () => {
        const v = (await this.getCurrentVersion()) || 'unknown version'
        window.showNotification({
          title: 'Lua Language Server [coc-luals]',
          content: v,
          kind: 'info',
        })
      }),
      registerCommand('showUsage', () => {
        window.showNotification({ content: this.usage })
      }),
      registerCommand('reloadFFIMeta', async () => {
        this.client?.sendRequest(ExecuteCommandRequest.type, {
          command: 'lua.reloadFFIMeta',
        })
      }),
    )
  }

  public serial(fn: () => Promise<void>) {
    this.queue.then(fn)
  }

  resolveBin(): [string, string[]] | undefined {
    // TODO: handle Lua.misc.executablePath
    const serverDir = this.config.serverDir
      ? this.config.serverDir
      : path.join(this.extCtx.storagePath, 'luals', 'extension', 'server')

    const platform = process.platform
    const bin = path.join(
      serverDir,
      'bin',
      platform === 'win32' ? 'lua-language-server.exe' : 'lua-language-server',
    )
    if (!fs.existsSync(bin)) return

    if (!coc.executable(bin)) {
      window.showInformationMessage(`${bin} is not executable`, 'error')
      return
    }

    const args: string[] = [
      '-E',
      path.join(serverDir, 'bin', 'main.lua'),
      `--locale=${this.config.locale}`,
    ].concat(workspace.getConfiguration('Lua').get<string[]>('misc.parameters')!)
    if (this.config.logPath.length > 0) args.push(`--logpath=${this.config.logPath}`)

    return [bin, args]
  }

  async getCurrentVersion(): Promise<string | undefined> {
    if (this.config.serverDir) {
      const bin = this.resolveBin()
      if (!bin) return
      const [cmd, args] = bin
      args.push('--version')
      try {
        return String(execSync(`${cmd} ${args.join(' ')}`)).trim()
      } catch (err) {
        console.log(err)
      }
    } else {
      // must be based on the version of vscode extension
      try {
        const packageData = await fs.readJson(this.installer.packageJsonPath)
        return packageData.version
      } catch (err) {
        console.error(err)
      }
    }
  }

  async checkUpdate(force: boolean = false) {
    if (!force) {
      if (!this.config.checkUpdate) return

      // check if the last check was within 4 hours
      const dataPath = path.join(this.extCtx.storagePath, 'checkUpdate')
      let lastCheck = 0
      if (fs.existsSync(dataPath))
        lastCheck = Number((await fs.readFile(dataPath)).toString())

      const now = Date.now()
      if (now - lastCheck < 4 * 60 * 60 * 1000) return

      await fs.writeFile(dataPath, now.toString())
    }

    // not check update if user provide serverDir
    if (this.config.serverDir) return

    const currentVersion = await this.getCurrentVersion()
    if (!currentVersion) return

    const latest = await this.installer.fetchLatestRelease()
    if (!latest) return

    const latestVersion = latest.version.match(/\d.*/)
    if (!latestVersion) return

    if (compareVersion(latestVersion[0], currentVersion) <= 0) return

    const DOWNLOAD = 'Download the latest server'
    const CANCEL = 'Cancel'
    const ret = await window.showQuickPick([DOWNLOAD, CANCEL], {
      title: `lua-language-server has a new release: ${latest.version}, you're using v${currentVersion}.`,
    })
    if (ret === DOWNLOAD) {
      await this.client?.stop()
      try {
        await this.installer.downloadServer(latest)
      } catch (e) {
        console.error(e)
        window.showErrorMessage('Upgrade server failed')
      }
      this.client?.start()
    }
  }

  createClient(): undefined | LanguageClient {
    const bin = this.resolveBin()
    if (!bin) return

    const [command, args] = bin

    const serverOptions: ServerOptions = { command, args }

    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ language: 'lua' }],
      progressOnInitialization: true,
      outputChannel: this.outputChannel,
      initializationOptions: {
        changeConfiguration: true,
        statusBar: true,
        viewDocument: true,
        trustByClient: true,
        useSemanticByRange: true,
        codeLensViewReferences: true,
        fixIndents: true,
        languageConfiguration: true,
        storagePath: this.extCtx.storagePath,
      },
      middleware: {
        workspace: {
          configuration: async (params, token, next) => {
            const result = await next(params, token)

            if (!this.config.nvimLuaEnable || !Array.isArray(result)) return result

            const sectionIndex = params.items.findIndex(item => item.section === 'Lua')

            if (sectionIndex === -1) return result

            const configuration = result[sectionIndex]

            const library = configuration.workspace.library || []

            const runtime = await workspace.nvim.call('expand', ['$VIMRUNTIME/lua'])
            if (!library.includes(runtime)) library.push(runtime)

            configuration.workspace.library = library

            result[sectionIndex] = configuration

            return result
          },
        },
      },
    }

    return new LanguageClient(
      'luals',
      'Lua Language Server',
      serverOptions,
      clientOptions,
    )
  }

  async startServer() {
    const client = this.createClient()
    if (!client) return

    const langClient = services.registerLanguageClient(client)
    this.disposables.push(langClient)
    await client.onReady()
    this.client = client
    this.activateCommand()
    this.activateStatusBar()
  }

  activateStatusBar() {
    if (!this.client) return
    // window status bar
    const bar = window.createStatusBarItem()
    this.disposables.push(bar)

    let keepHide = false

    this.client.onNotification('$/status/show', () => {
      keepHide = false
      bar.show()
    })
    this.client.onNotification('$/status/hide', () => {
      keepHide = true
      bar.hide()
    })
    this.client.onNotification('$/status/report', (params) => {
      const text: string = params.text
      bar.isProgress = text.includes('$(loading~spin)')
      bar.text = text.replace('$(loading~spin)', '')
      this.usage = params.tooltip
    })

    events.on(
      'BufEnter',
      async () => {
        const doc = await workspace.document
        if (isLuaDocument(doc.textDocument)) {
          if (!keepHide) bar.show()
        } else {
          bar.hide()
        }
      },
      null,
      this.disposables,
    )

    setTimeout(() => {
      this.client?.sendNotification('$/status/refresh')
    }, 1000)
  }

  activateCommand() {
    if (!this.client) return

    this.client.onNotification('$/command', (params) => {
      if (params.command !== 'lua.config') return

      const propMap: Map<string, Map<string, any>> = new Map()
      for (const data of params.data) {
        const folder = workspace.getWorkspaceFolder(data.uri)
        const config = workspace.getConfiguration(
          undefined,
          folder ? data.uri : undefined,
        )
        if (data.action === 'add') {
          let value = config.get<any[]>(data.key, [])
          // weird...
          value = Array.from(value)
          value.push(data.value)
          config.update(data.key, value, data.global)
          continue
        }
        if (data.action === 'set') {
          config.update(data.key, data.value, data.global)
          continue
        }
        if (data.action === 'prop') {
          if (!propMap[data.key]) propMap[data.key] = config.get(data.key)

          propMap[data.key][data.prop] = data.value
          config.update(data.key, propMap[data.key], data.global)
          continue
        }
      }
    })
  }

  dispose(): void {
    disposeAll(this.disposables)
  }
}
