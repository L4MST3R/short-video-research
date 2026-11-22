import { env } from "cloudflare:workers";
import {
  aiBaseUrl,
  ConfigurationError,
  createGatewayFetch,
  gatewayRefusal,
  refusalFromError,
} from "@every-app/sdk/server";

// The model the app asks OpenRouter for. Listed in everyapp.config.ts.
export const AI_MODEL = "openai/gpt-4o-mini";

/** What an AI call gives back: the parsed JSON, or why AI isn't available. */
export type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; unavailable: true; setup: string | null }
  | { ok: false; unavailable: false; message: string };

/**
 * Asks the model for a JSON object. `task` names the job on the prompt's
 * first line. A Gateway refusal (no key set, a cap reached) comes back as
 * `unavailable` for the page to show, never as a crash.
 */
export async function askJson<T>(
  task: string,
  instructions: string,
  input: string,
  parse: (value: unknown) => T | null,
): Promise<AiResult<T>> {
  let response: Response;
  try {
    const gatewayFetch = createGatewayFetch({ env });
    response = await gatewayFetch(`${aiBaseUrl("openrouter")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `TASK: ${task}\n${instructions}\nAnswer with one JSON object and nothing else.` },
          { role: "user", content: input },
        ],
      }),
    });
  } catch (error) {
    const refusal = refusalFromError(error);
    if (refusal) return { ok: false, unavailable: true, setup: refusal.setup };
    if (error instanceof ConfigurationError) return { ok: false, unavailable: true, setup: null };
    throw error;
  }
  if (!response.ok) {
    const refusal = await gatewayRefusal(response.clone());
    if (refusal) return { ok: false, unavailable: true, setup: refusal.setup };
    return { ok: false, unavailable: false, message: `The model answered ${response.status}. Try again.` };
  }
  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content ?? "";
  let value: T | null = null;
  try {
    value = parse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  } catch {
    value = null;
  }
  if (value === null) return { ok: false, unavailable: false, message: "The model's answer couldn't be read. Try again." };
  return { ok: true, value };
}
