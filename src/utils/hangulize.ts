/**
 * Hangulize: Converts Romanized text (Pinyin, etc.) into Korean phonetic scripts (Hangul).
 * Designed for administrators who cannot read Pinyin or Romanized foreign texts.
 */

const INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const VOWELS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅛ", "ㅡ", "ㅢ", "ㅣ"];

const INITIAL_MAP: Record<string, number> = {
    "ㄱ": 0, "ㄲ": 1, "ㄴ": 2, "ㄷ": 3, "ㄸ": 4, "ㄹ": 5, "ㅁ": 6, "ㅂ": 7, "ㅃ": 8, "ㅅ": 9, "ㅆ": 10, "ㅇ": 11, "ㅈ": 12, "ㅉ": 13, "ㅊ": 14, "ㅋ": 15, "ㅌ": 16, "ㅍ": 17, "ㅎ": 18
};

const VOWEL_MAP: Record<string, number> = {
    "ㅏ": 0, "ㅐ": 1, "ㅑ": 2, "ㅒ": 3, "ㅓ": 4, "ㅔ": 5, "ㅕ": 6, "ㅖ": 7, "ㅗ": 8, "ㅘ": 9, "ㅙ": 10, "ㅚ": 11, "ㅛ": 12, "ㅜ": 13, "ㅝ": 14, "ㅞ": 15, "ㅟ": 16, "ㅠ": 17, "ㅡ": 18, "ㅢ": 19, "ㅣ": 20
};

// Simplified syllable map for common Roman-to-Hangul vowels
const SIMPLE_VOWEL_MAP: Record<string, string> = {
    "아": "ㅏ", "에": "ㅔ", "이": "ㅣ", "오": "ㅗ", "우": "ㅜ", "으": "ㅡ", "어": "ㅓ", "애": "ㅐ",
    "야": "ㅑ", "여": "ㅕ", "요": "ㅛ", "유": "ㅠ", "예": "ㅖ", "얘": "ㅒ",
    "와": "ㅘ", "왜": "ㅙ", "외": "ㅚ", "워": "ㅝ", "웨": "ㅞ", "위": "ㅟ", "의": "ㅢ"
};

const pinyinVowels: Record<string, string> = {
    'ai': '아이', 'ei': '에이', 'ui': '웨이', 'ao': '아오', 'ou': '오우', 'iu': '이우',
    'ie': '이에', 'ue': '위에', 'er': '얼', 'an': '안', 'en': '언', 'in': '인', 'un': '운', 'vn': '윈',
    'ang': '앙', 'eng': '엉', 'ing': '잉', 'ong': '옹',
    'ia': '이아', 'iao': '이아오', 'ian': '이엔', 'iang': '이앙', 'iong': '이옹',
    'ua': '우아', 'uo': '우오', 'uai': '우아이', 'uan': '우안', 'uang': '우앙',
    'a': '아', 'o': '오', 'e': '어', 'i': '이', 'u': '우', 'v': '위'
};

const pinyinInitials: Record<string, string> = {
    'zh': 'ㅈ', 'ch': 'ㅊ', 'sh': 'ㅅ',
    'b': 'ㅃ', 'p': 'ㅍ', 'm': 'ㅁ', 'f': 'ㅎ',
    'd': 'ㄸ', 't': 'ㅌ', 'n': 'ㄴ', 'l': 'ㄹ',
    'g': 'ㄲ', 'k': 'ㅋ', 'h': 'ㅎ',
    'j': 'ㅈ', 'q': 'ㅊ', 'x': 'ㅅ',
    'r': 'ㄹ', 'z': 'ㅈ', 'c': 'ㅊ', 's': 'ㅅ'
};

function assemble(initial: string, vowel: string): string {
    const i = INITIAL_MAP[initial];
    const v = VOWEL_MAP[SIMPLE_VOWEL_MAP[vowel] || vowel];
    if (i === undefined || v === undefined) return initial + vowel;
    return String.fromCharCode(i * 588 + v * 28 + 44032);
}

export function hangulize(text: string, lang: string): string {
    if (!text) return "";
    let normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (lang === 'zh') return hangulizePinyin(normalized);
    if (lang === 'vi') return hangulizeVietnamese(normalized);

    return genericHangulize(normalized);
}

function hangulizePinyin(pinyin: string): string {
    return pinyin.split(/\s+/).map(word => {
        let remaining = word;
        let res = "";
        while (remaining.length > 0) {
            let initial = "";
            let initialLen = 0;
            if (remaining.length >= 2 && pinyinInitials[remaining.substring(0, 2)]) {
                initial = pinyinInitials[remaining.substring(0, 2)];
                initialLen = 2;
            } else if (pinyinInitials[remaining[0]]) {
                initial = pinyinInitials[remaining[0]];
                initialLen = 1;
            }
            remaining = remaining.substring(initialLen);

            if ((initial === 'ㅅ' || initial === 'ㅈ' || initial === 'ㅊ' || initial === 'ㄹ') && remaining.startsWith('i')) {
                res += assemble(initial, 'ㅡ');
                remaining = remaining.substring(1);
                continue;
            }

            let found = false;
            for (let i = 4; i >= 1; i--) {
                const sub = remaining.substring(0, i);
                if (pinyinVowels[sub]) {
                    const vStr = pinyinVowels[sub];
                    if (vStr.length === 1) res += assemble(initial || "ㅇ", vStr);
                    else {
                        res += assemble(initial || "ㅇ", vStr[0]);
                        res += vStr.substring(1);
                    }
                    remaining = remaining.substring(i);
                    found = true;
                    break;
                }
            }
            if (!found) {
                if (initial) res += initial;
                else if (remaining.length > 0) {
                    res += remaining[0];
                    remaining = remaining.substring(1);
                }
            }
        }
        return res;
    }).join(" ");
}

function hangulizeVietnamese(text: string): string {
    // Simple Vietnamese rules
    let res = text.replace(/ph/g, 'ㅍ').replace(/th/g, 'ㅌ').replace(/kh/g, 'ㅋ').replace(/nh/g, 'ㄴ');
    res = res.replace(/gi/g, 'ㅈ').replace(/qu/g, 'ㄲ');
    return genericHangulize(res);
}

function genericHangulize(text: string): string {
    // Very basic mapping
    let res = text;
    res = res.replace(/sh/g, 'ㅅ').replace(/ch/g, 'ㅊ').replace(/th/g, 'ㅌ').replace(/ph/g, 'ㅍ');
    res = res.replace(/a/g, '아').replace(/e/g, '에').replace(/i/g, '이').replace(/o/g, '오').replace(/u/g, '우');
    return res;
}
