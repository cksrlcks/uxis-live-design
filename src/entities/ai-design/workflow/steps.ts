import { generateHtml } from "../api/generate-html.server";
import { resolveReferences, markDone, markFailed } from "../api/generation-mutations.server";
import type { GenerationInput } from "../model/types";

export async function resolveAiDesignReferences(id: string) {
  "use step";
  return resolveReferences(id);
}

export async function generateAiDesignHtml(input: GenerationInput, imageUrls: string[]) {
  "use step";
  return generateHtml(input, imageUrls);
}

export async function markAiDesignDone(id: string, html: string) {
  "use step";
  await markDone(id, html);
}

export async function markAiDesignFailed(id: string, message: string) {
  "use step";
  await markFailed(id, message);
}
