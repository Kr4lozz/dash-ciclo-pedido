// Copia el motor de OCR (Tesseract.js) y el idioma a public/ocr para servirlos desde la
// propia app en lugar de un CDN externo. Se ejecuta antes de `dev` y `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
const pkg = (name) => dirname(require.resolve(`${name}/package.json`));

const files = [
  [join(pkg("tesseract.js"), "dist", "worker.min.js"), join(out, "worker.min.js")],
  ...["relaxedsimd-lstm", "simd-lstm", "lstm"].map((v) => [
    join(pkg("tesseract.js-core"), `tesseract-core-${v}.wasm.js`),
    join(out, "core", `tesseract-core-${v}.wasm.js`),
  ]),
  [
    join(pkg("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"),
    join(out, "lang", "eng.traineddata.gz"),
  ],
];

for (const [from, to] of files) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log(`OCR: ${files.length} archivos copiados a public/ocr`);
