import type { Disposable } from 'coc.nvim'
import type { Locale } from './util'
import { workspace } from 'coc.nvim'
import { CONFIG_NAME } from './util'

export class Config implements Disposable {
  private readonly disposables: Disposable[] = []

  get cfg() {
    return workspace.getConfiguration(CONFIG_NAME)
  }

  get serverDir(): string | undefined {
    const dir = this.cfg.get<string>('serverDir')
    if (dir && dir.trim() !== '') {
      return dir
    }
  }

  get locale(): Locale {
    return this.cfg.get<Locale>('locale')!
  }

  get logPath() {
    return this.cfg.get<string>('logPath')!
  }

  get checkUpdate() {
    return this.cfg.get<boolean>('checkUpdate')
  }

  get nvimLuaEnable() {
    return this.cfg.get<boolean>('nvimLua.enable')
  }

  get nvimLuaLibrary() {
    return this.cfg.get<string[]>('nvimLua.library')
  }

  dispose() {
    while (this.disposables.length) {
      this.disposables.pop()?.dispose()
    }
  }
}
