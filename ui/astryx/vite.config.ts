import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../../board/files/www/luci-static/astryx",
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/main.tsx"),
      formats: ["es"],
      fileName: () => "astryx.js",
      cssFileName: "astryx",
    },
    rollupOptions: {
      onwarn(warning, handler) {
        if (warning.code !== "MODULE_LEVEL_DIRECTIVE") handler(warning);
      },
      output: { assetFileNames: "[name][extname]" },
    },
  },
});
