import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    proxy: {
      '/identity': { target: 'http://localhost:4000', rewrite: (path) => path.replace(/^\/identity/, '') },
      '/routing': { target: 'http://localhost:5001', rewrite: (path) => path.replace(/^\/routing/, '') },
      '/tracking': { target: 'http://localhost:8081', ws: true, rewrite: (path) => path.replace(/^\/tracking/, '') },
    },
  },
});
