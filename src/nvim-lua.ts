import type {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  CodeActionProvider,
  Command,
  CompletionContext,
  CompletionItem,
  CompletionItemProvider,
  CompletionList,
  ConfigurationParams,
  Disposable,
  LinesTextDocument,
  Position,
  ProviderResult,
  Range,
} from 'coc.nvim'
import type { NvimLuaLibrary } from './util'
import type { Ctx } from '@/ctx'
import path from 'node:path'
import { CodeActionKind, commands, CompletionItemKind, disposeAll, workspace } from 'coc.nvim'
import * as fs from 'fs-extra'
import { DidChangeConfigurationNotification } from 'vscode-languageserver-protocol'
import { registerCommand } from './util'

export class NvimLua implements CompletionItemProvider, CodeActionProvider, Disposable {
  private readonly disposables: Disposable[] = []

  private libraries: NvimLuaLibrary[] = []
  private readonly dynamicLibraries: Set<string> = new Set()

  constructor(private readonly ctx: Ctx) {
    this.disposables.push(
      registerCommand('_importLibrary', name => this.importLibrary(name), true),
      registerCommand('_collectLibraries', () => this.collectLibraries(), true),
      registerCommand('_updateConfiguration', () => this.updateConfiguration(), true),
    )
  }

  private get nvimLuaEnable() {
    return this.ctx.config.nvimLuaEnable
  }

  private get nvimLuaLibrary() {
    return this.ctx.config.nvimLuaLibrary
  }

  private findLibrary(name: string): NvimLuaLibrary | undefined {
    return this.libraries.find((lib) => {
      if (lib.name === name) return true
      return lib.modules.includes(name)
    })
  }

  private async updateConfiguration() {
    await this.ctx.clientInstance?.sendNotification(
      DidChangeConfigurationNotification.type,
      { settings: {} },
    )
  }

  async patchConfiguration(params: ConfigurationParams, result: any): Promise<any> {
    if (!this.nvimLuaEnable || !Array.isArray(result)) return result

    const sectionIndex = params.items.findIndex(item => item.section === 'Lua')

    if (sectionIndex === -1) return result

    const configuration = result[sectionIndex]

    const library = configuration.workspace.library || []

    const runtime = await workspace.nvim.call('expand', ['$VIMRUNTIME/lua'])
    if (!library.includes(runtime)) library.push(runtime)

    if (
      this.libraries.length === 0
      && (this.nvimLuaLibrary.length > 0 || this.dynamicLibraries.size > 0)
    ) {
      await this.collectLibraries()
    }

    if (this.nvimLuaLibrary.length > 0) {
      for (const libName of this.nvimLuaLibrary) {
        const lib = this.findLibrary(libName)
        if (lib && !library.includes(lib.path)) {
          library.push(lib.path)
        }
      }
    }

    for (const libName of this.dynamicLibraries) {
      const lib = this.findLibrary(libName)
      if (lib && !library.includes(lib.path)) {
        library.push(lib.path)
      }
    }

    configuration.workspace.library = library

    result[sectionIndex] = configuration

    return result
  }

  private async scanPlugin(pluginPath: string): Promise<NvimLuaLibrary | undefined> {
    const pluginName = path.basename(pluginPath)
    const luaDir = path.join(pluginPath, 'lua')
    if (!(await fs.pathExists(luaDir))) return undefined

    const subEntries = (await fs.readdir(luaDir, { withFileTypes: true }).catch(() => [])) as fs.Dirent[]
    const modules: string[] = []

    await Promise.all(
      subEntries.map(async (item) => {
        if (item.isFile() && item.name.endsWith('.lua')) {
          modules.push(item.name.slice(0, -4))
        } else if (item.isDirectory()) {
          if (await fs.pathExists(path.join(luaDir, item.name, 'init.lua'))) {
            modules.push(item.name)
          }
        }
      }),
    )

    if (modules.length === 0) return undefined
    return { name: pluginName, path: luaDir, modules }
  }

