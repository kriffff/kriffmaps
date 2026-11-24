// Copies the Tesseract OCR worker, WASM core and English language data from
// node_modules into public/tesseract/ so they are served from our own origin
// instead of the jsdelivr CDN (tesseract.js's default). Runs before dev/build;
// the output folder is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "tesseract");

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const tesseract = pkgDir("tesseract.js");
const core = pkgDir("tesseract.js-core");
const eng = pkgDir("@tesseract.js-data/eng");

// createWorker("eng") uses the LSTM-only engine, so only the *-lstm cores and
// the best_int language data are ever requested. Which core loads depends on
// the browser's SIMD support, so ship all three variants.
const files = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  [join(core, "tesseract-core-lstm.wasm.js"), "core/tesseract-core-lstm.wasm.js"],
  [join(core, "tesseract-core-simd-lstm.wasm.js"), "core/tesseract-core-simd-lstm.wasm.js"],
  [
    join(core, "tesseract-core-relaxedsimd-lstm.wasm.js"),
    "core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
  [join(eng, "4.0.0_best_int", "eng.traineddata.gz"), "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
}
console.log(`Copied ${files.length} Tesseract assets to public/tesseract/`);
