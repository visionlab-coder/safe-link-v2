import { CONSTRUCTION_GLOSSARY } from "@/constants/glossary";
import { normalizeKoreanGlossary } from "@/utils/korean-glossary";
import { preProcessWithGlossary } from "@/utils/construction-glossary";

export function normalizeFreeTalk(text: string, source: string, target: string, terms: Record<string, string>) {
  if (source === "ko") return normalizeKoreanGlossary(text, terms);
  const normalized = target === "ko" ? preProcessWithGlossary(text, source) : text;
  return { original: text, normalized, changes: normalized === text ? [] : [{ from: text, to: normalized }] };
}

let cache: { terms: Record<string, string>; expires: number } | undefined;
export async function freeTalkGlossary(baseUrl: string): Promise<Record<string, string>> {
  if (cache && cache.expires > Date.now()) return cache.terms;
  const response = await fetch(`${baseUrl}/api/v1/glossary?active=true`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("glossary_unavailable");
  const data = await response.json() as { terms: { slang: string; standard: string }[] };
  const terms = { ...CONSTRUCTION_GLOSSARY };
  for (const row of data.terms) if (row.slang && row.standard) terms[row.slang] = row.standard;
  cache = { terms, expires: Date.now() + 60_000 };
  return terms;
}
