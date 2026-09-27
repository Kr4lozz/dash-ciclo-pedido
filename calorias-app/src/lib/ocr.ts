"use client";

// Lectura de capturas de actividad sin IA: OCR con Tesseract.js en el propio navegador.
// El motor y el idioma se sirven desde /ocr (ver scripts/copy-ocr-assets.mjs); la primera
// vez se descargan ~6 MB y luego quedan en caché.

import type { ActivityReading } from "./analysis";
import { parseActivityText } from "./activity-text";

export async function ocrActivity(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ reading: ActivityReading; text: string }> {
  const canvas = await binarize(file);
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("eng", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return { text: data.text, reading: parseActivityText(data.text) };
  } finally {
    await worker.terminate();
  }
}

/**
 * Deja la captura en blanco y negro con texto oscuro sobre fondo claro, que es lo que
 * mejor lee Tesseract. La app Fitness usa fondo negro y números de colores.
 */
async function binarize(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Tu navegador no permite procesar imágenes.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += lum(px, i);
  const dark = sum / (px.length / 4) < 110;
  for (let i = 0; i < px.length; i += 4) {
    const l = lum(px, i);
    // Fondo oscuro: todo lo que brilla es texto. Fondo claro: todo lo oscuro es texto.
    const ink = dark ? l > 70 : l < 150;
    const v = ink ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function lum(px: Uint8ClampedArray, i: number) {
  return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
}
