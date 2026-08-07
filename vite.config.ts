import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "node",
    // Only the pure, DOM-free lib/ helpers are covered so far — no jsdom/
    // component-rendering setup yet, so this stays a plain Node environment
    // until component tests actually need one.
    include: ["src/**/*.test.ts"],
  },
});
