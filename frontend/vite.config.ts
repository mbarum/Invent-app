import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// FIX: Add url import to derive __dirname in ES module context
import { fileURLToPath } from 'url';

// FIX: __dirname is not available in ES modules. This correctly derives it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@masuma-ea/types': path.resolve(__dirname, '../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 5173, // Default vite port
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend port
        changeOrigin: true,
      },
      // Proxy doc uploads to the backend server
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});