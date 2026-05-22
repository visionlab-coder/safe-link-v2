// TTS 품질 보호: 이모지/이모티콘을 텍스트처럼 읽는 현상 방지
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/️/g, '')   // variation selector-16
    .replace(/‍/g, '')   // zero-width joiner
    .replace(/ {2,}/g, ' ')   // 이모지 제거 후 연속 공백 정리
    .trim();
}
