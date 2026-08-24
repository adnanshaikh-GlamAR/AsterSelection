import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? "/AsterSelection/",
  build: {
    emptyOutDir: true,
    outDir: "dist-pages",
    rollupOptions: {
      input: "index.html",
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react";
          }

          if (id.includes("node_modules/three")) {
            return "three";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [react()],
});
