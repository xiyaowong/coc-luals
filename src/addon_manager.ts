import type { CancellationToken, ListContext, ListItem } from 'coc.nvim'
import type { Ctx } from './ctx'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { BasicList, window, workspace } from 'coc.nvim'
import * as fs from 'fs-extra'

const pExecFile = promisify(execFile)

export interface AddonInfo {
  name?: string
  description?: string
  size?: number
  hasPlugin?: boolean
}

export interface AddonConfig {
  name?: string
  words?: string[]
  files?: string[]
  settings?: Record<string, any>
}

export interface AddonItem {
  name: string
  installed: boolean
  enabled: boolean
}

type AddonVerb = 'enable' | 'disable' | 'install' | 'uninstall'

const DONE_LABEL: Record<AddonVerb, string> = {
  install: 'installed',
  enable: 'enabled',
  disable: 'disabled',
  uninstall: 'uninstalled',
}

const SKIP_LABEL: Record<AddonVerb, string> = {
  install: 'already installed',
  enable: 'already enabled',
  disable: 'already disabled',
  uninstall: 'not installed',
}

/** A multiple action receives the marked items, or the current item if none are marked. */
function addonItems(items: ListItem[]): AddonItem[] {
  return items.map(item => item.data as AddonItem)
}

export class AddonManager extends BasicList {
  public readonly name = 'lls_addons'
  public readonly description = 'Manage Lua Language Server addons'
  public readonly defaultAction = 'enable'

  private isUpdatingRepo = false

  constructor(private readonly ctx: Ctx) {
    super()

    this.addMultipleAction('enable', items => this.enableAddons(addonItems(items)))
    this.addMultipleAction('disable', items => this.disableAddons(addonItems(items)))
    this.addMultipleAction('install', items => this.installAddons(addonItems(items)))
    this.addMultipleAction('uninstall', items => this.uninstallAddons(addonItems(items)))
    this.addAction('view on github', async item => this.viewOnGithub(item.data))
  }

  public get addonsDir(): string {
    return path.join(this.ctx.extCtx.storagePath, 'addonManager')
  }

  private getAddonDir(name: string): string {
    return path.join(this.addonsDir, 'addons', name)
  }

  private getModuleDir(name: string): string {
    return path.join(this.getAddonDir(name), 'module')
  }

  private async runGit(args: string[], cwd: string = this.addonsDir, timeout = 120_000): Promise<string> {
    const { stdout } = await pExecFile('git', args, { cwd, timeout })
    return stdout.trim()
  }

  public async ensureRepo(): Promise<boolean> {
    const repoDir = this.addonsDir
    const repoGitDir = path.join(repoDir, '.git')

    if (!fs.existsSync(repoGitDir)) {
      await fs.ensureDir(repoDir)
      try {
        window.showInformationMessage('Cloning LuaLS/LLS-Addons repository...')
        await this.runGit(['clone', '--depth=1', 'https://github.com/LuaLS/LLS-Addons.git', repoDir], process.cwd())
        window.showInformationMessage('Successfully cloned LLS-Addons repository.')
      } catch (err: any) {
        window.showErrorMessage(`Failed to clone LLS-Addons: ${err?.message || err}`)
        return false
      }
    } else if (!this.isUpdatingRepo) {
      this.isUpdatingRepo = true
      this.runGit(['pull', '--ff-only'])
        .catch(() => {})
        .finally(() => {
          this.isUpdatingRepo = false
        })
    }

    return true
  }

  public isAddonInstalled(name: string): boolean {
    const moduleDir = this.getModuleDir(name)
    if (!fs.existsSync(moduleDir)) return false
    try {
      const files = fs.readdirSync(moduleDir)
      return files.length > 0
    } catch {
      return false
    }
  }

  public isAddonEnabled(name: string): boolean {
    return this.ctx.config.workspaceLibrary.some(lib => this.isLibraryOf(lib, name))
  }

  public async viewOnGithub(addon: AddonItem): Promise<void> {
    const url = `https://github.com/LuaLS/LLS-Addons/tree/main/addons/${addon.name}`
    await workspace.openResource(url)
  }

  public async enableAddons(addons: AddonItem[]): Promise<void> {
    await this.runAddonAction('enable', addons)
  }

  public async installAddons(addons: AddonItem[]): Promise<void> {
    await this.runAddonAction('install', addons)
  }

  public async disableAddons(addons: AddonItem[]): Promise<void> {
    await this.runAddonAction('disable', addons)
  }

  public async uninstallAddons(addons: AddonItem[]): Promise<void> {
    await this.runAddonAction('uninstall', addons)
  }

  private async enableAddon(addon: AddonItem): Promise<void> {
    const configFile = path.join(this.getModuleDir(addon.name), 'config.json')
    if (fs.existsSync(configFile)) {
      try {
        const configData: AddonConfig = await fs.readJson(configFile)
        if (configData.settings) {
          await this.applyAddonSettings(configData.settings)
        }
      } catch (err) {
        this.ctx.outputChannel.appendLine(`Failed to apply addon settings: ${String(err)}`)
      }
    }
  }

