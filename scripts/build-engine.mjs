import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const engineDir = resolve(rootDir, "packages/engine-wasm");
const distDir = resolve(engineDir, "dist");
const sourceWasm = resolve(distDir, "engine.wasm");
const outputWasm = resolve(rootDir, "apps/web/public/engine/engine.wasm");

mkdirSync(distDir, { recursive: true });

const buildResult = spawnSync(
  "zig",
  [
    "build-exe",
    "src/engine.zig",
    "-target",
    "wasm32-freestanding",
    "-O",
    "ReleaseFast",
    "-fno-entry",
    "-rdynamic",
    "-ofmt=wasm",
    `-femit-bin=${sourceWasm}`
  ],
  {
    cwd: engineDir,
    stdio: "inherit"
  }
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!existsSync(sourceWasm)) {
  console.error("Expected Zig to emit engine.wasm, but no output file was found.");
  process.exit(1);
}

mkdirSync(dirname(outputWasm), { recursive: true });
copyFileSync(sourceWasm, outputWasm);

console.log(`Synced WebAssembly engine to ${outputWasm}`);
