# 🌙 coc-luals

<p align="center">
  <strong>Lua Language Server extension for coc.nvim</strong><br>
  <em>Full LuaLS feature support with tailored Neovim Lua integration</em>
</p>

<p align="center">
  <a href="https://github.com/xiyaowong/coc-luals/releases"><img src="https://img.shields.io/npm/v/coc-luals.svg?style=flat-square&color=blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/LuaLS/lua-language-server"><img src="https://img.shields.io/badge/powered%20by-LuaLS-000080.svg?style=flat-square" alt="LuaLS"></a>
</p>

---

**coc-luals** is a [coc.nvim](https://github.com/neoclide/coc.nvim) extension powered by [lua-language-server (LuaLS)](https://github.com/LuaLS/lua-language-server). It provides the full feature set of [`LuaLS/vscode-lua`](https://github.com/LuaLS/vscode-lua), along with dedicated Neovim Lua development utilities like dynamic library imports and integrated addon management.

---

## ✨ Features

- 🎯 **Full LuaLS Support**: Complete language server features and configuration schema, using official binaries extracted from `LuaLS/vscode-lua`.
- ⚡ **Auto-Download**: Automatically downloads prebuilt binaries on first launch (Windows, macOS, Linux), or point to your own binary.
- 🧩 **Neovim Lua Development**: Auto `$VIMRUNTIME` loading, on-demand plugin library imports on `require('...')`, and quickfix code actions.
- 📦 **Addon Manager**: Browse, install, and toggle official [LuaLS/LLS-Addons](https://github.com/LuaLS/LLS-Addons) directly in coc.nvim via `:CocList lls_addons`.

---

## 📦 Installation

Install via coc.nvim:

```vim
:CocInstall coc-luals
```

> 💡 On first launch, if `lua-language-server` is not found, `coc-luals` prompts to download the prebuilt binary automatically.

---

## 📖 Neovim Lua Development

Designed for editing Neovim configurations and plugins:

- **Automatic `$VIMRUNTIME`**: Provides autocompletion and documentation for Neovim runtime APIs (`vim.api.*`, `vim.fn.*`, etc.).
- **Runtime Plugin Completion**: Autocomplete suggestions include modules from installed runtime plugins.
- **Dynamic Library Import**: Instead of adding every installed plugin to `workspace.library` at startup, definitions are loaded on-the-fly when used.
- **Code Action**: Offers `Import library '<name>' to workspace` on unimported module calls.

### Configuration

```jsonc
// In :CocConfig
{
  // Enable Neovim Lua development support (auto-imports $VIMRUNTIME)
  "luals.nvimLua.enable": true,

  // Optional: pre-import specific plugin libraries
  "luals.nvimLua.library": [
    "nvim-treesitter",
    "plenary.nvim"
  ]
}
```

---

## 🧩 Addon Manager

Manage addons from [LuaLS/LLS-Addons](https://github.com/LuaLS/LLS-Addons) (e.g. definitions and annotations for Busted, LÖVE, OpenResty, Hammerspoon).

Open the addon list:

```vim
:CocList lls_addons
" or
:CocCommand lua.openAddonManager
```

### Status Indicators

| Indicator | Status |
| :-------: | :----- |
| `[+]` | Enabled in workspace |
| `[*]` | Installed (disabled) |
| `[-]` | Available (not installed) |

### Actions

- `<CR>`: Enable addon (downloads and installs automatically if not yet present).
- `<Tab>`: Open action menu:
  - `enable`: Enable addon and apply workspace settings
  - `disable`: Disable addon and revert settings
  - `install`: Download and cache addon
  - `uninstall`: Remove local addon cache
  - `view on github`: Open repository in browser

---

## 🛠️ Server Executable

- **Default**: Uses official release binaries extracted from `LuaLS/vscode-lua`.
- **Custom Executable / Directory**: To use a system package or custom build:
  ```jsonc
  {
    "Lua.misc.executablePath": "lua-language-server"
    // or
    // "luals.serverDir": "/path/to/lua-language-server"
  }
  ```

---

## ⌨️ Commands

| Command | Description |
| :------ | :---------- |
| `lua.install` | Install or update server binary |
| `lua.restart` | Restart Lua language server and extension |
| `lua.checkUpdate` | Check for server binary updates |
| `lua.showVersion` | Show current Lua Language Server version |
| `lua.showUsage` | Display server status and resource usage |
| `lua.showChangelog` | Open and read server changelog |
| `lua.openAddonManager` | Open the Addon Manager list |
| `lua.reloadFFIMeta` | Reload LuaJIT FFI metadata definitions |

---

## ⚙️ Settings

`coc-luals` supports all upstream LuaLS configuration options.

- 📖 **[Full Settings Reference](settings.md)**
- 🐧 **[Config Examples for Distributions (e.g. NixOS)](examples-for-distributions.md)**

---

## 📄 License

[MIT](LICENSE) © [wongxy](https://github.com/xiyaowong)
