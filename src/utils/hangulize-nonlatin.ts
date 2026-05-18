/**
 * Non-Latin script → Korean pronunciation converters
 * Thai (word dictionary), Hindi/Nepali (Devanagari parser), Bengali (parser)
 */

// ========== 태국어 (단어 사전 기반) ==========
const thaiWords: Record<string, string> = {
    // 인사/기본
    "สวัสดี": "사왓디", "ขอบคุณ": "콥쿤", "ครับ": "크랍", "ค่ะ": "카",
    "ใช่": "차이", "ไม่": "마이", "ได้": "다이", "ไม่ได้": "마이다이",
    "ดี": "디", "ไม่ดี": "마이디",

    // 안전/건설 핵심 용어
    "ความปลอดภัย": "쾀플롯파이", "ปลอดภัย": "플롯파이",
    "หมวกนิรภัย": "무악니라파이", "หมวก": "무악",
    "อันตราย": "안따라이", "ระวัง": "라왕",
    "ฉุกเฉิน": "축처은", "ทางออก": "탕옥",
    "ห้าม": "함", "ห้ามเข้า": "함카오",
    "ไฟ": "파이", "ไฟไหม้": "파이마이",
    "น้ำ": "남", "ไฟฟ้า": "파이파",
    "หยุด": "윳", "เปิด": "쁘읏", "ปิด": "삣",
    "ขึ้น": "큰", "ลง": "롱",
    "ซ้าย": "사이", "ขวา": "콰",
    "บน": "본", "ล่าง": "랑",

    // 건설 현장
    "ก่อสร้าง": "꼬쌍", "คนงาน": "콘응안",
    "เหล็ก": "렉", "ปูน": "뿐", "คอนกรีต": "콘끄릿",
    "เครน": "크렌", "นั่งร้าน": "낭란",
    "บันได": "반다이", "หลังคา": "랑카",
    "ผนัง": "파낭", "พื้น": "픈",
    "สาย": "사이", "เชือก": "츠악",

    // 안전 장비
    "อุปกรณ์": "웁빠꼰", "ถุงมือ": "퉁므",
    "รองเท้า": "롱타오", "แว่นตา": "왠따",
    "เสื้อ": "쓰아", "กันตก": "깐똑",

    // 동작/지시
    "ทำงาน": "탐응안", "พัก": "팍",
    "ยก": "욕", "วาง": "왕",
    "ใส่": "사이", "ถอด": "톳",
    "ตรวจ": "뜨루앗", "ซ่อม": "쏨",
    "ล้าง": "랑", "ทำความสะอาด": "탐쾀사앗",

    // 응급/의료
    "เจ็บ": "쩹", "ปวด": "뿌앗",
    "ช่วย": "추아이", "หมอ": "모",
    "โรงพยาบาล": "롱파야반",
    "ปฐมพยาบาล": "빠톰파야반",

    // 날씨/환경
    "ร้อน": "론", "หนาว": "나오",
    "ฝน": "폰", "แดด": "댓",
    "ลม": "롬", "สูง": "숭", "ต่ำ": "땀",
};

export function hangulizeThai(text: string): string {
    // 태국어 단어 사전 매핑 (가장 긴 매치 우선)
    let result = text;
    // 사전 키를 길이 내림차순으로 정렬 (긴 복합어 먼저 매칭)
    const sortedKeys = Object.keys(thaiWords).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        result = result.split(key).join(thaiWords[key]);
    }
    return result;
}

// ========== 힌디어/네팔어 (데바나가리 → 한글) ==========
const devanagariConsonants: Record<string, string> = {
    'क': '카', 'ख': '카', 'ग': '가', 'घ': '가', 'ङ': '응',
    'च': '차', 'छ': '차', 'ज': '자', 'झ': '자', 'ञ': '냐',
    'ट': '따', 'ठ': '타', 'ड': '다', 'ढ': '다', 'ण': '나',
    'त': '따', 'थ': '타', 'द': '다', 'ध': '다', 'न': '나',
    'प': '빠', 'फ': '파', 'ब': '바', 'भ': '바', 'म': '마',
    'य': '야', 'र': '라', 'ल': '라', 'व': '바',
    'श': '샤', 'ष': '샤', 'स': '사', 'ह': '하',
};

