/** Display-only Korean assistance. Never use these labels as API values. */
export function koreanHelpText(text: string, korean: string, language: string, enabled = true): string {
  if (!enabled || language.toLowerCase().split(/[-_]/)[0] === "ko" || !korean || !text || text.trim() === korean.trim()) return text;
  return `${text} (${korean})`;
}

/** Keep the dictionary shape, including parameterized UI messages. */
export function withKoreanHelp<T extends object>(localized: T, korean: T, language: string, enabled = true): T {
  if (!enabled || language.toLowerCase().split(/[-_]/)[0] === "ko") return localized;
  return Object.fromEntries(Object.entries(localized).map(([key, value]) => {
    const reference = (korean as Record<string, unknown>)[key];
    if (typeof value === "string" && typeof reference === "string") {
      return [key, koreanHelpText(value, reference, language)];
    }
    if (typeof value === "function" && typeof reference === "function") {
      return [key, (...args: unknown[]) => koreanHelpText(value(...args), reference(...args), language)];
    }
    return [key, value];
  })) as T;
}
