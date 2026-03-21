/**
 * Hangulize: Converts foreign text into Korean phonetic scripts (Hangul).
 * Supports: Chinese (Pinyin), Vietnamese, Indonesian, Uzbek, Tagalog, French, Spanish,
 * Russian/Kazakh/Mongolian (Cyrillic), Japanese (Kana), Thai, Hindi/Nepali, Bengali.
 */

import { hangulizeThai, hangulizeDevanagari, hangulizeBengali } from './hangulize-nonlatin';

const INITIAL_MAP: Record<string, number> = {
    "ㄱ": 0, "ㄲ": 1, "ㄴ": 2, "ㄷ": 3, "ㄸ": 4, "ㄹ": 5, "ㅁ": 6, "ㅂ": 7, "ㅃ": 8, "ㅅ": 9, "ㅆ": 10, "ㅇ": 11, "ㅈ": 12, "ㅉ": 13, "ㅊ": 14, "ㅋ": 15, "ㅌ": 16, "ㅍ": 17, "ㅎ": 18
};
const VOWEL_MAP: Record<string, number> = {
    "ㅏ": 0, "ㅐ": 1, "ㅑ": 2, "ㅒ": 3, "ㅓ": 4, "ㅔ": 5, "ㅕ": 6, "ㅖ": 7, "ㅗ": 8, "ㅘ": 9, "ㅙ": 10, "ㅚ": 11, "ㅛ": 12, "ㅜ": 13, "ㅝ": 14, "ㅞ": 15, "ㅟ": 16, "ㅠ": 17, "ㅡ": 18, "ㅢ": 19, "ㅣ": 20
};
const BATCHIM_MAP: Record<string, number> = {
    "": 0, "ㄱ": 1, "ㄴ": 4, "ㄷ": 7, "ㄹ": 8, "ㅁ": 16, "ㅂ": 17, "ㅅ": 19, "ㅇ": 21, "ㅈ": 22, "ㅊ": 23, "ㅋ": 24, "ㅌ": 25, "ㅍ": 26, "ㅎ": 27
};

function assemble(initial: string, vowel: string, batchim: string = ""): string {
    const i = INITIAL_MAP[initial];
    const v = VOWEL_MAP[vowel];
    const b = BATCHIM_MAP[batchim] || 0;
    if (i === undefined || v === undefined) return initial + (vowel || "") + (batchim || "");
    return String.fromCharCode(i * 588 + v * 28 + b + 44032);
}

const pinyinMap: Record<string, string> = {
    "a": "아", "ai": "아이", "an": "안", "ang": "앙", "ao": "아오",
    "ba": "바", "bai": "바이", "ban": "빤", "bang": "빵", "bao": "바오", "bei": "베이", "ben": "뻔", "beng": "뻥", "bi": "비", "bian": "삐엔", "biao": "삐아오", "bie": "삐에", "bin": "삔", "bing": "삥", "bo": "보", "bu": "부",
    "ca": "차", "cai": "차이", "can": "찬", "cang": "창", "cao": "차오", "ce": "처", "cei": "체이", "cen": "천", "ceng": "청", "cha": "차", "chai": "차이", "chan": "찬", "chang": "창", "chao": "차오", "che": "처", "chen": "천", "cheng": "청", "chi": "츠", "chong": "층", "chou": "초우", "chu": "추", "chua": "추아", "chuai": "추아이", "chuan": "추안", "chuang": "추앙", "chui": "추이", "chun": "춘", "chuo": "추오", "ci": "츠", "cong": "층", "cou": "초우", "cu": "추", "cuan": "추안", "cui": "추이", "cun": "춘", "cuo": "추오",
    "da": "따", "dai": "따이", "dan": "딴", "dang": "땅", "dao": "따오", "de": "떠", "dei": "떼이", "den": "떤", "deng": "떵", "di": "띠", "dia": "띠아", "dian": "띠엔", "diao": "띠아오", "die": "띠에", "ding": "띵", "diu": "띠우", "dong": "똥", "dou": "또우", "du": "뚜", "duan": "뚜안", "dui": "뚜이", "dun": "뚠", "duo": "뚜오",
    "e": "어", "ei": "에이", "en": "언", "eng": "엉", "er": "얼",
    "fa": "파", "fan": "판", "fang": "팡", "fei": "페이", "fen": "펀", "feng": "펑", "fo": "포", "fou": "포우", "fu": "푸",
    "ga": "까", "gai": "까이", "gan": "깐", "gang": "깡", "gao": "까오", "ge": "꺼", "gei": "께이", "gen": "껀", "geng": "껑", "gong": "꽁", "gou": "꼬우", "gu": "꾸", "gua": "꽈", "guai": "꽈이", "guan": "꽌", "guang": "꽝", "gui": "꾸이", "gun": "꾼", "guo": "궈",
    "ha": "하", "hai": "하이", "han": "한", "hang": "항", "hao": "하오", "he": "허", "hei": "헤이", "hen": "헌", "heng": "헝", "hong": "홍", "hou": "호우", "hu": "후", "hua": "후아", "huai": "후아이", "huan": "환", "huang": "후앙", "hui": "후이", "hun": "훈", "huo": "훠",
    "ji": "찌", "jia": "쨔", "jian": "찌엔", "jiang": "쨩", "jiao": "쨔오", "jie": "찌에", "jin": "찐", "jing": "찡", "jiong": "쫑", "jiu": "찌우", "ju": "쥐", "juan": "쥐엔", "jue": "쥐에", "jun": "쥔",
    "ka": "카", "kai": "카이", "kan": "칸", "kang": "캉", "kao": "카오", "ke": "커", "kei": "케이", "ken": "컨", "keng": "컹", "kong": "콩", "kou": "코우", "ku": "쿠", "kua": "쿠아", "kuai": "쿠아이", "kuan": "콴", "kuang": "쿠앙", "kui": "쿠이", "kun": "쿤", "kuo": "쿠오",
    "la": "라", "lei": "레이", "leng": "렁", "li": "리", "lia": "리아", "lian": "리엔", "liang": "리앙", "liao": "리아오", "lie": "리에", "lin": "린", "ling": "링", "liu": "리우", "long": "롱", "lou": "로우", "lu": "루", "luan": "롼", "lun": "룬", "luo": "루오", "lv": "뤼", "lue": "뤼에",
    "ma": "마", "mai": "마이", "man": "만", "mang": "망", "mao": "마오", "me": "머", "mei": "메이", "men": "먼", "meng": "멍", "mi": "미", "mian": "미엔", "miao": "미아오", "mie": "미에", "min": "민", "ming": "밍", "miu": "미우", "mo": "모", "mou": "모우", "mu": "무",
    "na": "나", "nai": "나이", "nan": "난", "nang": "낭", "nao": "나오", "ne": "너", "nei": "네이", "nen": "넌", "ni": "니", "nian": "니엔", "niang": "니앙", "niao": "니아오", "nie": "니에", "nin": "닌", "ning": "닝", "niu": "니우", "nong": "농", "nou": "노우", "nu": "누", "nuan": "놘", "nun": "눈", "nuo": "누오", "nv": "뉘", "nve": "뉘에",
    "o": "오", "ou": "오우",
    "pa": "파", "pai": "파이", "pan": "판", "pang": "팡", "pao": "파오", "pei": "페이", "pen": "펀", "peng": "펑", "pi": "피", "pian": "피엔", "piao": "피아오", "pie": "피에", "pin": "핀", "ping": "핑", "po": "포", "pou": "포우", "pu": "푸",
    "qi": "치", "qia": "치아", "qian": "치엔", "qiang": "치앙", "qiao": "치아오", "qie": "치에", "qin": "친", "qing": "칭", "qiong": "치옹", "qiu": "치우", "qu": "취", "quan": "취엔", "que": "취에", "qun": "췬",
    "ran": "란", "rang": "랑", "rao": "라오", "re": "러", "ren": "런", "reng": "렁", "ri": "르", "rong": "롱", "rou": "로우", "ru": "루", "rua": "루아", "ruan": "루안", "rui": "루이", "run": "룬", "ruo": "루오",
    "sa": "사", "sai": "사이", "san": "산", "sang": "상", "sao": "사오", "se": "셔", "sen": "선", "seng": "성", "sha": "사", "shai": "사이", "shan": "산", "shang": "상", "shao": "사오", "she": "셔", "shei": "셰이", "shen": "선", "sheng": "성", "shi": "스", "shou": "쇼우", "shu": "슈", "shua": "슈아", "shuai": "슈아이", "shuan": "슈안", "shuang": "슈앙", "shui": "슈이", "shun": "슌", "shuo": "슈오", "si": "스", "song": "송", "sou": "소우", "su": "슈", "suan": "수안", "sui": "수이", "sun": "순", "suo": "수오",
    "ta": "타", "tai": "타이", "tan": "탄", "tang": "탕", "tao": "타오", "te": "터", "teng": "텅", "ti": "티", "tian": "티엔", "tiao": "티아오", "tie": "티에", "ting": "팅", "tong": "통", "tou": "토우", "tu": "투", "tuan": "퇀", "tui": "투이", "tun": "툰", "tuo": "투오",
    "wa": "와", "wai": "와이", "wan": "완", "wang": "왕", "wei": "웨이", "wen": "원", "weng": "옹", "wo": "워", "wu": "우",
    "xi": "시", "xia": "샤", "xian": "셴", "xiang": "샹", "xiao": "샤오", "xie": "셰", "xin": "신", "xing": "싱", "xiong": "숑", "xiu": "슈", "xu": "쉬", "xuan": "쉬엔", "xue": "쉬에", "xun": "쉰",
    "ya": "야", "yan": "이엔", "yang": "양", "yao": "야오", "ye": "예", "yi": "이", "yin": "인", "ying": "잉", "yo": "요", "yong": "용", "you": "요우", "yu": "위", "yuan": "위엔", "yue": "위에", "yun": "윈",
    "za": "자", "zai": "자이", "zan": "잔", "zang": "장", "zao": "자오", "ze": "저", "zei": "제이", "zen": "전", "zeng": "정", "zha": "자", "zhai": "자이", "zhan": "잔", "zhang": "장", "zhao": "자오", "zhe": "저", "zhei": "제이", "zhen": "전", "zheng": "정", "zhi": "즈", "zhong": "종", "zhou": "조우", "zhu": "주", "zhua": "주아", "zhuai": "주아이", "zhuan": "주안", "zhuang": "주앙", "zhui": "주이", "zhun": "준", "zhuo": "주오", "zi": "즈", "zong": "종", "zou": "조우", "zu": "주", "zuan": "주안", "zui": "주이", "zun": "준", "zuo": "주오"
};