const devanagariVowelMatras: Record<string, string> = {
    '\u093E': '아',  // ा
    '\u093F': '이',  // ि
    '\u0940': '이',  // ी
    '\u0941': '우',  // ु
    '\u0942': '우',  // ू
    '\u0943': '리',  // ृ
    '\u0947': '에',  // े
    '\u0948': '아이', // ै
    '\u094B': '오',  // ो
    '\u094C': '아우', // ौ
};

const devanagariStandaloneVowels: Record<string, string> = {
    'अ': '아', 'आ': '아', 'इ': '이', 'ई': '이',
    'उ': '우', 'ऊ': '우', 'ए': '에', 'ऐ': '아이',
    'ओ': '오', 'औ': '아우', 'ऋ': '리',
};

const HALANT = '\u094D';  // ्
const ANUSVARA = '\u0902'; // ं

const hindiWords: Record<string, string> = {
    "सुरक्षा": "수락샤", "हेलमेट": "헬멧", "खतरा": "카따라",
    "सावधान": "사브단", "आग": "악", "पानी": "빠니",
    "बिजली": "비즐리", "रुको": "루코", "जाओ": "자오",
    "ऊपर": "우빠르", "नीचे": "니체", "बाएं": "바엔", "दाएं": "다엔",
    "मजदूर": "마즈두르", "ठेकेदार": "테게다르",
    "निर्माण": "니르만", "सीमेंट": "시멘트", "लोहा": "로하",
    "ईंट": "인트", "रेत": "렛", "सीढ़ी": "시디",
    "मशीन": "마신", "औजार": "아우자르",
    "दुर्घटना": "두르가뜨나", "अस्पताल": "아스빠딸",
    "प्राथमिक": "쁘라타믹", "चोट": "초트",
    "गर्म": "가름", "ठंडा": "탄다",
    "तेज़": "테즈", "धीरे": "디레",
    "खोलो": "콜로", "बंद": "반드",
    "मदद": "마닷", "ज़रूरी": "자루리",
};

export function hangulizeDevanagari(text: string): string {
    // 사전 매핑 우선
    const words = text.split(/\s+/);
    return words.map(word => {
        if (hindiWords[word]) return hindiWords[word];

        // 데바나가리 문자 파싱
        const chars = Array.from(word);
        let result = '';
        let i = 0;

        while (i < chars.length) {
            const ch = chars[i];
            const next = i + 1 < chars.length ? chars[i + 1] : null;

            // 아누스바라 (anusvara ं) → ㄴ
            if (ch === ANUSVARA) {
                result += '은';
                i++;
                continue;
            }

            // 독립 모음
            if (devanagariStandaloneVowels[ch]) {
                result += devanagariStandaloneVowels[ch];
                i++;
                continue;
            }

            // 자음
            if (devanagariConsonants[ch]) {
                const consonant = devanagariConsonants[ch];

                if (next === HALANT) {
                    // 할란트(virama): 내재 모음 제거 → 자음만
                    result += consonant.charAt(0);
                    i += 2;
                } else if (next && devanagariVowelMatras[next]) {
                    // 모음 마트라 → 자음 첫 글자 + 마트라 모음
                    result += consonant.charAt(0) + devanagariVowelMatras[next];
                    i += 2;
                } else {
                    // 내재 모음 '아' 포함
                    result += consonant;
                    i++;
                }
                continue;
            }

            // 모음 마트라 (단독)
            if (devanagariVowelMatras[ch]) {
                result += devanagariVowelMatras[ch];
                i++;
                continue;
            }

            // 기타 (숫자, 구두점 등)
            result += ch;
            i++;
        }
        return result;
    }).join(' ');
}

