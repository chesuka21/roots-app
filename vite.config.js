import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, /api/* se proxé a la app de producción (las funciones serverless
    // solo existen en Vercel). Así `npm run dev` funciona igual que `vercel dev`.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "https://roots-app-gamma.vercel.app",
        changeOrigin: true,
      },
    },
  },
});
