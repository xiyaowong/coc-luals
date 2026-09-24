# coc-luals

Lua extension using [lua-language-server](https://github.com/LuaLS/lua-language-server) for coc.nvim

This extension uses server binaries extracted from [`LuaLS/vscode-lua`](https://github.com/LuaLS/vscode-lua/).
You can also custom the server path([`luals.serverDir`](settings.md#lualsserverdir)).

## Features

- All supported features by the server
- Nvim lua development (check setting `luals.nvimLua.enable`)

## Install

`:CocInstall coc-luals`

## [Settings (Click me)](settings.md)

## [Config Examples for Distributions (Currently only NixOS)](examples-for-distributions.md)

## Commands

| Command              | Description              |
| -------------------- | ------------------------ |
| `lua.install`        | Install or update server |
| `lua.restart`        | Restart extension        |
| `lua.version`        | Echo server version      |
| `lua.checkUpdate`    | Check update             |
| `lua.showTooltip`    | Show usage information   |
| `lua.exportDocument` |                          |
| `lua.reloadFFIMeta`  |                          |

## License

MIT