// ========== 벵골어 (벵골 문자 → 한글) ==========
const bengaliConsonants: Record<string, string> = {
    'ক': '코', 'খ': '코', 'গ': '고', 'ঘ': '고', 'ঙ': '응',
    'চ': '초', 'ছ': '초', 'জ': '조', 'ঝ': '조', 'ঞ': '뇨',
    'ট': '또', 'ঠ': '토', 'ড': '도', 'ঢ': '도', 'ণ': '노',
    'ত': '또', 'থ': '토', 'দ': '도', 'ধ': '도', 'ন': '노',
    'প': '뽀', 'ফ': '포', 'ব': '보', 'ভ': '보', 'ম': '모',
    'য': '조', 'র': '로', 'ল': '로', 'শ': '쇼',
    'ষ': '쇼', 'স': '소', 'হ': '호', 'ড়': '로', 'ঢ়': '로', 'য়': '요',
};

const bengaliVowelMatras: Record<string, string> = {
    '\u09BE': '아',  // া
    '\u09BF': '이',  // ি
    '\u09C0': '이',  // ী
    '\u09C1': '우',  // ু
    '\u09C2': '우',  // ূ
    '\u09C3': '리',  // ৃ
    '\u09C7': '에',  // ে
    '\u09C8': '아이', // ৈ
    '\u09CB': '오',  // ো
    '\u09CC': '아우', // ৌ
};

const bengaliStandaloneVowels: Record<string, string> = {
    'অ': '오', 'আ': '아', 'ই': '이', 'ঈ': '이',
    'উ': '우', 'ঊ': '우', 'এ': '에', 'ঐ': '아이',
    'ও': '오', 'ঔ': '아우', 'ঋ': '리',
};

const BENGALI_HASANTA = '\u09CD';  // ্
const BENGALI_ANUSVARA = '\u0982'; // ং

const bengaliWords: Record<string, string> = {
    "নিরাপত্তা": "니라빳따", "হেলমেট": "헬멧", "বিপদ": "비빳",
    "সাবধান": "삽단", "আগুন": "아군", "জল": "졸",
    "বিদ্যুৎ": "비드윳", "থামো": "타모", "যাও": "자오",
    "উপরে": "우뽀레", "নীচে": "니체", "বাম": "밤", "ডান": "단",
    "শ্রমিক": "쉬로믹", "নির্মাণ": "니르만",
    "সিমেন্ট": "시멘트", "লোহা": "로하", "ইট": "잇",
    "সিঁড়ি": "신디", "যন্ত্র": "존뜨로",
    "দুর্ঘটনা": "두르가따나", "হাসপাতাল": "하스빠딸",
    "সাহায্য": "사하쬬", "জরুরি": "조루리",
};

export function hangulizeBengali(text: string): string {
    const words = text.split(/\s+/);
    return words.map(word => {
        if (bengaliWords[word]) return bengaliWords[word];

        const chars = Array.from(word);
        let result = '';
        let i = 0;

        while (i < chars.length) {
            const ch = chars[i];
            const next = i + 1 < chars.length ? chars[i + 1] : null;

            if (ch === BENGALI_ANUSVARA) {
                result += '응';
                i++;
                continue;
            }

            if (bengaliStandaloneVowels[ch]) {
                result += bengaliStandaloneVowels[ch];
                i++;
                continue;
            }

            if (bengaliConsonants[ch]) {
                const consonant = bengaliConsonants[ch];
                if (next === BENGALI_HASANTA) {
                    result += consonant.charAt(0);
                    i += 2;
                } else if (next && bengaliVowelMatras[next]) {
                    result += consonant.charAt(0) + bengaliVowelMatras[next];
                    i += 2;
                } else {
                    // 벵골어 내재 모음 = 오 (힌디어와 다름)
                    result += consonant;
                    i++;
                }
                continue;
            }

            if (bengaliVowelMatras[ch]) {
                result += bengaliVowelMatras[ch];
                i++;
                continue;
            }

            result += ch;
            i++;
        }
        return result;
    }).join(' ');
}
