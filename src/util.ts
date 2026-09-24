import type { TextDocument } from 'coc.nvim'
import { commands } from 'coc.nvim'

export const COMMAND_NAME = 'lua'
export const CONFIG_NAME = 'luals'
export const ROOT_NAME = 'luals'

export type Locale = 'en-us' | 'es-419' | 'ja-jp' | 'pt-br' | 'zh-cn' | 'zh-tw'

export interface Release {
  version: string
  url: string
}

export type LuaDocument = TextDocument & { languageId: 'lua' }

export function isLuaDocument(document: TextDocument): document is LuaDocument {
  const ret = document.languageId === 'lua'
  return ret
}

export type Cmd = (...args: any[]) => unknown

export function registerCommand(name: string, cmd: Cmd, internal = false) {
  return commands.registerCommand(`${COMMAND_NAME}.${name}`, cmd, internal)
}

export function withPrefix(content: string): string {
  return `[coc-luals] ${content}`
}

/**
 * Compare two semver-style version strings.
 *
 * Ignores a leading "v" and build metadata (e.g. "1.2.3+build.5"). Missing
 * numeric segments count as zero ("1.2" === "1.2.0"). Prerelease rules follow
 * semver: a version without a tag outranks one with a tag, numeric identifiers
 * rank below alphanumeric ones, and fewer identifiers mean lower precedence
 * ("1.0-a" < "1.0-a.1").
 *
 * @returns -1 if v1 < v2, 1 if v1 > v2, 0 if equal.
 */
export function compareVersion(v1: string, v2: string): number {
  const parse = (version: string) => {
    // Strip the optional "v" prefix and any "+build" metadata.
    const clean = version.trim().replace(/^v/i, '').replace(/\+.*$/, '')
    // Split core version from prerelease at the first dash.
    const dash = clean.indexOf('-')
    const core = (dash === -1 ? clean : clean.slice(0, dash))
      .split('.')
      .map(part => Number.parseInt(part, 10) || 0)
    const pre = dash === -1 ? [] : clean.slice(dash + 1).split('.')
    return { core, pre }
  }

  const a = parse(v1)
  const b = parse(v2)

  // Compare core segments; missing segments count as zero.
  const length = Math.max(a.core.length, b.core.length)
  for (let i = 0; i < length; i++) {
    const n1 = a.core[i] ?? 0
    const n2 = b.core[i] ?? 0
    if (n1 !== n2) return n1 < n2 ? -1 : 1
  }

  // A version without a prerelease tag outranks one with a tag.
  if (a.pre.length === 0 || b.pre.length === 0) {
    return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1
  }

  // Compare prerelease identifiers.
  const ids = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < ids; i++) {
    const p1 = a.pre[i]
    const p2 = b.pre[i]
    // Fewer identifiers means lower precedence.
    if (p1 === undefined) return -1
    if (p2 === undefined) return 1
    const num1 = /^\d+$/.test(p1)
    const num2 = /^\d+$/.test(p2)
    if (num1 && num2) {
      // Both numeric: compare by value.
      const diff = Number(p1) - Number(p2)
      if (diff !== 0) return diff < 0 ? -1 : 1
    } else if (num1 !== num2) {
      // Numeric identifiers rank below alphanumeric ones.
      return num1 ? -1 : 1
    } else if (p1 !== p2) {
      // Both alphanumeric: compare lexically.
      return p1 < p2 ? -1 : 1
    }
  }

  return 0
}
