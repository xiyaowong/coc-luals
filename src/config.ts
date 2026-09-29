import type { Disposable } from 'coc.nvim'
import type { Locale } from './util'
import { ConfigurationTarget, disposeAll, workspace } from 'coc.nvim'
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
          this.refreshConfig()
        }
      }),
    )

    this.refreshConfig()
  }

  private refreshConfig() {
    const cfg = workspace.getConfiguration(CONFIG_NAME)

    this.serverDir = cfg.get<string>('serverDir')?.trim() || undefined
    this.logPath = cfg.get<string>('logPath')?.trim() || undefined
    this.locale = cfg.get<Locale>('locale') || 'en-us'
    this.checkUpdate = cfg.get<boolean>('checkUpdate') || false
    this.nvimLuaEnable = workspace.isNvim
      ? cfg.get<boolean>('nvimLua.enable') || false
      : false
    this.nvimLuaLibrary = cfg.get<string[]>('nvimLua.library') || []
  }

  public getLuaConfig<T>(section: string, defaultValue: T): T {
    return workspace.getConfiguration('Lua').get<T>(section, defaultValue)
  }

  public async updateLuaConfig(
    section: string,
    value: any,
    target: ConfigurationTarget = ConfigurationTarget.Workspace,
  ): Promise<void> {
    await workspace.getConfiguration('Lua').update(section, value, target)
  }

  public get workspaceLibrary(): string[] {
    return this.getLuaConfig<string[]>('workspace.library', [])
  }

  public async setWorkspaceLibrary(
    libs: string[],
    target: ConfigurationTarget = ConfigurationTarget.Workspace,
  ): Promise<void> {
    await this.updateLuaConfig('workspace.library', Array.from(new Set(libs)), target)
  }

  public async addWorkspaceLibrary(
    libs: string | string[],
    target: ConfigurationTarget = ConfigurationTarget.Workspace,
  ): Promise<void> {
    const list = Array.isArray(libs) ? libs : [libs]
    const current = new Set(this.workspaceLibrary)
    for (const lib of list) {
      current.add(lib)
    }
    await this.setWorkspaceLibrary(Array.from(current), target)
  }

  public async removeWorkspaceLibrary(
    predicate: string | ((lib: string) => boolean),
    target: ConfigurationTarget = ConfigurationTarget.Workspace,
  ): Promise<void> {
    const filterFn = typeof predicate === 'string'
      ? (lib: string) => lib !== predicate
      : (lib: string) => !predicate(lib)
    const next = this.workspaceLibrary.filter(filterFn)
    await this.setWorkspaceLibrary(next, target)
  }

  dispose() {
    disposeAll(this.disposables)
  }
}
