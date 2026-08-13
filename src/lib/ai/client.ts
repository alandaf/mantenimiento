import { GoogleGenAI } from "@google/genai";

/**
 * Modelo por defecto. `gemini-3.5-flash` está enfocado a trabajo agéntico y es
 * barato, que es lo que pide una priorización que puede correr varias veces al
 * día. Para análisis más exigentes se puede fijar `gemini-3.1-pro-preview` o
 * `gemini-2.5-pro` con GEMINI_MODEL.
 */
export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "Falta GEMINI_API_KEY en el entorno. Añádela a .env y reinicia el contenedor web.",
    );
    this.name = "MissingApiKeyError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let cached: GoogleGenAI | undefined;

export function getClient(): GoogleGenAI {
  if (!hasApiKey()) throw new MissingApiKeyError();
  // El SDK lee GEMINI_API_KEY del entorno por su cuenta.
  cached ??= new GoogleGenAI({});
  return cached;
}
