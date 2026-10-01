/** Remove punctuation invented at recording boundaries; preserve numbers and units. */
export function cleanTbmTranscriptFragment(text: string): string {
  return text
    .replace(/(?<!\d)\.+|\.+(?!\d)|[。．!?！？]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function appendTbmTranscript(current: string, fragment: string): string {
  const clean = cleanTbmTranscriptFragment(fragment);
  return clean ? [current.trim(), clean].filter(Boolean).join(" ") : current;
}