  private collectLibraries = async () => {
    if (!this.nvimLuaEnable) {
      this.libraries = []
      return
    }

    const runtimePaths = (await workspace.nvim.request('nvim_list_runtime_paths')) as string[]

    // TODO: @Agent support other plugin managers like packer.nvim, vim-plug, etc.
    const lazyPath = runtimePaths.find(p => p.includes('lazy.nvim'))
    if (!lazyPath) {
      this.libraries = []
      return
    }

    const lazyRoot = path.dirname(lazyPath)
    if (!(await fs.pathExists(lazyRoot))) {
      this.libraries = []
      return
    }

    const entries = await fs.readdir(lazyRoot, { withFileTypes: true })
    const pluginPaths = entries.filter(e => e.isDirectory()).map(e => path.join(lazyRoot, e.name))
    const lazyLibraries = [...await Promise.all(pluginPaths.map(this.scanPlugin))].filter((lib): lib is NvimLuaLibrary => Boolean(lib))
    this.libraries = lazyLibraries
  }

  async importLibrary(libraryName: string) {
    const lib = this.findLibrary(libraryName)
    if (!lib) return

    if (this.dynamicLibraries.has(lib.name)) return
    this.dynamicLibraries.add(lib.name)

    await commands.executeCommand('lua._updateConfiguration')
  }

  async provideCompletionItems(
    document: LinesTextDocument,
    position: Position,
    _token: CancellationToken,
    _context?: CompletionContext,
  ): Promise<CompletionItem[] | CompletionList | undefined> {
    if (!this.nvimLuaEnable) return undefined
    if (this.libraries.length === 0) {
      await this.collectLibraries()
    }
    if (this.libraries.length === 0) return undefined

    const line = document.lineAt(position.line).text
    const textBeforeCursor = line.slice(0, position.character)
    const match = textBeforeCursor.match(/(?:require\s*\(?|---@module\s+)['"]([^'"]*)$/)
    if (!match) return undefined

    const imported = new Set([...this.nvimLuaLibrary, ...this.dynamicLibraries])
    const items: CompletionItem[] = []

    for (const lib of this.libraries) {
      const isImported = imported.has(lib.name)
      for (const mod of lib.modules) {
        items.push({
          label: mod,
          kind: CompletionItemKind.Module,
          detail: isImported
            ? `(coc-luals) ${lib.name}`
            : `(coc-luals: auto import) ${lib.name}`,
          documentation: {
            kind: 'markdown',
            value: [
              `### Module \`${mod}\``,
              '',
              `* **Plugin:** \`${lib.name}\``,
              `* **Library Path:** \`${lib.path}\``,
              `* **Workspace Status:** ${isImported ? 'Already imported' : '⚡ **Auto-import library on completion**'}`,
              '',
              `**Exported modules in \`${lib.name}\`:**`,
              ...lib.modules.map(m => `- \`${m}\``),
            ].join('\n'),
          },
          data: {
            libraryName: lib.name,
            needImport: !isImported,
          },
        })
      }
    }

    return items
  }

  resolveCompletionItem?(item: CompletionItem, _token: CancellationToken): ProviderResult<CompletionItem> {
    if (item.data?.needImport && item.data.libraryName) {
      item.command = {
        title: 'Import Library',
        command: 'lua._importLibrary',
        arguments: [item.data.libraryName],
      }
    }
    return item
  }

  async provideCodeActions(
    document: LinesTextDocument,
    range: Range,
    _context: CodeActionContext,
    _token: CancellationToken,
  ): Promise<(Command | CodeAction)[] | undefined> {
    if (!this.nvimLuaEnable) return undefined
    if (this.libraries.length === 0) {
      await this.collectLibraries()
    }
    if (this.libraries.length === 0) return undefined

    const line = document.lineAt(range.start.line).text
    const regex = /(?:require\s*\(?|---@module\s+)['"]([^'"]+)['"]/g
    const cursorChar = range.start.character

    let matchedModule: string | undefined

    for (const match of line.matchAll(regex)) {
      const matchStart = match.index
      const matchEnd = match.index + match[0].length
      if (cursorChar >= matchStart && cursorChar <= matchEnd) {
        matchedModule = match[1]
        break
      }
    }

    if (!matchedModule) return undefined

    const imported = new Set([...this.nvimLuaLibrary, ...this.dynamicLibraries])
    const actions: CodeAction[] = []

    for (const lib of this.libraries) {
      if (imported.has(lib.name)) continue

      if (lib.name === matchedModule || lib.modules.includes(matchedModule)) {
        actions.push({
          title: `Import library '${lib.name}' to workspace`,
          kind: CodeActionKind.QuickFix,
          isPreferred: true,
          command: {
            title: 'Import Library',
            command: 'lua._importLibrary',
            arguments: [lib.name],
          },
        })
      }
    }

    return actions
  }

  dispose(): void {
    disposeAll(this.disposables)
  }
}
