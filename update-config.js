import fs from 'node:fs'
import fetch from 'node-fetch'
import lualsSpecs from './coc-luals.json' with { type: 'json' }
import packageJson from './package.json' with { type: 'json' }

const overrids = {
  'Lua.hint.enable': {
    default: true,
  },
  'Lua.misc.parameters': {
    default: [],
    markdownDescription:
      'Additional command line parameters when starting the language service.',
  },
  'Lua.misc.executablePath': {
    markdownDescription: 'Specify the executable path.',
  },
}

async function main() {
  const resp = await fetch(
    'https://github.com/LuaLS/vscode-lua/raw/refs/heads/master/setting/schema.json',
  )
  const schema = await resp.json()
  const properties = schema.properties

  const config = lualsSpecs.configuration
  const commands = lualsSpecs.commands

  // merge config
  console.log('merge config')
  Object.keys(properties).forEach((k) => {
    if (k.includes('.') || !properties[k].properties) config[`Lua.${k}`] = properties[k]
  })
  Object.keys(overrids).forEach((key) => {
    config[key] = { ...config[key], ...overrids[key] }
  })

  // write package.json
  console.log('write package.json')
  packageJson.contributes.configuration.properties = config
  packageJson.contributes.commands = commands
  fs.writeFileSync('./package.json', `${JSON.stringify(packageJson, null, 2)}\n`)

  // write settings.md
  console.log('write settings.md')
  const settingsFileStream = fs.createWriteStream('./settings.md')
  settingsFileStream.write(`
# Get more information

- [schema.json](https://github.com/LuaLS/vscode-lua/blob/master/setting/schema.json)
- [coc-luals.json](./coc-luals.json)
- trigger completion in coc-settings\n\n---\n\n`)
  Object.keys(config).forEach((key) => {
    const v = config[key]
    settingsFileStream.write(
      `## \`${key}\`\n- type: \`${v.type}\`\n- default: \`${JSON.stringify(v.default)}\`\n- description:    ${
        v.description ? v.description : v.markdownDescription
      }\n\n`,
    )
  })
}

main()
