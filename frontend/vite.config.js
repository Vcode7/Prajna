import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const backendHost = env.VITE_BACKEND_HOST || env.BACKEND_HOST || '127.0.0.1'
  const backendPort = env.VITE_BACKEND_PORT || env.BACKEND_PORT || env.PORT || '8000'
  const backendUrl = env.VITE_BACKEND_URL || `http://${backendHost}:${backendPort}`

  const frontendPort = parseInt(env.VITE_PORT || env.FRONTEND_PORT || '5173', 10)
  const frontendHost = env.VITE_HOST || env.FRONTEND_HOST || '0.0.0.0'

  return {
    plugins: [react()],
    server: {
      host: frontendHost,
      port: frontendPort,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: frontendHost,
      port: frontendPort,
    },
  }
})
