import policy from "../constants/glossary-delivery-policy.json";

export const GLOSSARY_POLICY_VERSION = policy.version;
const reviewed: Record<string, string> = policy.reviewedTerms;
const preserved = new Set(policy.preserveTerms);
const ambiguous = new Set(policy.ambiguousTerms);
const actions = new Set(policy.actionTerms);
const wordCharacter = /[\p{L}\p{M}\p{N}_]/u;
const particles = /^(?:은|는|이|가|을|를|과|와|의|에|에서|에게|한테|께|에게서|한테서|로|으로|로서|으로서|로써|으로써|랑|이랑|하고|도|만|부터|까지|보다|처럼|마다|조차|마저|밖에|이라도|라도|이든|든|이나|나|에는|에서는|에도|에만|에서도|에서만|으로는|로는|으로도|로도|으로만|로만|까지는|부터는|만은|만을|만이|만으로|들|들이|들을|들은|들과|들만|입니다|입니까|이다|이라고|라는|이라면|라면|이지만|지만|인데|인데도|이며|이고|이고는)$/u;
const actionEnding = /^(?:하(?:다|고|면|지만|지|지마|지마세요|지말고|지말아야|기|기전에|기전에는|도록|세요|십시오|겠습니다|는|는지|는동안|면서|거나)|해(?:요|라|서|도|야|야만|야합니다|주세요)?|했(?:다|고|으면|습니다)|합(?:니다|시다))$/u;

/** Reference descriptions stay in `standard`; only a single unambiguous term enters speech. */
export function glossaryDeliveryTerm(slang: string, standard: string): string {
    if (preserved.has(slang)) return slang;
    if (reviewed[slang]) return reviewed[slang];
    // A parenthesis in the middle may split a verb (주입(그라우팅)한다): do not truncate it.
    if (/[（(]/u.test(standard) && !/[)）]\s*$/u.test(standard)) return slang;
    const core = standard.split(/[（(]/u)[0].trim();
    // Do not guess among unreviewed alternatives or splice a partial explanation into a sentence.
    if (!core || /[,，/;；\n:：=]/u.test(core) || /[)）]/u.test(core)) return slang;
    return core;
}

export function hasKoreanTermAt(text: string, index: number, term: string): boolean {
    if (index > 0 && wordCharacter.test(Array.from(text.slice(0, index)).at(-1)!)) return false;
    const end = index + term.length;
    if (!wordCharacter.test(text.slice(end, end + 1))) {
        // A bare dictionary homonym must not rewrite a normal verb ("가도 됩니까?").
        return !ambiguous.has(term);
    }
    const suffix = text.slice(end).match(/^[\p{L}\p{M}\p{N}_]+/u)?.[0] ?? "";
    if (ambiguous.has(term)) return false;
    return particles.test(suffix) || (actions.has(term) && actionEnding.test(suffix));
}

export function containsKoreanGlossaryTerm(text: string, term: string): boolean {
    if (!term) return false;
    let index = text.indexOf(term);
    while (index !== -1) {
        if (hasKoreanTermAt(text, index, term)) return true;
        index = text.indexOf(term, index + term.length);
    }
    return false;
}

function adjustedParticle(text: string, end: number, replacement: string): { length: number; text: string } | null {
    const final = replacement.codePointAt(replacement.length - 1)!;
    if (final < 0xac00 || final > 0xd7a3) return null;
    const jong = (final - 0xac00) % 28;
    const tail = text.slice(end).match(/^[\p{L}\p{M}\p{N}_]+/u)?.[0] ?? "";
    const pair = [["은", "는"], ["이", "가"], ["을", "를"], ["과", "와"]].find(p => p.includes(tail));
    if (pair) return { length: tail.length, text: jong ? pair[0] : pair[1] };
    if (["으로", "로"].includes(tail)) return { length: tail.length, text: jong && jong !== 8 ? "으로" : "로" };
    return null;
}

/** Scan the ORIGINAL once: longest whole term, no recursive replacement, no sentence rewriting. */
export function normalizeKoreanGlossary(text: string, dictionary: Record<string, string>) {
    const entries = Object.entries(dictionary).filter(([term]) => term.trim().length > 0)
        .map(([term, standard]) => [term, glossaryDeliveryTerm(term, standard)] as const);
    // A delivery term is terminal across STT → draft → translation as well as within a single pass.
    const terminal = new Set(entries.map(([, delivery]) => delivery));
    const candidates = new Map(entries.map(([term, delivery]) => [term, terminal.has(term) ? term : delivery]));
    for (const delivery of terminal) candidates.set(delivery, delivery);
    const sorted = [...candidates].sort((a, b) => b[0].length - a[0].length);
    const changes: { from: string; to: string }[] = [];
    let normalized = "";
    for (let index = 0; index < text.length;) {
        const match = sorted.find(([term]) => text.startsWith(term, index) && hasKoreanTermAt(text, index, term));
        if (!match) { normalized += text[index++]; continue; }
        const [from, to] = match;
        normalized += to;
        index += from.length;
        if (from !== to) {
            changes.push({ from, to });
            const particle = adjustedParticle(text, index, to);
            if (particle) { normalized += particle.text; index += particle.length; }
        }
    }
    return { original: text, normalized, changes, policyVersion: GLOSSARY_POLICY_VERSION };
}
