import type { ExtensionContext } from 'coc.nvim'
import { disposeAll, window } from 'coc.nvim'
import { ensureDir } from 'fs-extra'
import { Ctx } from './ctx'
import { registerCommand, withPrefix } from './util'

let ctx: Ctx | undefined

export async function activate(context: ExtensionContext): Promise<void> {
  context.subscriptions.push(
    registerCommand('restart', async () => {
      await deactivate()
      disposeAll(context.subscriptions)
      await activate(context)
    }),
  )

  const dataRoot = context.storagePath
  await ensureDir(dataRoot)

  ctx = new Ctx(context)
  context.subscriptions.push(ctx)

  if (!ctx.config.useCustomServer) {
    const bin = ctx.resolveBin()
    if (!bin) {
      const installNow = await window.showPrompt(withPrefix('lua-language-server is not found, install now?'))
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
  }

  await ctx.startServer()
  await ctx.checkUpdate()
}

export async function deactivate(): Promise<void> {
  if (ctx) {
    await ctx.dispose()
    ctx = undefined
  }
}
