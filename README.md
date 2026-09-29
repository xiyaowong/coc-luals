# coc-luals

Lua extension using [lua-language-server](https://github.com/LuaLS/lua-language-server) for coc.nvim

This extension uses server binaries extracted from [`LuaLS/vscode-lua`](https://github.com/LuaLS/vscode-lua/).
You can also custom the server path([`luals.serverDir`](settings.md#lualsserverdir)).

## Features

- All supported features by the server
- Neovim Lua development (see [Neovim Lua Development](#neovim-lua-development))

## Install

`:CocInstall coc-luals`

## Neovim Lua Development

coc-luals provides Neovim Lua development support with dynamic library import.

### Settings

- `luals.nvimLua.enable` (default: `false`): Enable Neovim Lua development support, automatically imports `$VIMRUNTIME`.
- `luals.nvimLua.library` (default: `[]`): Pre-imported Neovim lua plugin library names, for example: `["nvim-treesitter"]`.

### Features

- **Completion**: When writing `require('...')` or `---@module '...'`, completion includes modules from runtime plugins. Completing an unimported module dynamically imports its plugin library into the workspace.
- **Code Action**: Provides a quickfix code action (`Import library '<name>' to workspace`) on `require('...')` or `---@module '...'` expressions to dynamically import the corresponding plugin library.

## [Settings (Click me)](settings.md)

## [Config Examples for Distributions (Currently only NixOS)](examples-for-distributions.md)

## Commands

| Command             | Description              |
| ------------------- | ------------------------ |
| `lua.install`       | Install or update server |
| `lua.restart`       | Restart extension        |
| `lua.version`       | Echo server version      |
| `lua.checkUpdate`   | Check update             |
| `lua.showTooltip`   | Show usage information   |
| `lua.reloadFFIMeta` | Reload luajit ffi meta   |

## License

MIT
