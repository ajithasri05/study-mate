import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/parse-file': 'http://localhost:8000',
      '/summarize': 'http://localhost:8000',
      '/generate-mcqs': 'http://localhost:8000',
      '/rephrase': 'http://localhost:8000',
      '/save-quiz': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
    }
  }
})