const vMap: Record<string, string> = {
    'a': '아', 'b': '브', 'c': '츠', 'd': '드', 'e': '에', 'f': '프', 'g': '그', 'h': '흐', 'i': '이', 'j': '즈', 'k': '크', 'l': '르', 'm': '므', 'n': '느', 'o': '오', 'p': '프', 'q': '크', 'r': '르', 's': '스', 't': '트', 'u': '우', 'v': '브', 'w': '으', 'x': '스', 'y': '이', 'z': '즈'
};

const batchimCandidates: Record<string, string> = { 'n': 'ㄴ', 'g': 'ㅇ', 'l': 'ㄹ', 'm': 'ㅁ', 'p': 'ㅂ', 't': 'ㅅ', 'k': 'ㄱ' };

// 베트남어 음절 → 한글 매핑
const viSyllables: Record<string, string> = {
    "xin": "신", "chao": "짜오", "cam": "깜", "on": "언", "vang": "방",
    "khong": "콩", "co": "꼬", "duoc": "드억", "tot": "똣", "xau": "써우",
    "phai": "파이", "doi": "도이", "deo": "데오", "mu": "무", "bao": "바오",
    "hiem": "히엠", "vui": "부이", "long": "롱", "buon": "부온",
    "noi": "노이", "lam": "람", "viec": "비엑", "an": "안", "toan": "또안",
    "nguy": "응위", "vao": "바오",
    "khu": "쿠", "vuc": "붝", "cong": "꽁", "truong": "쯔엉",
    "tang": "땅", "ham": "함", "mai": "마이", "san": "산",
    "nha": "냐", "cua": "꾸아", "nguoi": "응어이", "lao": "라오",
    "dong": "동", "quan": "꽌", "ly": "리", "ky": "끼",
    "thuat": "투앗", "dien": "디엔", "nuoc": "느억", "lua": "르아",
    "sat": "삿", "thep": "텝", "xi": "시", "mang": "망",
    "gach": "각", "kinh": "낀", "go": "고", "da": "다",
    "ong": "옹", "day": "제이", "cap": "깝",
    "len": "렌", "xuong": "쑤엉", "trai": "짜이", "ben": "벤",
    "trong": "쫑", "ngoai": "응오아이", "tren": "쩬", "duoi": "드어이",
    "dung": "둥", "sai": "사이", "dau": "더우", "cuoi": "꾸오이",
    "giup": "줍", "do": "도", "cho": "쪼", "toi": "또이",
    "ban": "반", "anh": "아잉", "chi": "찌", "em": "엠",
    "di": "디", "den": "덴", "ve": "베", "ra": "라",
    "nay": "나이", "cai": "까이",
    "kia": "끼아", "la": "라",
    "hay": "하이", "va": "바", "roi": "로이", "chua": "쯔어",
    "se": "쎄", "dang": "당",
    "the": "테", "nao": "나오", "gi": "지", "tai": "따이",
    "sao": "사오", "nhieu": "니에우", "it": "잇",
};

// 비로마자 언어: 원문 그대로 반환 (NFD 정규화가 문자를 손상시킴)
// jp=가나→한글, th=사전, hi/ne=데바나가리, bn=벵골 파서 가능 → 제외
const NON_LATIN_LANGS = new Set(['km', 'my', 'ar', 'ko']);

// 키릴 문자 언어: 별도 transliteration 필요
const CYRILLIC_LANGS = new Set(['ru', 'kk', 'mn']);

export function hangulize(text: string, lang: string): string {
    if (!text) return "";

    // 일본어: 가나 → 한글 직접 변환
    if (lang === 'jp') return hangulizeJapanese(text);

    // 태국어: 안전 단어 사전 기반
    if (lang === 'th') return hangulizeThai(text);

    // 힌디어/네팔어: 데바나가리 → 한글
    if (lang === 'hi' || lang === 'ne') return hangulizeDevanagari(text);

    // 벵골어: 벵골 문자 → 한글
    if (lang === 'bn') return hangulizeBengali(text);

    // 비로마자 언어는 원문 그대로 반환 (한글화 불가)
    if (NON_LATIN_LANGS.has(lang)) return text;

    // 키릴 문자 언어는 키릴 → 한글 변환
    if (CYRILLIC_LANGS.has(lang)) return hangulizeCyrillic(text);

    // NFD 정규화 전에 특수 문자 보존 (NFD가 파괴하는 문자들)
    let pre = text.toLowerCase();
    pre = pre.replace(/ñ/g, "\x01NY\x01");      // 스페인어 ñ → ny 보존
    pre = pre.replace(/đ/g, "\x01D\x01");        // 베트남어 đ 보존
    pre = pre.replace(/\u02BB/g, "'");            // 우즈벡어 ʻ (U+02BB) → ASCII apostrophe

    let normalized = pre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D]/g, '"');
    normalized = normalized.replace(/u:/g, "v").replace(/ü/g, "v");

    // 보존된 문자 복원
    normalized = normalized.replace(/\x01NY\x01/g, "ny");  // ñ → ny
    normalized = normalized.replace(/\x01D\x01/g, "d");     // đ → d

    if (lang === 'zh') return hangulizePinyin(normalized);
    if (lang === 'vi') return hangulizeVietnamese(normalized);
    if (lang === 'id') return hangulizeIndonesian(normalized);
    if (lang === 'uz') return hangulizeUzbek(normalized);
    if (lang === 'ph') return hangulizeTagalog(normalized);
    if (lang === 'fr') return hangulizeFrench(normalized);
    if (lang === 'es') return hangulizeSpanish(normalized);
    return genericHangulize(normalized);
}

function hangulizeVietnamese(text: string): string {
    return text.split(/\s+/).map(word => {
        // 구두점 분리: "chao," → "chao" + ","
        const punctMatch = word.match(/^([a-z'-]+)([^a-z'-]*)$/);
        const cleanWord = punctMatch ? punctMatch[1] : word;
        const trailing = punctMatch ? punctMatch[2] : "";

        if (viSyllables[cleanWord]) return viSyllables[cleanWord] + trailing;
        // 사전에 없으면 영어 패턴 기반 변환
        let converted = cleanWord;
        for (const [pattern, replacement] of engPatterns) {
            converted = converted.replace(pattern, replacement);
        }
        return converted + trailing;
    }).join(' ');
}

// 구두점 분리 유틸리티
function splitPunct(word: string): [string, string] {
    const m = word.match(/^([a-z0-9'-]+)([^a-z0-9'-]*)$/);
    return m ? [m[1], m[2]] : [word, ""];
}

// 패턴 기반 변환 유틸리티
function applyPatterns(word: string, patterns: Array<[RegExp, string]>): string {
    let converted = word;
    for (const [pattern, replacement] of patterns) {
        converted = converted.replace(pattern, replacement);
    }
    return converted;
}

