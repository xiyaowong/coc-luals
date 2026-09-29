import path from 'node:path'
import * as fs from 'fs-extra'

export interface NvimLuaLibrary {
  name: string
  modules: string[]
  path: string
}

export async function scanPlugin(pluginPath: string): Promise<NvimLuaLibrary | undefined> {
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

export async function collectLibraries(runtimePaths: string[]): Promise<NvimLuaLibrary[]> {
  const pluginRoots = new Set<string>()
  const visitedParentDirs = new Set<string>()

  const addPluginRoot = (p: string) => {
    if (!p) return
    const normalized = path.normalize(p)
    pluginRoots.add(normalized)
  }

  const addChildrenDirs = async (parentDir: string) => {
    const normalized = path.normalize(parentDir)
    if (visitedParentDirs.has(normalized)) return
    visitedParentDirs.add(normalized)

    if (!(await fs.pathExists(normalized))) return
    const entries = await fs.readdir(normalized, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory()) {
        addPluginRoot(path.join(normalized, entry.name))
      }
    }
  }

  for (const rtp of runtimePaths) {
    if (!rtp) continue
    const normalized = path.normalize(rtp)

    // 1. lazy.nvim: plugin directories live under the same parent directory
    if (normalized.includes('lazy.nvim')) {
      await addChildrenDirs(path.dirname(normalized))
      continue
    }

    // 2. vim-plug: plugins live under .../plugged/<plugin>
    const plugMatch = normalized.match(/(.*[\\/]plugged)[\\/]/)
    if (plugMatch) {
      await addChildrenDirs(plugMatch[1])
      continue
    }

    // 3. packpath (packer.nvim, pckr.nvim, native packages): .../pack/<pkg>/start or opt/<plugin>
    const packMatch = normalized.match(/(.*[\\/]pack[\\/][^\\/]+[\\/](?:start|opt))[\\/]/)
    if (packMatch) {
      const parentDir = packMatch[1]
      await addChildrenDirs(parentDir)
      const siblingDir = parentDir.endsWith('start')
        ? `${parentDir.slice(0, -5)}opt`
        : `${parentDir.slice(0, -3)}start`
      await addChildrenDirs(siblingDir)
      continue
    }

    // 4. mini.deps: plugins typically installed under .../deps/<plugin>
    const depsMatch = normalized.match(/(.*[\\/]deps)[\\/]/)
    if (depsMatch) {
      await addChildrenDirs(depsMatch[1])
      continue
    }

    // 5. Directly on runtimepath (if it has a lua directory)
    if (await fs.pathExists(path.join(normalized, 'lua'))) {
      addPluginRoot(normalized)
    }
  }

  const results = await Promise.all(
    [...pluginRoots].map(dir => scanPlugin(dir)),
  )

  const seen = new Set<string>()
  return results.filter((lib): lib is NvimLuaLibrary => {
    if (!lib || seen.has(lib.name)) return false
    seen.add(lib.name)
    return true
  })
}
