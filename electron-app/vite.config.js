const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  root: path.resolve(__dirname, "renderer"),
  publicDir: false,
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
