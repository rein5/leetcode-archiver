import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  // Setting root to src/ makes Vite resolve HTML entry points relative to src/,
  // so popup/index.html ends up at dist/popup/index.html (not dist/src/popup/index.html).
  root: resolve(__dirname, "src"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.tsx"),
        popup: resolve(__dirname, "src/popup/index.html"),
      },
      output: {
        entryFileNames: "[name]/index.js",
        chunkFileNames: "shared/[name].js",
        assetFileNames: "[name]/[name][extname]",
      },
    },
  },
});
