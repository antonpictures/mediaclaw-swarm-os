import fs from "fs";
import os from "os";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

let configPort = 3000;
let customDomain = null;

try {
  const configPath = path.join(os.homedir(), ".openclaw", "config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config?.newspaper?.port) {
      configPort = config.newspaper.port;
    }
    if (config?.newspaper?.domain) {
      customDomain = config.newspaper.domain;
    }
  }
} catch (err) {
  console.error("Failed to read MediaClaw config:", err);
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: configPort,
    host: true,
    allowedHosts: [
      "googlemapscoin.com",
      "www.googlemapscoin.com",
      "localhost",
      "georgeanton.com",
      "www.georgeanton.com",
      ...(customDomain ? [customDomain, `www.${customDomain}`] : []),
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
    },
  },
});
