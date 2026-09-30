# coc-luals

Lua extension using [lua-language-server](https://github.com/LuaLS/lua-language-server) for coc.nvim

This extension uses server binaries extracted from [`LuaLS/vscode-lua`](https://github.com/LuaLS/vscode-lua/).
You can also custom the server path([`luals.serverDir`](settings.md#lualsserverdir)).

## Features

- All supported features by the server
- Neovim Lua development (see [Neovim Lua Development](#neovim-lua-development))
- Addon manager (see [Addon Manager](#addon-manager))

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

## Addon Manager

Manage addons from [LuaLS/LLS-Addons](https://github.com/LuaLS/LLS-Addons).

Run `:CocCommand lua.openAddonManager` or `:CocList lls_addons` to open the addon manager list.

### Status Indicators

- `[+]`: Enabled
- `[*]`: Installed (disabled)
- `[-]`: Not installed

### Keymaps & Actions

- `<CR>`: Enable addon (default action; installs automatically if not yet installed).
- `<Tab>`: Open action menu to choose an action:
  - `enable`: Enable the addon and apply settings
  - `disable`: Disable the addon and revert settings
  - `install`: Download and install the addon
  - `uninstall`: Uninstall the addon
  - `view on github`: Open the addon repository page on GitHub in browser

## [Settings (Click me)](settings.md)

## [Config Examples for Distributions (Currently only NixOS)](examples-for-distributions.md)

## Commands

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `lua.install`      | Install or update server        |
| `lua.restart`      | Restart extension               |
| `lua.checkUpdate`  | Check server update             |
| `lua.showVersion`  | Show server version             |
| `lua.showUsage`    | Show status and resource usage  |
| `lua.showChangelog`| Show server changelog           |
| `lua.openAddonManager` | Open addon manager          |
| `lua.reloadFFIMeta`| Reload LuaJIT FFI meta          |

## License

MIT
