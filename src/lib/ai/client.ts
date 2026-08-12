import Anthropic from "@anthropic-ai/sdk";

/** Modelo por defecto. Se puede fijar otro con ANTHROPIC_MODEL. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "Falta ANTHROPIC_API_KEY en el entorno. Añádela a .env y reinicia el contenedor web.",
    );
    this.name = "MissingApiKeyError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | undefined;

export function getClient(): Anthropic {
  if (!hasApiKey()) throw new MissingApiKeyError();
  cached ??= new Anthropic();
  return cached;
}
