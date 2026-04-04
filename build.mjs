import { build } from "vite";
import preact from "@preact/preset-vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Background and content scripts must be IIFE bundles — Firefox MV2 loads
 * them as plain scripts, not ES modules, so `import` statements are illegal.
 * Each gets its own build because IIFE format disables code splitting and
 * therefore doesn't support multiple entry points in one pass.
 *
 * The popup is loaded by an HTML page which can use ES modules normally.
 */

async function buildIife(name, entry, cleanDist) {
  await build({
    plugins: [preact()],
    root: resolve(__dirname, "src"),
    // Only copy public/ (manifest, icons) on the first build
    publicDir: cleanDist ? resolve(__dirname, "public") : false,
    build: {
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: cleanDist,
      sourcemap: true,
      rollupOptions: {
        input: { [name]: entry },
        output: {
          format: "iife",
          name: "LeetCodeArchiver",
          entryFileNames: "[name]/index.js",
          assetFileNames: "[name]/[name][extname]",
        },
      },
    },
  });
}

await buildIife(
  "background",
  resolve(__dirname, "src/background/index.ts"),
  true  // cleans dist/ and copies public/
);

await buildIife(
  "content",
  resolve(__dirname, "src/content/index.tsx"),
  false
);

// Popup: standard HTML entry point, ES modules are fine in a web page context
await build({
  plugins: [preact()],
  root: resolve(__dirname, "src"),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: { popup: resolve(__dirname, "src/popup/index.html") },
      output: {
        entryFileNames: "[name]/index.js",
        chunkFileNames: "shared/[name].js",
        assetFileNames: "[name]/[name][extname]",
      },
    },
  },
});
