import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🛑 THE QUICK FIX: Raise the warning limit so it stops yelling at you
    chunkSizeWarningLimit: 1600,
    
    // 🧳 THE PRO FIX (Code Splitting): Pack the heavy 3D tools into their own separate backpacks!
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-core'; // Put the raw 3D engine here
          }
          if (id.includes('node_modules/@react-three')) {
            return 'three-tools'; // Put Fiber and Drei here
          }
        }
      }
    }
  }
})