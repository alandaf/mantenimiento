import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Carpeta de adjuntos en el disco del servidor.
 *
 * En producción es un volumen montado (`/app/data/adjuntos`), para que los
 * archivos sobrevivan a cada despliegue. Cambiar de disco más adelante —un
 * volumen adicional— es cambiar esta variable, no la aplicación.
 */
const RAIZ = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "adjuntos"));

export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** Tipos admitidos. La extensión la decide el tipo, nunca el nombre que trae el archivo. */
export const TIPOS_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Comprueba la firma del archivo, no solo el tipo que declara el navegador:
 * el tipo lo manda quien sube, y renombrar un ejecutable a `.pdf` no debe
 * bastar para guardarlo.
 */
export function firmaValida(mime: string, bytes: Uint8Array): boolean {
  const empieza = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  switch (mime) {
    case "application/pdf":
      return empieza(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/jpeg":
      return empieza(0xff, 0xd8, 0xff);
    case "image/png":
      return empieza(0x89, 0x50, 0x4e, 0x47);
    case "image/webp":
      return empieza(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
    default:
      return false;
  }
}

/** Guarda el archivo con un nombre generado y devuelve la ruta relativa. */
export async function guardarArchivo(
  orgId: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  const ext = TIPOS_PERMITIDOS[mime];
  if (!ext) throw new Error(`Tipo no admitido: ${mime}`);
  // Una carpeta por instalación: facilita respaldar o entregar los archivos
  // de un cliente sin tocar los de otro.
  const carpeta = orgId.replace(/[^A-Za-z0-9_-]/g, "");
  const relativa = `${carpeta}/${randomUUID()}.${ext}`;
  await mkdir(path.join(RAIZ, carpeta), { recursive: true });
  await writeFile(path.join(RAIZ, relativa), bytes);
  return relativa;
}

export async function leerArchivo(relativa: string): Promise<Buffer> {
  const completa = path.resolve(RAIZ, relativa);
  // La ruta viene de la base, pero se comprueba igual: si alguna vez se
  // colara un `../`, esto es lo que impide leer fuera de la carpeta.
  if (!completa.startsWith(RAIZ + path.sep)) throw new Error("Ruta fuera de la carpeta de adjuntos");
  return readFile(completa);
}