  private async disableAddon(addon: AddonItem): Promise<void> {
    const configFile = path.join(this.getModuleDir(addon.name), 'config.json')
    if (fs.existsSync(configFile)) {
      try {
        const configData: AddonConfig = await fs.readJson(configFile)
        if (configData.settings) {
          await this.revokeAddonSettings(configData.settings)
        }
      } catch (err) {
        this.ctx.outputChannel.appendLine(`Failed to revoke addon settings: ${String(err)}`)
      }
    }
  }

  private async installAddon(addon: AddonItem): Promise<boolean> {
    const ready = await this.ensureRepo()
    if (!ready) return false

    if (this.isAddonInstalled(addon.name)) return true

    const moduleDir = this.getModuleDir(addon.name)

    window.showInformationMessage(`Installing addon "${addon.name}"...`)

    const addonRelativePath = path.join('addons', addon.name)
    try {
      await this.runGit(['submodule', 'update', '--init', '--depth=1', addonRelativePath])
        .catch(() => this.runGit(['submodule', 'update', '--init', addonRelativePath]))
    } catch (err: any) {
      window.showErrorMessage(`Failed to install addon "${addon.name}": ${err?.message || err}`)
      return false
    }

    if (!fs.existsSync(moduleDir) || fs.readdirSync(moduleDir).length === 0) {
      window.showErrorMessage(`Addon "${addon.name}" failed to checkout submodule contents.`)
      return false
    }

    return true
  }

  private async deinitAddon(addon: AddonItem): Promise<void> {
    const moduleDir = this.getModuleDir(addon.name)
    if (!fs.existsSync(moduleDir)) return

    const addonRelativePath = path.join('addons', addon.name)
    try {
      await this.runGit(['submodule', 'deinit', '-f', addonRelativePath])
    } catch (err: any) {
      window.showErrorMessage(`Failed to uninstall addon "${addon.name}": ${err?.message || err}`)
    }
  }

  /**
   * Run one action over every selected addon.
   *
   * The selection is pre-checked so an addon is reported as done only when it
   * actually was, and `workspace.library` is written once per action instead of
   * once per addon.
   */
  private async runAddonAction(verb: AddonVerb, addons: AddonItem[]): Promise<void> {
    const selected = [...new Map(addons.map(addon => [addon.name, addon])).values()]
    if (selected.length === 0) return

    const settled = (addon: AddonItem): boolean => {
      if (verb === 'install') return this.isAddonInstalled(addon.name)
      if (verb === 'enable') return this.isAddonEnabled(addon.name)
      if (verb === 'disable') return !this.isAddonEnabled(addon.name)
      return !this.isAddonInstalled(addon.name)
    }

    const pending = selected.filter(addon => !settled(addon))
    const unchanged = selected.length - pending.length

    if (pending.length === 0) {
      window.showInformationMessage(`Addon manager: ${unchanged} addon(s) ${SKIP_LABEL[verb]}.`)
      return
    }

    if (verb === 'install' || verb === 'enable') {
      const ready = await this.ensureRepo()
      if (!ready) return
    }

    const { config } = this.ctx
    const before = config.workspaceLibrary
    let next = before
    let done = 0
    let failed = 0

    for (const addon of pending) {
      try {
        if (verb === 'install') {
          if (await this.installAddon(addon)) done++
          else failed++
        } else if (verb === 'enable') {
          if (!await this.installAddon(addon)) {
            failed++
            continue
          }
          const library = `\${addons}/${addon.name}/module/library`
          if (!next.includes(library)) next = [...next, library]
          await this.enableAddon(addon)
          done++
        } else if (verb === 'disable') {
          next = next.filter(lib => !this.isLibraryOf(lib, addon.name))
          await this.disableAddon(addon)
          done++
        } else {
          next = next.filter(lib => !this.isLibraryOf(lib, addon.name))
          await this.disableAddon(addon)
          await this.deinitAddon(addon)
          done++
        }
      } catch (err: any) {
        failed++
        window.showErrorMessage(`Failed to ${verb} addon "${addon.name}": ${err?.message || err}`)
      }
    }

    if (next !== before) {
      await config.setWorkspaceLibrary(next)
    }

    const parts: string[] = []
    if (done > 0) parts.push(`${done} addon(s) ${DONE_LABEL[verb]}`)
    if (failed > 0) parts.push(`${failed} failed`)
    if (unchanged > 0) parts.push(`${unchanged} ${SKIP_LABEL[verb]}`)
    window.showInformationMessage(`Addon manager: ${parts.join(', ')}.`)
  }

  private isLibraryOf(lib: string, name: string): boolean {
    const normalized = lib.replace(/\\/g, '/').toLowerCase()
    const normName = name.replace(/[-_.]/g, '').toLowerCase()

    return (
      normalized.includes(`${name.toLowerCase()}/module/library`)
      || normalized.includes(`${normName}/module/library`)
    )
  }