// 사전+패턴 기반 변환 공통 함수
function dictPatternHangulize(text: string, dict: Record<string, string>, patterns: Array<[RegExp, string]>): string {
    return text.split(/\s+/).map(word => {
        const [clean, trail] = splitPunct(word);
        if (/^\d+$/.test(clean)) return clean + trail;
        if (dict[clean]) return dict[clean] + trail;
        return applyPatterns(clean, patterns) + trail;
    }).join(' ');
}

// ========== 인도네시아어 ==========
const idPatterns: Array<[RegExp, string]> = [
    // 다중 문자 패턴 먼저
    [/ngg/g, "응그"], [/ng/g, "응"], [/ny/g, "니"], [/sy/g, "시"],
    [/kh/g, "흐"], [/th/g, "트"], [/ph/g, "프"], [/ck/g, "크"],
    // 이중모음
    [/ai/g, "아이"], [/au/g, "아우"], [/oi/g, "오이"],
    // 모음
    [/a/g, "아"], [/e/g, "에"], [/i/g, "이"], [/o/g, "오"], [/u/g, "우"],
    // 자음 (c = /tʃ/ 인도네시아어는 항상 찌, kh = /x/ 흐)
    [/b/g, "브"], [/c/g, "찌"], [/d/g, "드"], [/f/g, "프"],
    [/g/g, "그"], [/h/g, "흐"], [/j/g, "즈"], [/k/g, "크"],
    [/l/g, "ㄹ"], [/m/g, "므"], [/n/g, "느"], [/p/g, "프"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "크스"], [/y/g, "이"], [/z/g, "즈"],
];
const idWords: Record<string, string> = {
    "selamat": "슬라맛", "pagi": "파기", "siang": "시앙", "sore": "소레", "malam": "말람",
    "terima": "트리마", "kasih": "카시", "ya": "야", "tidak": "티닥", "bisa": "비사",
    "apa": "아파", "ini": "이니", "itu": "이투", "dan": "단", "atau": "아타우",
    "di": "디", "ke": "크", "dari": "다리", "untuk": "운툭", "dengan": "등안",
    "yang": "양", "ada": "아다", "akan": "아칸", "sudah": "수다", "belum": "블룸",
    "harus": "하루스", "boleh": "볼레", "jangan": "장안", "tolong": "톨롱",
    "pakai": "파카이", "helm": "헬름", "sepatu": "스파투", "sarung": "사룽", "tangan": "탕안",
    "keselamatan": "크슬라마탄", "bahaya": "바하야", "hati-hati": "하티하티",
    "berhenti": "브르헨티", "jalan": "잘란", "masuk": "마숙", "keluar": "클루아르",
    "kerja": "크르자", "pekerja": "프크르자", "lokasi": "로카시", "lantai": "란타이",
    "atas": "아타스", "bawah": "바와", "kiri": "키리", "kanan": "카난",
    "cepat": "쩌팟", "pelan": "플란", "besar": "브사르", "kecil": "크찔",
    "buka": "부카", "tutup": "투툽", "naik": "나익", "turun": "투룬",
    "air": "아이르", "api": "아피", "listrik": "리스트릭", "mesin": "므신",
    "alat": "알랏", "berat": "브랏", "ringan": "링안",
    "dilarang": "딜라랑", "wajib": "와집", "perhatian": "프르하티안",
    "darurat": "다루랏", "pertolongan": "프르톨롱안", "pertama": "프르타마",
    // 건설 추가
    "beton": "베톤", "cor": "쪼르", "besi": "브시", "tangga": "탕가",
    "scaffolding": "스캐폴딩", "bekisting": "브키스팅", "derek": "드렉",
    "galian": "갈리안", "sambungan": "삼붕안", "rambu": "람부",
    "pipa": "피파", "kawat": "카왓", "semen": "세멘", "pasir": "파시르",
    "kayu": "카유", "atap": "아탑", "dinding": "딘딩", "pondasi": "폰다시",
};
function hangulizeIndonesian(text: string): string {
    return dictPatternHangulize(text, idWords, idPatterns);
}

// ========== 우즈벡어 ==========
const uzPatterns: Array<[RegExp, string]> = [
    [/sh/g, "쉬"], [/ch/g, "치"], [/ng/g, "응"],
    [/o'/g, "오"], [/g'/g, "그"],
    [/ai/g, "아이"], [/oy/g, "오이"], [/ey/g, "에이"],
    [/a/g, "아"], [/e/g, "에"], [/i/g, "이"], [/o/g, "오"], [/u/g, "우"],
    [/b/g, "브"], [/d/g, "드"], [/f/g, "프"], [/g/g, "그"],
    [/h/g, "흐"], [/j/g, "즈"], [/k/g, "크"], [/l/g, "ㄹ"],
    [/m/g, "므"], [/n/g, "느"], [/p/g, "프"], [/q/g, "크"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "흐"], [/y/g, "이"], [/z/g, "즈"],
];
const uzWords: Record<string, string> = {
    "salom": "살롬", "rahmat": "라흐맛", "xavfsizlik": "하브프시즐릭",
    "ha": "하", "yo'q": "요크", "bor": "보르", "kerak": "케락",
    "va": "바", "yoki": "요키", "lekin": "레킨", "chunki": "춘키",
    "uchun": "우춘", "bilan": "빌란", "dan": "단", "ga": "가",
    "qoidalar": "코이달라르", "rioya": "리오야", "qiling": "킬링",
    "kask": "카스크", "kiyim": "키임", "qo'lqop": "콜코프",
    "xavfli": "하블리", "ehtiyot": "에흐티욧", "to'xta": "톡타",
    "ishchi": "이쉬치", "qurilish": "쿠릴리쉬", "maydon": "마이돈",
    "kirish": "키리쉬", "chiqish": "치키쉬", "yuqori": "유코리", "pastda": "파스트다",
    "tez": "테즈", "sekin": "세킨", "katta": "카타", "kichik": "키칙",
    "oching": "오칭", "yoping": "요핑", "ko'taring": "코타링",
    "suv": "수브", "olov": "올로브", "elektr": "엘렉트르", "mashina": "마시나",
    "taqiqlanadi": "타키클라나디", "majburiy": "마즈부리이",
    "favqulodda": "파브쿨로다", "yordam": "요르담", "birinchi": "비린치",
    // 건설 추가
    "temir": "테미르", "beton": "베톤", "kran": "크란", "lift": "리프트",
    "quvur": "쿠부르", "g'isht": "기쉬트", "yog'och": "요고치",
    "bo'yoq": "보요크", "zarba": "자르바", "to'siq": "토시크",
    "simyog'och": "심요고치", "pichoq": "피촉", "arra": "아라",
    "bolg'a": "볼가", "mix": "미흐", "plita": "플리타",
};
function hangulizeUzbek(text: string): string {
    return dictPatternHangulize(text, uzWords, uzPatterns);
}

// ========== 타갈로그어 (필리핀) ==========
const phPatterns: Array<[RegExp, string]> = [
    [/ng/g, "응"], [/ny/g, "니"], [/ts/g, "츠"],
    [/ai/g, "아이"], [/ao/g, "아오"], [/aw/g, "아우"],
    [/ey/g, "에이"], [/oy/g, "오이"], [/uw/g, "우"],
    [/a/g, "아"], [/e/g, "에"], [/i/g, "이"], [/o/g, "오"], [/u/g, "우"],
    [/b/g, "브"], [/c/g, "크"], [/d/g, "드"], [/f/g, "프"],
    [/g/g, "그"], [/h/g, "흐"], [/j/g, "즈"], [/k/g, "크"],
    [/l/g, "ㄹ"], [/m/g, "므"], [/n/g, "느"], [/p/g, "프"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "크스"], [/y/g, "이"], [/z/g, "즈"],
];
const phWords: Record<string, string> = {
    "magandang": "마간당", "umaga": "우마가", "hapon": "하폰", "gabi": "가비",
    "salamat": "살라맛", "oo": "오오", "hindi": "힌디", "po": "포",
    "at": "앗", "o": "오", "ang": "앙", "ng": "능", "sa": "사",
    "para": "파라", "mula": "물라", "hanggang": "항강",
    "may": "마이", "wala": "왈라", "na": "나", "pa": "파",
    "kailangan": "카일랑안", "pwede": "프웨데", "huwag": "후왁",
    "suotin": "수오틴", "helmet": "헬멧", "sapatos": "사파토스", "guwantes": "구완테스",
    "kaligtasan": "칼릭타산", "panganib": "팡아닙", "ingat": "잉앗",
    "tigil": "티길", "daan": "다안", "pasok": "파속", "labas": "라바스",
    "trabaho": "트라바호", "manggagawa": "망가가와", "lugar": "루가르", "sahig": "사힉",
    "taas": "타아스", "baba": "바바", "kaliwa": "칼리와", "kanan": "카난",
    "mabilis": "마빌리스", "dahan": "다한", "malaki": "말라키", "maliit": "말리잇",
    "buksan": "북산", "isara": "이사라", "pataas": "파타아스", "pababa": "파바바",
    "tubig": "투빅", "apoy": "아포이", "kuryente": "쿠리엔테", "makina": "마키나",
    "bawal": "바왈", "kinakailangan": "키나카일랑안",
    "emergency": "이머전시", "pangunang": "팡우낭", "lunas": "루나스",
    // 건설 추가
    "bakal": "바칼", "semento": "세멘토", "kahoy": "카호이",
    "hagdan": "하그단", "andamyo": "안다미오", "gripo": "그리포",
    "tubo": "투보", "pinto": "핀토", "daanan": "다아난",
    "bubong": "부봉", "haligi": "할리기", "pagawaan": "파가와안",
    "kasangkapan": "카상카판", "pako": "파코", "martilyo": "마르틸요",
};
function hangulizeTagalog(text: string): string {
    return dictPatternHangulize(text, phWords, phPatterns);
}

