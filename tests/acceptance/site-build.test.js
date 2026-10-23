// 수용 테스트: 공개 사이트 허용 목록 빌드 (ai-log/20261023/001_164803_block-internal-files, AC-1~AC-5)
// 기획 단계에서 작성한다. 개발 역할은 이 파일을 수정하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// C-2: browser-facing files only, listed one by one.
const SITE_FILES = [
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
].sort();

function build() {
  const out = join(mkdtempSync(join(tmpdir(), "thanusual-site-")), "dist");
  execFileSync(process.execPath, [join(ROOT, "scripts/build-site.mjs"), out], { cwd: ROOT, stdio: "pipe" });
  return out;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("AC-1 output holds exactly the allowlisted files, nothing left from an earlier build", () => {
  const out = build();
  try {
    writeFileSync(join(out, "stale.md"), "left over");
    mkdirSync(join(out, "lib"), { recursive: true });
    writeFileSync(join(out, "lib", "tiles.js"), "left over");
    execFileSync(process.execPath, [join(ROOT, "scripts/build-site.mjs"), out], { cwd: ROOT, stdio: "pipe" });
    assert.deepEqual(walk(out).map((f) => relative(out, f).split(sep).join("/")).sort(), SITE_FILES);
  } finally {
    rmSync(dirname(out), { recursive: true, force: true });
  }
});

test("AC-2 internal files and tests never reach the output", () => {
  const out = build();
  try {
    for (const p of ["AGENTS.md", "CLAUDE.md", "README.md", "ai-log", ".crossgate", ".agents", ".claude", ".cursor",
      ".github", "docs", "scripts", "tests", "functions", "package.json", "skills-lock.json", "wrangler.toml",
      ".gitignore", "places.json", ".dev.vars", "lib/tiles.js", "vendor/geist/GeistMono-Variable.woff2"]) {
      assert.equal(existsSync(join(out, p)), false, `${p} must not be published`);
    }
    const tests = walk(out).filter((f) => f.endsWith(".test.js")).map((f) => relative(out, f));
    assert.deepEqual(tests, []);
  } finally {
    rmSync(dirname(out), { recursive: true, force: true });
  }
});

test("AC-3 every local asset the pages and scripts reference is in the output", () => {
  const out = build();
  try {
    const refs = [];
    for (const page of ["index.html", "404.html"]) {
      const html = readFileSync(join(out, page), "utf8");
      for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (!/^[a-z]+:/i.test(url) && url !== "/") refs.push(url.replace(/^\.?\//, ""));
      }
    }
    for (const file of walk(out).filter((f) => f.endsWith(".js") && !f.includes(`${join(out, "vendor")}`))) {
      const src = readFileSync(file, "utf8");
      // Imports resolve against the module; fetched paths like "./vendor/x.geojson" resolve against the page.
      for (const [, spec] of src.matchAll(/(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["']/g)) {
        refs.push(relative(out, join(dirname(file), spec)));
      }
      for (const [, path] of src.matchAll(/["']\.\/([^"'\s]+\.(?:json|geojson|png|svg|css|woff2))["']/g)) refs.push(path);
    }
    // CSS url()s resolve against the stylesheet (leaflet.css images, the Geist font).
    for (const file of walk(out).filter((f) => f.endsWith(".css"))) {
      for (const [, url] of readFileSync(file, "utf8").matchAll(/url\(["']?([^"')#]+)["']?\)/g)) {
        refs.push(relative(out, join(dirname(file), url)));
      }
    }
    const manifest = JSON.parse(readFileSync(join(out, "manifest.webmanifest"), "utf8"));
    for (const icon of manifest.icons) refs.push(icon.src.replace(/^\//, ""));
    for (const ref of refs) assert.ok(existsSync(join(out, ref)), `${ref} is referenced but missing`);
    assert.ok(refs.length > 10);
  } finally {
    rmSync(dirname(out), { recursive: true, force: true });
  }
});

test("AC-4 a missing allowlisted file fails the build instead of shipping without it", () => {
  // A copy of the repo without index.html, so the script can resolve paths from its own folder or the cwd.
  const copy = mkdtempSync(join(tmpdir(), "thanusual-repo-"));
  const skip = new Set([".git", "node_modules", "ai-log", ".claude", ".wrangler", "dist", "index.html"]);
  try {
    cpSync(ROOT, copy, { recursive: true, filter: (p) => p === ROOT || !skip.has(relative(ROOT, p)) });
    assert.equal(existsSync(join(copy, "index.html")), false);
    assert.throws(() => execFileSync(process.execPath, [join(copy, "scripts/build-site.mjs"), join(copy, "dist")], {
      cwd: copy, stdio: "pipe",
    }));
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test("AC-5 Pages publishes the build folder, and the build runs through npm", () => {
  assert.match(readFileSync(join(ROOT, "wrangler.toml"), "utf8"), /^pages_build_output_dir\s*=\s*"dist"\s*$/m);
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts.build, /scripts\/build-site\.mjs/);
  assert.match(pkg.scripts.dev, /build/);
  assert.match(readFileSync(join(ROOT, ".gitignore"), "utf8"), /^\/?dist\/?$/m);
});
