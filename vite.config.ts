import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Deployer setup writes OAuth keys to `.env` in-process; restarting Vite
      // mid-save breaks the client with a connection error.
      ignored: ['**/.env', '**/.env.*'],
    },
  },
  plugins: [
    devtools(),
    tanstackStart({ srcDirectory: 'app' }),
    tailwindcss(),
    viteReact(),
  ],
})