// ========== 프랑스어 ==========
const frPatterns: Array<[RegExp, string]> = [
    // 어미 묵음 자음 (단어 끝 s/t/d/x/z 묵음)
    [/s$/g, ""], [/t$/g, ""], [/d$/g, ""], [/x$/g, ""], [/z$/g, ""],
    // 특수 어미
    [/ier$/g, "이에"], [/eur$/g, "외르"], [/ment$/g, "망"], [/ez$/g, "에"],
    // 다음자 패턴
    [/tion/g, "시옹"], [/sion/g, "지옹"],
    // ille 계열 (이유→이 수정)
    [/ouille/g, "우이"], [/aille/g, "아이"], [/eille/g, "에이"], [/ille/g, "이"],
    // 복합 모음
    [/eau/g, "오"], [/aux/g, "오"], [/eux/g, "외"],
    [/ou/g, "우"], [/oi/g, "와"],
    // 비음 (자음/단어끝 앞에서만 비음화)
    [/ain/g, "앵"], [/aim/g, "앵"], [/ein/g, "앵"],
    [/in(?=[^aeiou]|$)/g, "앵"], [/un(?=[^aeiou]|$)/g, "앵"],
    [/an(?=[^aeiou]|$)/g, "앙"], [/am(?=[^aeiou]|$)/g, "앙"],
    [/en(?=[^aeiou]|$)/g, "앙"], [/em(?=[^aeiou]|$)/g, "앙"],
    [/on(?=[^aeiou]|$)/g, "옹"], [/om(?=[^aeiou]|$)/g, "옹"],
    // 일반 이중모음
    [/ai/g, "에"], [/ei/g, "에"], [/au/g, "오"], [/eu/g, "외"],
    // 자음 이중자
    [/ch/g, "쉬"], [/ph/g, "프"], [/th/g, "트"], [/gn/g, "니"],
    [/qu/g, "크"], [/gu(?=[ei])/g, "그"],
    // 단일 모음
    [/a/g, "아"], [/e/g, "으"], [/i/g, "이"], [/o/g, "오"], [/u/g, "위"],
    // 단일 자음
    [/b/g, "브"], [/c/g, "크"], [/d/g, "드"], [/f/g, "프"],
    [/g/g, "그"], [/h/g, ""], [/j/g, "주"], [/k/g, "크"],
    [/l/g, "ㄹ"], [/m/g, "므"], [/n/g, "느"], [/p/g, "프"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "크스"], [/y/g, "이"], [/z/g, "즈"],
];
const frWords: Record<string, string> = {
    "bonjour": "봉주르", "bonsoir": "봉수아르", "merci": "메르시",
    "oui": "위", "non": "농", "bien": "비앙", "tres": "트레",
    "et": "에", "ou": "우", "mais": "메", "avec": "아벡",
    "le": "르", "la": "라", "les": "레", "un": "앵", "une": "윈",
    "de": "드", "du": "뒤", "des": "데", "pour": "푸르", "dans": "당",
    "sur": "쉬르", "sous": "수", "entre": "앙트르",
    "securite": "세퀴리테", "casque": "카스크", "danger": "당제",
    "attention": "아탕시옹", "arret": "아레", "sortie": "소르티",
    "travail": "트라바이", "ouvrier": "우브리에", "chantier": "샹티에",
    "entree": "앙트레", "interdit": "앵테르디",
    "portez": "포르테", "votre": "보트르", "obligatoire": "오블리가투아르",
    "urgence": "위르정스", "premiers": "프르미에", "secours": "스쿠르",
    "eau": "오", "feu": "푀", "electrique": "엘렉트리크",
    "haut": "오", "bas": "바", "gauche": "고쉬", "droite": "드루아트",
    // 건설 추가
    "batiment": "바티망", "beton": "베통", "grue": "그뤼",
    "echafaudage": "에샤포다주", "protection": "프로텍시옹",
    "incendie": "앵상디", "extincteur": "에스탱크퇴르",
    "maconnerie": "마소느리", "ferraillage": "페라야주",
    "fondation": "퐁다시옹", "mur": "뮈르", "plafond": "플라퐁",
    "tuyau": "튀요", "ciment": "시망", "poutre": "푸트르",
    // 일반 고빈도 단어
    "comment": "코망", "pourquoi": "푸르쿠아", "quand": "캉",
    "ici": "이시", "maintenant": "맹트낭", "avant": "아방",
    "apres": "아프레", "toujours": "투주르", "jamais": "자메",
    "beaucoup": "보쿠", "petit": "프티", "grand": "그랑",
    "homme": "옴", "femme": "팜", "enfant": "앙팡",
    "travailleur": "트라바이외르", "patron": "파트롱",
    "animal": "아니말", "maison": "메종", "porte": "포르트",
    "fenetre": "프네트르", "escalier": "에스칼리에",
    "monter": "몽테", "descendre": "데상드르",
    "ouvrir": "우브리르", "fermer": "페르메",
    "vite": "비트", "lentement": "랑트망",
    "chaud": "쇼", "froid": "프루아",
    "propre": "프로프르", "sale": "살",
};
function hangulizeFrench(text: string): string {
    return dictPatternHangulize(text, frWords, frPatterns);
}

