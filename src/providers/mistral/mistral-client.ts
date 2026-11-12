// The one place that talks to Mistral's API over HTTP. It never logs requests or
// answers: they contain document text (SECURITY §5).

export const MISTRAL_API_URL = "https://api.mistral.ai";

export type MistralClient = { apiKey: string; fetchImpl?: typeof fetch };

export type PostResult = { ok: true; json: unknown } | { ok: false; reason: "TIMEOUT" | "ERROR"; status: number | null };

export async function postToMistral(client: MistralClient, path: string, body: unknown, timeoutMs: number): Promise<PostResult> {
  const fetchImpl = client.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${MISTRAL_API_URL}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${client.apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, reason: "ERROR", status: response.status };
    return { ok: true, json: await response.json() };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { ok: false, reason: timedOut ? "TIMEOUT" : "ERROR", status: null };
  }
}
