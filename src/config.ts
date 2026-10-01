import type { Disposable } from 'coc.nvim'
import type { Locale } from './util'
import { commands, disposeAll, window, workspace } from 'coc.nvim'
import { CONFIG_NAME, CONFIGS_NEED_RESTART } from './util'

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

        if (CONFIGS_NEED_RESTART.some(item => e.affectsConfiguration(item))) {
          window.showNotification({
            title: 'coc-luals',
            content: 'Some settings require a restart to take effect.',
            buttons: [
              { index: 0, text: 'Restart' },
              { index: 1, text: 'Later' },
            ],
            callback: async (index) => {
              if (index === 0) {
                setTimeout(() => commands.executeCommand('lua.restart'), 1000)
              }
            },
          })
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
    global: boolean = false,
  ): Promise<void> {
    await workspace.getConfiguration('Lua').update(section, value, global)
  }

  public get workspaceLibrary(): string[] {
    return this.getLuaConfig<string[]>('workspace.library', [])
  }

  public async setWorkspaceLibrary(
    libs: string[],
    global: boolean = false,
  ): Promise<void> {
    await this.updateLuaConfig('workspace.library', Array.from(new Set(libs)), global)
  }

  public async addWorkspaceLibrary(
    libs: string | string[],
    global: boolean = false,
  ): Promise<void> {
    const list = Array.isArray(libs) ? libs : [libs]
    const current = new Set(this.workspaceLibrary)
    for (const lib of list) {
      current.add(lib)
    }
    await this.setWorkspaceLibrary(Array.from(current), global)
  }

  public async removeWorkspaceLibrary(
    predicate: string | ((lib: string) => boolean),
    global: boolean = false,
  ): Promise<void> {
    const filterFn
      = typeof predicate === 'string'
        ? (lib: string) => lib !== predicate
        : (lib: string) => !predicate(lib)
    const next = this.workspaceLibrary.filter(filterFn)
    await this.setWorkspaceLibrary(next, global)
  }

  dispose() {
    disposeAll(this.disposables)
  }
}
