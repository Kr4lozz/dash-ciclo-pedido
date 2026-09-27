"use client";

export interface PreparedImage {
  /** JPEG en base64 (sin el prefijo data:) */
  data: string;
  mediaType: "image/jpeg";
  /** data URL para la vista previa */
  previewUrl: string;
}

/**
 * Reduce la foto a `maxSide` px en su lado mayor y la recomprime en JPEG.
 * Una foto de celular (3–8 MB) queda en ~200–400 KB: sube rápido, cabe en el
 * límite de Vercel y gasta menos tokens.
 */
export async function prepareImage(
  file: File,
  maxSide = 1280,
  quality = 0.85,
): Promise<PreparedImage> {
  const source = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite procesar imágenes.");
  ctx.fillStyle = "#ffffff"; // fondo para PNG con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source.image, 0, 0, w, h);
  source.close();

  const previewUrl = canvas.toDataURL("image/jpeg", quality);
  return { data: previewUrl.slice(previewUrl.indexOf(",") + 1), mediaType: "image/jpeg", previewUrl };
}

async function decode(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  try {
    // Respeta la orientación EXIF de las fotos tomadas con el celular.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return {
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("No se pudo leer la imagen. Prueba con una foto en JPG o PNG.");
    }
  }
}
