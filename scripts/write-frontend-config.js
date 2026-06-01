const fs = require("fs");
const path = require("path");

const apiBaseUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || "";
const configPath = path.join(process.cwd(), "public", "config.js");

fs.writeFileSync(
  configPath,
  `window.TTM_API_BASE_URL = ${JSON.stringify(apiBaseUrl.replace(/\/$/, ""))};\n`
);

console.log(`Wrote frontend API config: ${apiBaseUrl || "(same origin)"}`);
