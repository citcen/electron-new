// vite.config.ts
import { type AddressInfo } from 'net'
import { resolve } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import type { ViteDevServer } from 'vite'
import { defineConfig, build } from 'vite'
import vue from '@vitejs/plugin-vue'

async function bundle(server: ViteDevServer) {
  // resolve the server address
  debugger
  const address = server.httpServer.address() as AddressInfo
  const host = address.address === '127.0.0.1' ? 'localhost' : address.address

  // build the url
  const appUrl = `http://${host}:${address.port}`

  // this is RollupWatcher, but vite do not export its typing...
  const watcher: any = await build({
    configFile: 'vite.config.electron.ts',

    // mode is `development` when running vite
    // mode is `production` when running vite build
    mode: server.config.mode,

    build: {
      watch: {} // to make a watcher
    },
    define: {
      // here we define a vite replacement
      'import.meta.env.ELECTRON_APP_URL': JSON.stringify(appUrl)
    }
  })

  // it returns a string pointing to the electron binary
  const electron = require('electron') as string

  // resolve the electron main file
  const electronMain = resolve(
    server.config.root,
    server.config.build.outDir,
    'main.js'
  )

  let child: ChildProcess | undefined

  // exit the process when electron closes
  function exitProcess() {
    process.exit(0)
  }

  // restart the electron process
  function start() {
    if (child) {
      child.kill()
    }

    child = spawn(electron, [electronMain], {
      windowsHide: false
    })

    child.on('close', exitProcess)
  }

  function startElectron({ code }: any) {
    if (code === 'END') {
      watcher.off('event', startElectron)
      start()
    }
  }

  watcher.on('event', startElectron)

  // watch the build, on change, restart the electron process
  watcher.on('change', () => {
    // make sure we don't kill our application when reloading
    child.off('close', exitProcess)

    start()
  })
}

export default defineConfig((env) => ({
  // nice feature of vite as the mode can be set by the CLI
  base: env.mode === 'production' ? './' : '/',
  plugins: [
    vue(), // only if you are using vue
    {
      name: 'electron-vite',
      configureServer(server) {
        server.httpServer.on('listening', () => {
          bundle(server).catch(server.config.logger.error)
        })
      }
    }
  ]
}))
