import type { TextDocument } from 'coc.nvim'

export type Locale = 'en-us' | 'es-419' | 'ja-jp' | 'pt-br' | 'zh-cn' | 'zh-tw'

export interface Release {
  version: string
  url: string
}

export type LuaDocument = TextDocument & { languageId: 'lua' }

export type Cmd = (...args: any[]) => unknown
