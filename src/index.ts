import type { ExtensionContext } from 'coc.nvim'
import { disposeAll, window } from 'coc.nvim'
import { existsSync, mkdirSync } from 'fs-extra'
import { Ctx } from './ctx'
import { registerCommand } from './util'

let ctx: Ctx

export async function activate(context: ExtensionContext): Promise<void> {
  registerCommand('restart', async () => {
    disposeAll(context.subscriptions)
    await activate(context)
  })

  const dataRoot = context.storagePath
  if (!existsSync(dataRoot)) mkdirSync(dataRoot)

  ctx = new Ctx(context)
  context.subscriptions.push(ctx)

  const bin = ctx.resolveBin()
  if (!bin) {
    const installNow = await window.showPrompt('lua-language-server is not found, install now?')
    if (installNow) {
      try {
        await ctx.installer.downloadServer()
      } catch (e) {
        console.error(e)
        window.showErrorMessage('Download lua-language-server failed')
        return
      }
    } else {
      window.showInformationMessage(`You can run ':CocCommand luals.install' to install server manually or provide setting 'serverDir'`)
      return
    }
  }

  await ctx.startServer()
  await ctx.checkUpdate()
}
