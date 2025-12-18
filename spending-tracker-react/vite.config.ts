import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "Spending-Tracker",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
});
