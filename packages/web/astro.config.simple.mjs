// @ts-check
import { defineConfig } from "astro/config"
import solidJs from "@astrojs/solid-js"

// Simple config for the web interface
export default defineConfig({
  integrations: [solidJs()],
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
    port: 4321
  }
})