// ========== 스페인어 ==========
const esPatterns: Array<[RegExp, string]> = [
    // 다중 문자 패턴 먼저
    [/cion/g, "시온"], [/ny/g, "니"],  // ny = ñ (NFD 전처리에서 변환됨)
    [/rr/g, "르"], [/ll/g, "이"], [/ch/g, "치"],
    // gu/qu 컨텍스트 처리 (e/i 앞 = u 묵음, a/o 앞 = u 발음)
    [/gu(?=[ei])/g, "그"], [/gu(?=[ao])/g, "구"],
    [/qu(?=[ei])/g, "크"], [/qu/g, "크"],
    // 이중모음
    [/ue/g, "웨"], [/ua/g, "와"], [/ie/g, "이에"],
    [/ia/g, "이아"], [/io/g, "이오"],
    // 모음
    [/a/g, "아"], [/e/g, "에"], [/i/g, "이"], [/o/g, "오"], [/u/g, "우"],
    // 자음 (c+e/i = /s/ → 스, c+a/o/u = /k/ → 크)
    [/c(?=[ei])/g, "스"], [/c/g, "크"],
    [/b/g, "브"], [/d/g, "드"], [/f/g, "프"],
    [/g/g, "그"], [/h/g, ""], [/j/g, "호"], [/k/g, "크"],
    [/l/g, "ㄹ"], [/m/g, "므"], [/n/g, "느"], [/p/g, "프"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "크스"], [/y/g, "이"], [/z/g, "스"],
];
const esWords: Record<string, string> = {
    "buenos": "부에노스", "dias": "디아스", "buenas": "부에나스", "tardes": "타르데스",
    "noches": "노체스", "gracias": "그라시아스", "si": "시", "no": "노",
    "y": "이", "o": "오", "pero": "페로", "con": "콘",
    "el": "엘", "la": "라", "los": "로스", "las": "라스",
    "un": "운", "una": "우나", "de": "데", "del": "델", "en": "엔",
    "para": "파라", "por": "포르", "sobre": "소브레",
    "seguridad": "세구리다드", "casco": "카스코", "peligro": "펠리그로",
    "cuidado": "쿠이다도", "alto": "알토", "salida": "살리다",
    "trabajo": "트라바호", "trabajador": "트라바하도르", "obra": "오브라",
    "entrada": "엔트라다", "prohibido": "프로이비도",
    "use": "우세", "obligatorio": "오블리가토리오",
    "emergencia": "에메르헨시아", "primeros": "프리메로스", "auxilios": "아욱실리오스",
    "agua": "아구아", "fuego": "푸에고", "electrico": "엘렉트리코",
    "arriba": "아리바", "abajo": "아바호", "izquierda": "이스키에르다", "derecha": "데레차",
    // 건설 추가
    "construccion": "콘스트룩시온", "andamio": "안다미오", "cemento": "세멘토",
    "grua": "그루아", "escalera": "에스칼레라", "soldadura": "솔다두라",
    "excavacion": "에스카바시온", "maquinaria": "마키나리아",
    "llave": "야베", "cimiento": "시미엔토", "hormigon": "오르미곤",
    "acero": "아세로", "ladrillo": "라드리요", "tubo": "투보",
    "herramienta": "에라미엔타", "proteccion": "프로텍시온",
    "incendio": "인센디오", "extintor": "에스틴토르",
    // ñ 포함 단어 (NFD에서 ny로 변환됨)
    "ninyo": "니뇨", "ninyos": "니뇨스", "senyol": "세뇰",
    "senyal": "세냘", "suenyo": "수에뇨", "banyos": "바뇨스",
    "banyo": "바뇨", "anyo": "아뇨", "danyos": "다뇨스",
    "companynero": "콤파녜로", "espanya": "에스파냐",
    // 일반 고빈도 단어
    "como": "코모", "donde": "돈데", "cuando": "쿠안도",
    "porque": "포르케", "mucho": "무초", "poco": "포코",
    "bien": "비엔", "mal": "말", "aqui": "아키", "alli": "아이",
    "siempre": "시엠프레", "nunca": "눈카", "ahora": "아오라",
    "antes": "안테스", "despues": "데스푸에스",
    "rapido": "라피도", "lento": "렌토", "grande": "그란데",
    "pequenyo": "페케뇨", "nuevo": "누에보", "viejo": "비에호",
    "caliente": "칼리엔테", "frio": "프리오",
    "abrir": "아브리르", "cerrar": "세라르", "subir": "수비르", "bajar": "바하르",
    "llevar": "예바르", "poner": "포네르", "tomar": "토마르",
};
function hangulizeSpanish(text: string): string {
    return dictPatternHangulize(text, esWords, esPatterns);
}

// ========== 키릴 문자 → 한글 변환 (러시아어, 카자흐어, 몽골어) ==========
const cyrillicMap: Record<string, string> = {
    'а': '아', 'б': '브', 'в': '브', 'г': '그', 'д': '드',
    'е': '예', 'ё': '요', 'ж': '주', 'з': '즈', 'и': '이',
    'й': '이', 'к': '크', 'л': '르', 'м': '므', 'н': '느',
    'о': '오', 'п': '프', 'р': '르', 'с': '스', 'т': '트',
    'у': '우', 'ф': '프', 'х': '흐', 'ц': '츠', 'ч': '치',
    'ш': '쉬', 'щ': '쉬', 'ъ': '', 'ы': '이', 'ь': '',
    'э': '에', 'ю': '유', 'я': '야',
    // 카자흐어 추가 문자
    'ә': '애', 'ғ': '그', 'қ': '크', 'ң': '응', 'ө': '외',  // ө=/ø/ → 외 (not 오)
    'ұ': '우', 'ү': '위', 'һ': '흐', 'і': '이',
};
const cyrillicWords: Record<string, string> = {
    "здравствуйте": "즈드라브스뜨부이쩨", "привет": "프리벳", "спасибо": "스파시바",
    "да": "다", "нет": "녯", "хорошо": "하라쇼",
    "и": "이", "или": "일리", "но": "노", "с": "스",
    "безопасность": "베자파스나스찌", "каска": "카스카", "опасно": "아파스나",
    "осторожно": "아스따로주나", "стоп": "스톱",
    "работа": "라보따", "рабочий": "라보치", "стройка": "스뜨로이카",
    "вход": "브홋", "выход": "비홋", "запрещено": "자프리쉬노",
    "наденьте": "나덴쩨", "обязательно": "아뱌자쩰나",
    "помощь": "뽀마쉬", "первая": "뻬르바야", "скорая": "스코라야",
    "вода": "바다", "огонь": "아곤", "электричество": "엘렉뜨리체스뜨바",
    "вверх": "브베르흐", "вниз": "브니즈", "влево": "블레바", "вправо": "브프라바",
    // 건설 추가
    "бетон": "베톤", "кран": "크란", "арматура": "아르마투라",
    "кирпич": "키르피치", "цемент": "쩨멘트", "лестница": "레스뜨니짜",
    "леса": "레사", "лифт": "리프트", "труба": "트루바",
    "стена": "스쩨나", "крыша": "크리샤", "фундамент": "푼다멘트",
    "инструмент": "인스트루멘트", "молоток": "몰로톡", "гвоздь": "그보즈디",
    // 카자흐어
    "қауіпсіздік": "카우입시즈딕", "құрылыс": "쿠를르스",
    "жұмысшы": "주므쉬", "алаң": "알랑", "темір": "테미르",
    // 몽골어
    "аюулгүй": "아유울귀", "барилга": "바릴가",
    "ажилчин": "아질친", "төмөр": "토모르",
};
// 키릴 자음+모음 융합 매핑 (자음이 모음 앞에서 음절화)
const cyrillicConsonantOnset: Record<string, string> = {
    'б': '바', 'в': '바', 'г': '가', 'д': '다', 'ж': '주', 'з': '자',
    'к': '카', 'л': '라', 'м': '마', 'н': '나', 'п': '파', 'р': '라',
    'с': '사', 'т': '타', 'ф': '파', 'х': '하', 'ц': '차', 'ч': '차',
    'ш': '샤', 'щ': '샤', 'й': '이',
    // 카자흐어
    'ғ': '가', 'қ': '카', 'һ': '하',
};
// 키릴 모음 매핑
const cyrillicVowels: Record<string, string> = {
    'а': '아', 'е': '에', 'ё': '요', 'и': '이', 'о': '오', 'у': '우',
    'э': '에', 'ю': '유', 'я': '야', 'ы': '이',
    'ә': '애', 'ө': '외', 'ұ': '우', 'ү': '위', 'і': '이',
};
// 어말 무성음화 (б/в/г/д → 프/프/크/트)
const cyrillicFinalDevoice: Record<string, string> = {
    'б': '프', 'в': '프', 'г': '크', 'д': '트',
};

function hangulizeCyrillic(text: string): string {
    const lower = text.toLowerCase();
    return lower.split(/\s+/).map(word => {
        const m = word.match(/^([а-яёәғқңөұүһі'-]+)([^а-яёәғқңөұүһі'-]*)$/);
        const clean = m ? m[1] : word;
        const trail = m ? m[2] : "";
        if (cyrillicWords[clean]) return cyrillicWords[clean] + trail;

        // 자음+모음 융합 처리
        const chars = Array.from(clean);
        let result = '';
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const next = i + 1 < chars.length ? chars[i + 1] : null;
            const isLast = i === chars.length - 1;

            // 연음부호/경음부호 스킵
            if (ch === 'ъ' || ch === 'ь') continue;

            // 모음이면 직접 매핑
            if (cyrillicVowels[ch]) {
                // е는 단어 초두/모음 뒤에서만 예, 자음 뒤에서는 에
                if (ch === 'е' && i > 0 && !cyrillicVowels[chars[i - 1]] && chars[i - 1] !== 'ь') {
                    result += '에';
                } else if (ch === 'е') {
                    result += '예';
                } else {
                    result += cyrillicVowels[ch];
                }
                continue;
            }

            // 자음 처리
            if (cyrillicConsonantOnset[ch] && next && cyrillicVowels[next]) {
                // 자음 + 모음 → 융합 음절 (onset 첫 글자 + 모음)
                const onset = cyrillicConsonantOnset[ch];
                // onset의 첫 자음 추출하여 모음과 결합
                result += onset.charAt(0);
                continue; // 모음은 다음 루프에서 처리
            }

            // 어말 무성음화
            if (isLast && cyrillicFinalDevoice[ch]) {
                result += cyrillicFinalDevoice[ch];
                continue;
            }

            // 기본 매핑
            result += cyrillicMap[ch] || ch;
        }
        return result + trail;
    }).join(' ');
}