  private async applyAddonSettings(settings: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      // Owned by the batch, which writes the pending value once per action.
      if (key === 'Lua.workspace.library') continue

      const parts = key.split('.')
      const section = parts.shift()!
      const prop = parts.join('.')
      const cfg = workspace.getConfiguration(section)

      if (Array.isArray(value)) {
        const current = cfg.get<any[]>(prop, [])
        const set = new Set(current)
        for (const v of value) set.add(v)
        await cfg.update(prop, Array.from(set))
      } else if (typeof value === 'object' && value !== null) {
        const current = cfg.get<Record<string, any>>(prop, {})
        await cfg.update(prop, { ...current, ...value })
      } else {
        await cfg.update(prop, value)
      }
    }
  }

  private async revokeAddonSettings(settings: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'Lua.workspace.library') continue

      const parts = key.split('.')
      const section = parts.shift()!
      const prop = parts.join('.')
      const cfg = workspace.getConfiguration(section)

      if (Array.isArray(value)) {
        const current = cfg.get<any[]>(prop, [])
        const valueSet = new Set(value)
        const updated = current.filter(v => !valueSet.has(v))
        await cfg.update(prop, updated)
      } else if (typeof value === 'object' && value !== null) {
        const current = { ...cfg.get<Record<string, any>>(prop, {}) }
        for (const k of Object.keys(value)) {
          delete current[k]
        }
        await cfg.update(prop, Object.keys(current).length > 0 ? current : undefined)
      }
    }
  }

  public async loadItems(_context: ListContext, _token?: CancellationToken): Promise<ListItem[]> {
    const ready = await this.ensureRepo()
    if (!ready) return []

    const addonsBase = path.join(this.addonsDir, 'addons')
    if (!fs.existsSync(addonsBase)) return []

    let entries: string[] = []
    try {
      entries = await fs.readdir(addonsBase)
    } catch {
      return []
    }

    const items: ListItem[] = []

    const maxNameLength = entries.reduce((max, name) => Math.max(max, name.length), 0)
    const namePadding = Math.min(20, maxNameLength)

    for (const name of entries) {
      const addonDir = path.join(addonsBase, name)
      const infoPath = path.join(addonDir, 'info.json')

      if (!fs.existsSync(addonDir) || !fs.statSync(addonDir).isDirectory()) {
        continue
      }

      let info: AddonInfo = {}
      if (fs.existsSync(infoPath)) {
        try {
          info = await fs.readJson(infoPath)
        } catch {}
      }

      const installed = this.isAddonInstalled(name)
      const enabled = this.isAddonEnabled(name)

      const stateTag = enabled ? '[+]' : installed ? '[*]' : '[-]'
      const infoPart = info.name ? ` (${info.name})` : ''
      const descPart = info.description ? ` ${info.description}` : ''
      const label = `${stateTag} ${name.padEnd(namePadding)} -${infoPart}${descPart}`

      items.push({
        label,
        data: {
          name,
          installed,
          enabled,
        } as AddonItem,
      })
    }

    // Sort: enabled first, then installed, then not installed, and alphabetically by name
    return items.sort((a, b) => {
      const aData = a.data as AddonItem
      const bData = b.data as AddonItem

      if (aData.enabled !== bData.enabled) {
        return aData.enabled ? -1 : 1
      }

      if (aData.installed !== bData.installed) {
        return aData.installed ? -1 : 1
      }

      return aData.name.localeCompare(bData.name)
    })
  }

  public patchConfiguration(params: any, result: any): any {
    if (!Array.isArray(result)) return result

    const sectionIndex = params.items.findIndex((item: any) => item.section === 'Lua')
    if (sectionIndex === -1) return result

    const configuration = result[sectionIndex]
    if (!configuration?.workspace?.library || !Array.isArray(configuration.workspace.library)) {
      return result
    }

    const addonsBase = path.join(this.addonsDir, 'addons')
    const addonsPlaceholder = ['$', '{addons}'].join('')

    configuration.workspace.library = configuration.workspace.library.map((lib: string) => {
      if (typeof lib !== 'string') return lib

      let replaced = lib
      if (replaced.includes(addonsPlaceholder)) {
        replaced = replaced.split(addonsPlaceholder).join(addonsBase)
      } else if (replaced.includes('$addons')) {
        replaced = replaced.split('$addons').join(addonsBase)
      }

      return path.normalize(replaced)
    })

    result[sectionIndex] = configuration
    return result
  }

  public doHighlight(): void {
    const { nvim } = this
    nvim.pauseNotification()
    nvim.command('syntax match LlsAddonsStatus /\\v^\\[[+*-]\\]/', true)
    nvim.command('syntax match LlsAddonsName /\\v%5v\\S+/', true)
    nvim.command('syntax match LlsAddonsInfoName /\\v\\(\\zs[^)]+\\ze\\)/', true)
    nvim.command('syntax match LlsAddonsDescription /\\v - (\\([^)]+\\) )?\\zs.*$/', true)
    nvim.command('highlight default link LlsAddonsStatus Type', true)
    nvim.command('highlight default link LlsAddonsName String', true)
    nvim.command('highlight default link LlsAddonsInfoName Identifier', true)
    nvim.command('highlight default link LlsAddonsDescription Comment', true)
    nvim.resumeNotification().catch(() => {})
  }
}
