import type { DocumentSelector } from 'coc.nvim'

export const COMMAND_NAME = 'lua'
export const CONFIG_NAME = 'luals'
export const ROOT_NAME = 'luals'
export const CLIENT_ID = 'luals'

export const LUA_DOCUMENT_SELECTOR = { language: 'lua' } as const satisfies DocumentSelector

export const CONFIGS_NEED_RESTART
  = [
    'Lua.misc.executablePath',
    'Lua.misc.parameters',
    ...(['serverDir', 'logPath', 'locale'].map(item => `${CONFIG_NAME}.${item}`)),
  ]