function hangulizePinyin(pinyin: string): string {
    // 1. Pre-process: handle spaces that look like they split a syllable (e.g. "hu n" -> "hun")
    let cleaned = pinyin.replace(/([aeiouüv])\s+([ng])/g, "$1$2");
    cleaned = cleaned.replace(/n\s+g/g, "ng");

    return cleaned.split(/\s+/).map(word => {
        // 구두점 분리: "hao," → "hao" + ","
        const punctMatch = word.match(/^([a-z0-9üv]+)([^a-z0-9üv]*)$/);
        const cleanWord = punctMatch ? punctMatch[1] : word;
        const trailing = punctMatch ? punctMatch[2] : "";

        let remaining = cleanWord;
        const resArr: string[] = [];

        while (remaining.length > 0) {
            let found = false;
            for (let i = Math.min(6, remaining.length); i >= 1; i--) {
                const sub = remaining.substring(0, i);
                if (pinyinMap[sub]) {
                    resArr.push(pinyinMap[sub]);
                    remaining = remaining.substring(i);
                    found = true;
                    break;
                }
            }
            if (!found) {
                const char = remaining[0];
                const lastIdx = resArr.length - 1;

                // Smart merge: if this character is a common batchim (n, g, l...) and follows a vowel-ended syllable
                if (lastIdx >= 0 && batchimCandidates[char]) {
                    const lastSyllable = resArr[lastIdx];
                    const code = lastSyllable.charCodeAt(0);
                    if (code >= 44032 && code <= 55203 && (code - 44032) % 28 === 0) {
                        const batchim = batchimCandidates[char];
                        const initial = Math.floor((code - 44032) / 588);
                        const vowel = Math.floor(((code - 44032) % 588) / 28);

                        // Map index back to jamo
                        const initialJamo = Object.keys(INITIAL_MAP).find(k => INITIAL_MAP[k] === initial) || "ㅇ";
                        const vowelJamo = Object.keys(VOWEL_MAP).find(k => VOWEL_MAP[k] === vowel) || "ㅏ";

                        resArr[lastIdx] = assemble(initialJamo, vowelJamo, batchim);
                    } else {
                        resArr.push(vMap[char] || char);
                    }
                } else {
                    resArr.push(vMap[char] || char);
                }
                remaining = remaining.substring(1);
            }
        }
        return resArr.join("") + trailing;
    }).join(" ");
}

/**
 * 영어 및 Latin 스크립트 → 한글 발음 변환
 * 음절/패턴 단위로 변환하여 자연스러운 한글 발음 생성
 */
const engPatterns: Array<[RegExp, string]> = [
    // 일반적 영어 단어 (빈도순)
    // 3+ 글자 패턴 (먼저 매칭)
    [/tion/g, "션"], [/sion/g, "전"], [/ment/g, "먼트"], [/ness/g, "니스"],
    [/ight/g, "아이트"], [/ough/g, "오"], [/ould/g, "우드"],
    [/ther/g, "더"], [/ther/g, "더"], [/ture/g, "처"],
    [/ble/g, "블"], [/ple/g, "플"], [/tle/g, "틀"],
    [/ing\b/g, "잉"], [/ong\b/g, "옹"], [/ang\b/g, "앵"],
    [/ung\b/g, "엉"], [/ank/g, "앵크"],
    [/ous/g, "어스"], [/ious/g, "이어스"], [/eous/g, "이어스"],
    [/ful/g, "풀"], [/less/g, "리스"], [/ize/g, "아이즈"],
    [/ity/g, "이티"], [/ary/g, "어리"], [/ory/g, "오리"],
    [/ally/g, "얼리"], [/ely/g, "을리"],
    [/ck/g, "크"], [/tch/g, "치"],

    // 2글자 자음 패턴
    [/th/g, "스"], [/sh/g, "쉬"], [/ch/g, "치"], [/ph/g, "프"],
    [/wh/g, "와"], [/wr/g, "르"], [/kn/g, "느"],
    [/qu/g, "쿠"], [/ng/g, "ㅇ"],
    [/tr/g, "트르"], [/dr/g, "드르"], [/pr/g, "프르"],
    [/br/g, "브르"], [/cr/g, "크르"], [/gr/g, "그르"],
    [/fr/g, "프르"], [/fl/g, "플"], [/bl/g, "블"],
    [/sl/g, "슬"], [/cl/g, "클"], [/pl/g, "플"],
    [/st/g, "스트"], [/sp/g, "스프"], [/sk/g, "스크"],
    [/sm/g, "스므"], [/sn/g, "스느"],

    // 2글자 모음 패턴
    [/ee/g, "이"], [/ea/g, "이"], [/oo/g, "우"], [/ou/g, "아우"],
    [/ow/g, "오우"], [/oi/g, "오이"], [/oy/g, "오이"],
    [/ai/g, "에이"], [/ay/g, "에이"], [/ey/g, "에이"],
    [/ie/g, "이"], [/ei/g, "에이"], [/oa/g, "오"],
    [/au/g, "오"], [/aw/g, "오"],
    [/ar/g, "아르"], [/er/g, "어"], [/ir/g, "어"], [/or/g, "오르"], [/ur/g, "어"],
    [/al/g, "올"], [/el/g, "엘"], [/il/g, "일"], [/ol/g, "올"], [/ul/g, "울"],

    // 단일 자음
    [/b/g, "브"], [/c/g, "크"], [/d/g, "드"], [/f/g, "프"],
    [/g/g, "그"], [/h/g, "ㅎ"], [/j/g, "지"], [/k/g, "크"],
    [/l/g, "르"], [/m/g, "므"], [/n/g, "느"], [/p/g, "프"],
    [/r/g, "르"], [/s/g, "스"], [/t/g, "트"], [/v/g, "브"],
    [/w/g, "우"], [/x/g, "크스"], [/y/g, "이"], [/z/g, "즈"],

    // 단일 모음
    [/a/g, "아"], [/e/g, "에"], [/i/g, "이"], [/o/g, "오"], [/u/g, "우"],
];

