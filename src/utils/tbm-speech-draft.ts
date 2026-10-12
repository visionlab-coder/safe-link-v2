import { normalizeKoAsync } from "@/utils/normalize";

/** Foreign speech stays visible as STT source; only Korean enters the existing TBM pipeline. */
export async function prepareTbmSpeechDraft(text: string, language: string, target: string | null, request: typeof fetch = fetch) {
  let sourceLanguage = language.toLowerCase().split("-")[0];
  if (sourceLanguage === "jp") sourceLanguage = "ja";
  let korean = text;
  if (sourceLanguage !== "ko") {
    const response = await request("/api/tbm/speech-draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sourceLanguage, siteId: target === "nationwide" ? null : Number(target), nationwide: target === "nationwide" }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("tbm_speech_draft_failed");
    const result = await response.json();
    if (typeof result.text !== "string" || !result.text.trim()) throw new Error("tbm_speech_draft_empty");
    korean = result.text.trim();
  }
  return (await normalizeKoAsync(korean)).normalized;
}
