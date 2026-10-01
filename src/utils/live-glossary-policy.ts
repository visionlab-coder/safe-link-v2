/** RTT translations predate our glossary normalization; do not reuse them for affected speech. */
export function hasLiveGlossaryTerm(text: string, glossary: Record<string, string>): boolean {
    return Object.entries(glossary).some(([slang, standard]) =>
        [slang, standard.split(/[（(]/)[0].trim()].some(term => {
            if (!term) return false;
            const escaped = term.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
            return Array.from(term).length === 1
                ? new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "u").test(text)
                : text.includes(term);
        }));
}
export function canReuseLiveTranslation(original: string, normalized: string, glossary: Record<string, string>): boolean {
    return original === normalized && !hasLiveGlossaryTerm(original, glossary);
}