// 자주 쓰는 영어 단어 직접 매핑 (정확한 발음)
const commonWords: Record<string, string> = {
    // 기본 인사/대화
    "hello": "헬로", "hi": "하이", "yes": "예스", "no": "노",
    "ok": "오케이", "okay": "오케이", "please": "플리즈", "thank": "땡크", "thanks": "땡스",
    "sorry": "쏘리", "good": "굿", "bad": "배드",
    "welcome": "웰컴", "bye": "바이", "goodbye": "굿바이",

    // 관사/대명사/전치사/접속사
    "the": "더", "a": "어", "an": "앤", "is": "이즈", "are": "아",
    "was": "워즈", "were": "워", "be": "비", "been": "빈", "being": "비잉",
    "it": "잇", "its": "이츠", "i": "아이", "we": "위", "you": "유",
    "he": "히", "she": "쉬", "they": "데이", "them": "뎀", "us": "어스",
    "my": "마이", "your": "유어", "his": "히즈", "her": "허", "our": "아워", "their": "데어",
    "in": "인", "on": "온", "at": "앳", "to": "투", "for": "포",
    "of": "오브", "from": "프롬", "by": "바이", "with": "위드", "about": "어바웃",
    "into": "인투", "out": "아웃", "over": "오버", "under": "언더", "between": "비트윈",
    "through": "스루", "after": "애프터", "before": "비포", "during": "듀링",
    "and": "앤드", "or": "오어", "but": "벗", "if": "이프", "so": "소",
    "as": "애즈", "than": "댄", "because": "비코즈", "when": "웬", "while": "와일",

    // 기본 동사
    "do": "두", "does": "더즈", "did": "디드", "done": "던",
    "have": "해브", "has": "해즈", "had": "해드",
    "will": "윌", "would": "우드", "shall": "쉘", "should": "슈드",
    "can": "캔", "could": "쿠드", "may": "메이", "might": "마이트",
    "not": "낫", "don't": "돈트", "can't": "캔트", "won't": "원트", "doesn't": "더즌트",
    "let": "렛", "let's": "렛츠", "lets": "렛츠", "get": "겟", "got": "갓", "give": "기브",
    "go": "고", "come": "컴", "make": "메이크", "take": "테이크",
    "put": "풋", "set": "셋", "keep": "킵", "try": "트라이",
    "say": "세이", "said": "세드", "tell": "텔", "told": "톨드",
    "know": "노우", "think": "씽크", "see": "씨", "look": "룩",
    "want": "원트", "need": "니드", "use": "유즈", "find": "파인드",
    "show": "쇼", "call": "콜", "ask": "애스크", "feel": "필",
    "leave": "리브", "bring": "브링", "hold": "홀드", "turn": "턴",
    "begin": "비긴", "run": "런", "stand": "스탠드", "sit": "싯",
    "send": "센드", "build": "빌드", "follow": "팔로우", "help": "헬프",
    "read": "리드", "write": "라이트", "speak": "스피크", "learn": "런",
    "play": "플레이", "pay": "페이", "meet": "미트", "spend": "스펜드",
    "happen": "해픈", "allow": "얼라우", "include": "인클루드", "continue": "컨티뉴",

    // 기본 형용사/부사
    "all": "올", "every": "에브리", "each": "이치", "much": "머치", "many": "매니",
    "some": "섬", "any": "에니", "few": "퓨", "more": "모어", "most": "모스트",
    "other": "아더", "new": "뉴", "old": "올드", "big": "빅", "small": "스몰",
    "long": "롱", "short": "쇼트", "high": "하이", "low": "로우",
    "great": "그레이트", "little": "리틀", "own": "오운", "same": "세임",
    "last": "라스트", "next": "넥스트", "early": "얼리", "late": "레이트",
    "young": "영", "important": "임포턴트", "able": "에이블",
    "also": "올소", "just": "저스트", "very": "베리", "too": "투",
    "always": "올웨이즈", "never": "네버", "often": "오프튼",
    "already": "올레디", "still": "스틸", "again": "어겐", "together": "투게더",
    "only": "온리", "even": "이븐", "really": "리얼리", "quite": "콰이트",
    "then": "덴", "now": "나우", "how": "하우", "where": "웨어",
    "why": "와이", "what": "왓", "which": "위치", "who": "후",

    // 기본 명사
    "time": "타임", "times": "타임즈", "year": "이어", "people": "피플", "way": "웨이",
    "day": "데이", "man": "맨", "woman": "우먼", "child": "차일드",
    "world": "월드", "life": "라이프", "hand": "핸드", "part": "파트",
    "place": "플레이스", "case": "케이스", "week": "위크", "company": "컴퍼니",
    "system": "시스템", "program": "프로그램", "question": "퀘스천",
    "number": "넘버", "night": "나이트", "point": "포인트", "home": "홈",
    "end": "엔드", "head": "헤드", "side": "사이드", "name": "네임",
    "line": "라인", "plan": "플랜", "team": "팀", "problem": "프라블럼",

    // 요일/월/숫자
    "monday": "먼데이", "tuesday": "튜즈데이", "wednesday": "웬즈데이",
    "thursday": "서즈데이", "friday": "프라이데이", "saturday": "새터데이", "sunday": "선데이",
    "january": "재뉴어리", "february": "페브루어리", "march": "마치",
    "april": "에이프릴", "june": "준", "july": "줄라이",
    "august": "어거스트", "september": "셉템버", "october": "옥토버",
    "november": "노벰버", "december": "디셈버",
    "one": "원", "two": "투", "three": "쓰리", "four": "포", "five": "파이브",
    "six": "식스", "seven": "세븐", "eight": "에이트", "nine": "나인", "ten": "텐",

    // 건설/안전
    "safety": "세이프티", "helmet": "헬멧", "danger": "데인저", "warning": "워닝",
    "caution": "코션", "stop": "스톱",
    "work": "워크", "worker": "워커", "workers": "워커즈",
    "site": "사이트", "area": "에어리어",
    "zone": "존", "floor": "플로어", "level": "레벨",
    "basement": "베이스먼트", "underground": "언더그라운드",
    "rebar": "리바", "concrete": "콘크리트", "steel": "스틸",
    "crane": "크레인", "scaffold": "스캐폴드", "ladder": "래더",
    "fire": "파이어", "water": "워터", "power": "파워",
    "electric": "일렉트릭", "tool": "툴", "machine": "머신",
    "protect": "프로텍트", "protection": "프로텍션", "equipment": "이큅먼트",
    "inspect": "인스펙트", "inspection": "인스펙션",
    "manager": "매니저", "supervisor": "슈퍼바이저", "engineer": "엔지니어",
    "wear": "웨어", "remove": "리무브", "install": "인스톨",
    "check": "체크", "clean": "클린", "move": "무브", "lift": "리프트",
    "push": "푸쉬", "pull": "풀", "open": "오픈", "close": "클로즈",
    "start": "스타트", "finish": "피니시", "complete": "컴플리트",
    "report": "리포트", "emergency": "이머전시", "accident": "액시던트",
    "injury": "인저리", "hospital": "호스피탈", "first": "퍼스트", "aid": "에이드",
    "hard": "하드", "hat": "햇", "vest": "베스트", "gloves": "글러브즈",
    "boots": "부츠", "glasses": "글래시즈", "mask": "마스크",
    "fall": "폴", "slip": "슬립", "trip": "트립", "hit": "히트",
    "cut": "커트", "burn": "번", "crush": "크러쉬",
    "left": "레프트", "right": "라이트", "up": "업", "down": "다운",
    "here": "히어", "there": "데어", "this": "디스", "that": "댓",
    "today": "투데이", "tomorrow": "투모로우", "morning": "모닝", "afternoon": "애프터눈",
    "must": "머스트", "required": "리콰이어드", "prohibited": "프로히비티드",
    "enter": "엔터", "exit": "엑시트", "entry": "엔트리",
    "slogan": "슬로건", "appropriate": "어프로프리엇",
    "recite": "리사이트", "shortcut": "쇼트컷", "free": "프리",
    "safe": "세이프", "secure": "시큐어", "rule": "룰", "rules": "룰즈",
    "everyone": "에브리원", "everything": "에브리씽",
    "something": "썸씽", "nothing": "너씽", "anything": "에니씽",
    "construction": "컨스트럭션", "building": "빌딩", "project": "프로젝트",
    "material": "머티리얼", "materials": "머티리얼즈",
    "procedure": "프로시저", "process": "프로세스",
    "temperature": "템퍼러처", "weather": "웨더", "rain": "레인", "wind": "윈드",
    "measure": "메져", "distance": "디스턴스", "height": "하이트", "weight": "웨이트",
    "heavy": "헤비", "light": "라이트", "strong": "스트롱", "weak": "위크",
    "careful": "케어풀", "carefully": "케어풀리",
    "possible": "파서블", "impossible": "임파서블",
    "available": "어베일러블", "necessary": "네세서리",
    "remember": "리멤버", "forget": "포겟", "understand": "언더스탠드",
    "practice": "프랙티스", "prepare": "프리페어", "prevent": "프리벤트",
    "maintain": "메인테인", "repair": "리페어", "replace": "리플레이스",
    "operate": "오퍼레이트", "handle": "핸들", "control": "컨트롤",
    "ensure": "인슈어", "confirm": "컨펌",
    "notice": "노티스", "sign": "사인", "signal": "시그널",
    "permit": "퍼밋", "permission": "퍼미션", "approved": "어프루브드", "denied": "디나이드",
    "correct": "커렉트", "wrong": "롱", "proper": "프라퍼",
    "above": "어보브", "below": "빌로우", "near": "니어", "far": "파",
    "front": "프론트", "back": "백", "inside": "인사이드", "outside": "아웃사이드",
    "top": "톱", "bottom": "바텀", "middle": "미들", "center": "센터",
    "around": "어라운드", "across": "어크로스", "along": "얼롱",
    "behind": "비하인드", "beside": "비사이드", "toward": "투워드", "towards": "투워즈",
    "against": "어겐스트", "upon": "어폰", "within": "위딘", "without": "위다웃",
    "ready": "레디", "sure": "슈어", "clear": "클리어",
    "enough": "이너프", "except": "익셉트",
    "until": "언틸", "since": "신스", "unless": "언레스",
    "whether": "웨더", "though": "도우", "although": "올도우",
    "perhaps": "퍼햅스", "maybe": "메이비", "probably": "프라버블리",
    "actually": "액츄얼리", "especially": "이스페셜리", "usually": "유주얼리",
    "exactly": "이그잭틀리", "finally": "파이널리", "quickly": "퀵리", "slowly": "슬로울리",
    "safely": "세이플리", "correctly": "커렉틀리", "properly": "프라펄리",
    "immediately": "이미디엇리", "directly": "다이렉틀리",
};

function convertSingleWord(word: string): string {
    if (!word) return "";
    if (/^\d+$/.test(word)) return word;

    // 정확한 단어 매핑이 있으면 사용
    if (commonWords[word]) return commonWords[word];

    // 복합어 처리: 접미사 분리 시도
    for (const [suffix, suffixKr] of Object.entries(commonWords)) {
        if (word.endsWith(suffix) && word.length > suffix.length) {
            const prefix = word.slice(0, word.length - suffix.length);
            if (commonWords[prefix]) return commonWords[prefix] + suffixKr;
        }
    }

    // 패턴 기반 변환
    let converted = word;
    for (const [pattern, replacement] of engPatterns) {
        converted = converted.replace(pattern, replacement);
    }

    // 자음 클러스터 정리
    converted = converted.replace(/([ㅎ])/g, '');
    converted = converted.replace(/ㅇ/g, 'ㅇ');

    return converted;
}

