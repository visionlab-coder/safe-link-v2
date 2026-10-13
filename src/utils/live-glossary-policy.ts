import { containsKoreanGlossaryTerm, glossaryDeliveryTerm } from "./korean-glossary";

/** RTT translations predate our glossary normalization; do not reuse them for affected speech. */
export function hasLiveGlossaryTerm(text: string, glossary: Record<string, string>): boolean {
    return Object.entries(glossary).some(([slang, standard]) =>
        [slang, glossaryDeliveryTerm(slang, standard)].some(term => containsKoreanGlossaryTerm(text, term)));
}
export function canReuseLiveTranslation(original: string, normalized: string, glossary: Record<string, string>): boolean {
    return original === normalized && !hasLiveGlossaryTerm(original, glossary);
}
