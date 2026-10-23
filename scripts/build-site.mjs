import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2] || join(root, "dist"));

// 브라우저가 받는 파일만. 새 사이트 파일은 여기에 넣는다
const siteFiles = [
  "index.html", "404.html", "app.js", "map.js", "map-radius.js", "shared.js", "analytics.js",
  "styles.css", "manifest.webmanifest", "robots.txt", "_headers",
  "lib/grid-cells.js", "lib/layers.js", "lib/pins.js", "lib/track.js",
  "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
  "vendor/leaflet/images/layers.png", "vendor/leaflet/images/layers-2x.png",
  "vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-shadow.png",
  "vendor/geist/Geist-Variable.woff2", "vendor/geist/LICENSE.txt",
  "vendor/seoul-dongs.geojson", "vendor/seoul-grid.geojson",
  "icons/icon.svg", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "data/current.json", "data/grid.json",
];

// 출력 경로를 잘못 지정해 원본을 지우지 않게 한다.
for (const file of [...siteFiles, "scripts/build-site.mjs"]) {
  const path = relative(output, join(root, file));
  if (path === "" || (path !== ".." && !path.startsWith(`..${sep}`))) {
    throw new Error("Output folder must not contain source files");
  }
}

rmSync(output, { recursive: true, force: true });
try {
  for (const file of siteFiles) {
    if (!statSync(join(root, file)).isFile()) throw new Error(`Not a file: ${file}`);
  }
  for (const file of siteFiles) {
    const target = join(output, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
} catch (error) {
  rmSync(output, { recursive: true, force: true });
  throw error;
}