function genericHangulize(text: string): string {
    // 1단계: 단어 단위로 분리하여 사전 매핑
    const words = text.toLowerCase().split(/\s+/);
    const result = words.map(word => {
        // 구두점 분리: "friday," → "friday" + ","
        const punctMatch = word.match(/^([a-z0-9'-]+)([^a-z0-9'-]*)$/);
        const cleanWord = punctMatch ? punctMatch[1] : word;
        const trailing = punctMatch ? punctMatch[2] : "";

        // 숫자는 그대로 반환
        if (/^\d+$/.test(cleanWord)) return cleanWord + trailing;

        // 하이픈 복합어 처리: "accident-free" → "액시던트-프리"
        if (cleanWord.includes('-')) {
            const parts = cleanWord.split('-');
            const converted = parts.map(part => convertSingleWord(part)).join('-');
            return converted + trailing;
        }

        return convertSingleWord(cleanWord) + trailing;
    });

    return result.join(' ');
}

// ========== 일본어 (가나 → 한글) ==========
const kanaMap: Record<string, string> = {
    // 히라가나 기본
    'あ': '아', 'い': '이', 'う': '우', 'え': '에', 'お': '오',
    'か': '카', 'き': '키', 'く': '쿠', 'け': '케', 'こ': '코',
    'さ': '사', 'し': '시', 'す': '스', 'せ': '세', 'そ': '소',
    'た': '타', 'ち': '치', 'つ': '츠', 'て': '테', 'と': '토',
    'な': '나', 'に': '니', 'ぬ': '누', 'ね': '네', 'の': '노',
    'は': '하', 'ひ': '히', 'ふ': '후', 'へ': '헤', 'ほ': '호',
    'ま': '마', 'み': '미', 'む': '무', 'め': '메', 'も': '모',
    'や': '야', 'ゆ': '유', 'よ': '요',
    'ら': '라', 'り': '리', 'る': '루', 'れ': '레', 'ろ': '로',
    'わ': '와', 'を': '오', 'ん': '은',
    // 탁음
    'が': '가', 'ぎ': '기', 'ぐ': '구', 'げ': '게', 'ご': '고',
    'ざ': '자', 'じ': '지', 'ず': '즈', 'ぜ': '제', 'ぞ': '조',
    'だ': '다', 'ぢ': '지', 'づ': '즈', 'で': '데', 'ど': '도',
    'ば': '바', 'び': '비', 'ぶ': '부', 'べ': '베', 'ぼ': '보',
    // 반탁음
    'ぱ': '파', 'ぴ': '피', 'ぷ': '푸', 'ぺ': '페', 'ぽ': '포',
    // 요음 (2문자 → 1음절)
    'きゃ': '캬', 'きゅ': '큐', 'きょ': '쿄',
    'しゃ': '샤', 'しゅ': '슈', 'しょ': '쇼',
    'ちゃ': '차', 'ちゅ': '추', 'ちょ': '초',
    'にゃ': '냐', 'にゅ': '뉴', 'にょ': '뇨',
    'ひゃ': '햐', 'ひゅ': '휴', 'ひょ': '효',
    'みゃ': '먀', 'みゅ': '뮤', 'みょ': '묘',
    'りゃ': '랴', 'りゅ': '류', 'りょ': '료',
    'ぎゃ': '갸', 'ぎゅ': '규', 'ぎょ': '교',
    'じゃ': '자', 'じゅ': '주', 'じょ': '조',
    'びゃ': '뱌', 'びゅ': '뷰', 'びょ': '뵤',
    'ぴゃ': '퍄', 'ぴゅ': '퓨', 'ぴょ': '표',
    // 카타카나 기본
    'ア': '아', 'イ': '이', 'ウ': '우', 'エ': '에', 'オ': '오',
    'カ': '카', 'キ': '키', 'ク': '쿠', 'ケ': '케', 'コ': '코',
    'サ': '사', 'シ': '시', 'ス': '스', 'セ': '세', 'ソ': '소',
    'タ': '타', 'チ': '치', 'ツ': '츠', 'テ': '테', 'ト': '토',
    'ナ': '나', 'ニ': '니', 'ヌ': '누', 'ネ': '네', 'ノ': '노',
    'ハ': '하', 'ヒ': '히', 'フ': '후', 'ヘ': '헤', 'ホ': '호',
    'マ': '마', 'ミ': '미', 'ム': '무', 'メ': '메', 'モ': '모',
    'ヤ': '야', 'ユ': '유', 'ヨ': '요',
    'ラ': '라', 'リ': '리', 'ル': '루', 'レ': '레', 'ロ': '로',
    'ワ': '와', 'ヲ': '오', 'ン': '은',
    // 카타카나 탁음
    'ガ': '가', 'ギ': '기', 'グ': '구', 'ゲ': '게', 'ゴ': '고',
    'ザ': '자', 'ジ': '지', 'ズ': '즈', 'ゼ': '제', 'ゾ': '조',
    'ダ': '다', 'ヂ': '지', 'ヅ': '즈', 'デ': '데', 'ド': '도',
    'バ': '바', 'ビ': '비', 'ブ': '부', 'ベ': '베', 'ボ': '보',
    // 카타카나 반탁음
    'パ': '파', 'ピ': '피', 'プ': '푸', 'ペ': '페', 'ポ': '포',
    // 카타카나 요음
    'キャ': '캬', 'キュ': '큐', 'キョ': '쿄',
    'シャ': '샤', 'シュ': '슈', 'ショ': '쇼',
    'チャ': '차', 'チュ': '추', 'チョ': '초',
    'ニャ': '냐', 'ニュ': '뉴', 'ニョ': '뇨',
    'ヒャ': '햐', 'ヒュ': '휴', 'ヒョ': '효',
    'ミャ': '먀', 'ミュ': '뮤', 'ミョ': '묘',
    'リャ': '랴', 'リュ': '류', 'リョ': '료',
    'ギャ': '갸', 'ギュ': '규', 'ギョ': '교',
    'ジャ': '자', 'ジュ': '주', 'ジョ': '조',
    'ビャ': '뱌', 'ビュ': '뷰', 'ビョ': '뵤',
    'ピャ': '퍄', 'ピュ': '퓨', 'ピョ': '표',
};

const jpWords: Record<string, string> = {
    // 건설/안전 용어 (한자어 포함)
    "安全": "안젠", "危険": "키켄", "注意": "추이", "禁止": "킨시",
    "工事": "코지", "現場": "겐바", "作業": "사교", "建設": "켄세츠",
    "ヘルメット": "헬멧토", "安全帯": "안젠타이", "足場": "아시바",
    "クレーン": "쿠레은", "はしご": "하시고", "コンクリート": "콘쿠리토",
    "鉄筋": "텟킨", "電気": "덴키", "火災": "카사이", "避難": "히난",
    "出口": "데구치", "入口": "이리구치", "立入禁止": "타치이리킨시",
    "上": "우에", "下": "시타", "左": "히다리", "右": "미기",
    "止まれ": "토마레", "気をつけて": "키오츠케테",
    "お願いします": "오네가이시마스", "ありがとう": "아리가토",
    "はい": "하이", "いいえ": "이이에",
};

function hangulizeJapanese(text: string): string {
    // 1단계: 사전 매핑 (한자 복합어)
    let result = text;
    for (const [jp, kr] of Object.entries(jpWords)) {
        result = result.replace(new RegExp(jp, 'g'), kr);
    }

    // 2단계: 촉음(っ/ッ) 처리 — 다음 자음 쌍자음화
    result = result.replace(/[っッ](.)/g, (_match, next) => {
        const mapped = kanaMap[next];
        if (mapped) {
            // 첫 자음을 받침으로 표현 (간소화: 앞에 ㅅ 받침 추가)
            return mapped + mapped;
        }
        return next;
    });

    // 3단계: 장음(ー) 처리 — 앞 모음 반복 무시 (한글에서는 자연스럽게 생략)
    result = result.replace(/ー/g, '');

    // 4단계: 요음(2문자) 먼저, 그 다음 단일 가나 변환
    let converted = '';
    let i = 0;
    while (i < result.length) {
        // 2문자 요음 체크
        if (i + 1 < result.length) {
            const pair = result[i] + result[i + 1];
            if (kanaMap[pair]) {
                converted += kanaMap[pair];
                i += 2;
                continue;
            }
        }
        // 단일 문자 체크
        if (kanaMap[result[i]]) {
            converted += kanaMap[result[i]];
        } else {
            converted += result[i];
        }
        i++;
    }

    return converted;
}
