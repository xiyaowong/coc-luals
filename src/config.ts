import type { Disposable } from 'coc.nvim'
import type { Locale } from './util'
import { disposeAll, workspace } from 'coc.nvim'
import { CONFIG_NAME } from './util'

export class Config implements Disposable {
  private readonly disposables: Disposable[] = []

  public serverDir: string | undefined
  public locale!: Locale
  public logPath: string | undefined
  public checkUpdate!: boolean
  public nvimLuaEnable!: boolean
  public nvimLuaLibrary!: string[]

  constructor() {
    this.disposables.push(
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(CONFIG_NAME)) {
          this.updateConfig()
        }
      }),
    )

    this.updateConfig()
  }

  private updateConfig() {
    const cfg = workspace.getConfiguration(CONFIG_NAME)

    const serverDir = cfg.get<string>('serverDir')
    this.serverDir = this.isStringEmpty(serverDir) ? undefined : serverDir

    const logPath = cfg.get<string>('logPath')
    this.logPath = this.isStringEmpty(logPath) ? undefined : serverDir

    this.locale = cfg.get<Locale>('locale') || 'en-us'
    this.checkUpdate = cfg.get<boolean>('checkUpdate') || false

    this.nvimLuaEnable = workspace.isNvim
      ? cfg.get<boolean>('nvimLua.enable') || false
      : false
    this.nvimLuaLibrary = cfg.get<string[]>('nvimLua.library') || []
  }

  private isStringEmpty(str: string | undefined): boolean {
    return !str || str.trim() === ''
  }

  dispose() {
    disposeAll(this.disposables)
  }
}
