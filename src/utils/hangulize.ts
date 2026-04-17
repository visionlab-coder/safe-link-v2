/**
 * Hangulize: Converts Romanized text (Pinyin, etc.) into Korean phonetic scripts (Hangul).
 * Specialized for Chinese Pinyin with exhaustive syllable mapping and smart syllable assembly.
 */

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

// 태국어 로마자 → 한글 매핑 (영어 bridge 경유 시 사용)
const thSyllables: Record<string, string> = {
    "sawatdi": "사왓디", "khrap": "크랍", "kha": "카", "chai": "차이", "mai": "마이",
    "khob": "콥", "khun": "쿤", "sabai": "사바이", "di": "디", "arai": "아라이",
    "nan": "난", "ni": "니", "thi": "티", "nai": "나이", "pen": "뻰", "khao": "카오",
    "rao": "라오", "phom": "폼", "chan": "찬", "ja": "자", "pai": "빠이", "ma": "마",
    "kin": "긴", "nam": "남", "wan": "완", "rot": "롯", "ban": "반", "mueang": "므앙",
    "rong": "롱", "rian": "리안", "ngan": "응안", "phak": "팍", "pon": "뻰",
    "suai": "수아이", "lek": "렉", "yai": "야이", "noi": "노이", "mak": "막",
    "dee": "디", "rew": "레우", "cha": "차", "ao": "아오", "hai": "하이",
    "kan": "깐", "kap": "갑", "duai": "두아이", "laew": "래우", "yang": "양",
    "dai": "다이", "tong": "통", "sam": "삼", "si": "씨", "ha": "하",
    "hok": "혹", "jet": "쩻", "paet": "뺏", "kao": "까오", "sip": "씹",
    "song": "송", "phasa": "파사", "thai": "타이", "khon": "콘",
};

// 인도네시아어/말레이어 음절 매핑
const idSyllables: Record<string, string> = {
    "selamat": "슬라맛", "pagi": "빠기", "siang": "시앙", "sore": "소레", "malam": "말람",
    "terima": "뜨리마", "kasih": "까시", "sama": "사마", "tidak": "띠닥", "bisa": "비사",
    "apa": "아빠", "ini": "이니", "itu": "이뚜", "dan": "단", "yang": "양",
    "untuk": "운뚝", "dengan": "드응안", "ada": "아다", "akan": "아깐", "dari": "다리",
    "sudah": "수다", "belum": "블룸", "juga": "주가", "atau": "아따우", "saya": "사야",
    "kami": "까미", "mereka": "므레까", "dia": "디아", "baik": "바잌", "bagus": "바구스",
    "besar": "브사르", "kecil": "크칠", "baru": "바루", "lama": "라마",
    "kerja": "끄르자", "pekerja": "쁘끄르자", "bahaya": "바하야", "aman": "아만",
    "hati": "하띠", "helm": "헬름", "sepatu": "스빠뚜", "sarung": "사룽",
    "tangan": "딴안", "alat": "알랏", "mesin": "므신", "bangunan": "방우난",
};

export function hangulize(text: string, lang: string): string {
    if (!text) return "";
    let normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/u:/g, "v").replace(/ü/g, "v");

    if (lang === 'zh') return hangulizePinyin(normalized);
    if (lang === 'vi') {
        normalized = normalized.replace(/đ/g, "d");
        return hangulizeVietnamese(normalized);
    }
    if (lang === 'th') return hangulizeWithDict(normalized, thSyllables);
    if (lang === 'id') return hangulizeWithDict(normalized, idSyllables);
    return genericHangulize(normalized);
}

/** 사전 기반 hangulize: 사전 매칭 → fallback generic */
function hangulizeWithDict(text: string, dict: Record<string, string>): string {
    return text.split(/\s+/).map(word => {
        if (dict[word]) return dict[word];
        // 복합어: 긴 접두사/접미사 검색
        for (let i = Math.min(word.length, 8); i >= 2; i--) {
            const prefix = word.substring(0, i);
            const suffix = word.substring(i);
            if (dict[prefix] && dict[suffix]) return dict[prefix] + dict[suffix];
            if (dict[prefix] && suffix.length <= 2) {
                let converted = suffix;
                for (const [pattern, replacement] of engPatterns) {
                    converted = converted.replace(pattern, replacement);
                }
                return dict[prefix] + converted;
            }
        }
        // fallback: 영어 패턴 변환
        let converted = word;
        for (const [pattern, replacement] of engPatterns) {
            converted = converted.replace(pattern, replacement);
        }
        return converted;
    }).join(' ');
}

function hangulizeVietnamese(text: string): string {
    return text.split(/\s+/).map(word => {
        if (viSyllables[word]) return viSyllables[word];
        // 사전에 없으면 영어 패턴 기반 변환
        let converted = word;
        for (const [pattern, replacement] of engPatterns) {
            converted = converted.replace(pattern, replacement);
        }
        return converted;
    }).join(' ');
}

function hangulizePinyin(pinyin: string): string {
    // 1. Pre-process: handle spaces that look like they split a syllable (e.g. "hu n" -> "hun")
    let cleaned = pinyin.replace(/([aeiouüv])\s+([ng])/g, "$1$2");
    cleaned = cleaned.replace(/n\s+g/g, "ng");

    return cleaned.split(/\s+/).map(word => {
        let remaining = word;
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
        return resArr.join("");
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

// 영어 단어 → 한글 발음 사전 (국립국어원 외래어 표기법 기반)
// 사전에 없는 단어는 패턴 매칭으로 변환하되, 정확도가 떨어지므로 사전을 최대한 확장
const commonWords: Record<string, string> = {
    "i": "아이",
    "a": "어",
    "an": "언",
    "the": "더",
    "of": "오브",
    "is": "이즈",
    "are": "아",
    "in": "인",
    "on": "온",
    "at": "앳",
    "to": "투",
    "for": "포",
    "and": "앤드",
    "or": "오어",
    "but": "벗",
    "with": "위드",
    "from": "프롬",
    "by": "바이",
    "as": "애즈",
    "if": "이프",
    "so": "소",
    "be": "비",
    "it": "잇",
    "all": "올",
    "any": "애니",
    "no": "노",
    "not": "낫",
    "yes": "예스",
    "ok": "오케이",
    "okay": "오케이",
    "hello": "헬로",
    "hi": "하이",
    "please": "플리즈",
    "thank": "땡크",
    "thanks": "땡스",
    "sorry": "쏘리",
    "good": "굿",
    "bad": "배드",
    "new": "뉴",
    "old": "올드",
    "big": "빅",
    "small": "스몰",
    "long": "롱",
    "short": "숏",
    "high": "하이",
    "low": "로우",
    "hot": "핫",
    "cold": "콜드",
    "do": "두",
    "don't": "돈트",
    "can": "캔",
    "can't": "캔트",
    "will": "윌",
    "won't": "원트",
    "must": "머스트",
    "should": "슈드",
    "go": "고",
    "come": "컴",
    "get": "겟",
    "put": "풋",
    "take": "테이크",
    "eat": "이트",
    "eating": "이팅",
    "make": "메이크",
    "give": "기브",
    "keep": "킵",
    "let": "렛",
    "set": "셋",
    "run": "런",
    "walk": "워크",
    "stand": "스탠드",
    "sit": "싯",
    "hold": "홀드",
    "turn": "턴",
    "look": "룩",
    "see": "씨",
    "watch": "워치",
    "hear": "히어",
    "call": "콜",
    "tell": "텔",
    "say": "세이",
    "ask": "애스크",
    "try": "트라이",
    "use": "유즈",
    "need": "니드",
    "want": "원트",
    "know": "노우",
    "think": "씽크",
    "feel": "필",
    "find": "파인드",
    "show": "쇼",
    "help": "헬프",
    "send": "센드",
    "bring": "브링",
    "wear": "웨어",
    "remove": "리무브",
    "install": "인스톨",
    "check": "체크",
    "clean": "클린",
    "move": "무브",
    "lift": "리프트",
    "push": "푸쉬",
    "pull": "풀",
    "open": "오픈",
    "close": "클로즈",
    "lock": "록",
    "unlock": "언록",
    "load": "로드",
    "unload": "언로드",
    "start": "스타트",
    "stop": "스톱",
    "finish": "피니시",
    "complete": "컴플리트",
    "begin": "비긴",
    "end": "엔드",
    "wait": "웨이트",
    "stay": "스테이",
    "leave": "리브",
    "enter": "엔터",
    "exit": "엑시트",
    "pass": "패스",
    "follow": "팔로우",
    "lead": "리드",
    "carry": "캐리",
    "drop": "드롭",
    "pick": "픽",
    "place": "플레이스",
    "hang": "행",
    "tie": "타이",
    "fasten": "패스튼",
    "secure": "시큐어",
    "tighten": "타이튼",
    "loosen": "루슨",
    "connect": "커넥트",
    "disconnect": "디스커넥트",
    "attach": "어태치",
    "detach": "디태치",
    "mark": "마크",
    "report": "리포트",
    "confirm": "컨펌",
    "verify": "베리파이",
    "inspect": "인스펙트",
    "observe": "옵저브",
    "maintain": "메인테인",
    "repair": "리페어",
    "replace": "리플레이스",
    "fix": "픽스",
    "protect": "프로텍트",
    "prevent": "프리벤트",
    "avoid": "어보이드",
    "evacuate": "이배큐에이트",
    "escape": "이스케이프",
    "rescue": "레스큐",
    "beware": "비웨어",
    "alert": "얼러트",
    "notify": "노티파이",
    "safety": "세이프티",
    "helmet": "헬멧",
    "danger": "데인저",
    "warning": "워닝",
    "caution": "코션",
    "hazard": "해저드",
    "risk": "리스크",
    "accident": "액시던트",
    "incident": "인시던트",
    "injury": "인저리",
    "emergency": "이머전시",
    "alarm": "알람",
    "fall": "폴",
    "falling": "폴링",
    "slip": "슬립",
    "trip": "트립",
    "hit": "히트",
    "cut": "커트",
    "burn": "번",
    "crush": "크러쉬",
    "shock": "쇼크",
    "collapse": "콜랩스",
    "explosion": "익스플로전",
    "leak": "리크",
    "spill": "스필",
    "exposure": "익스포저",
    "harness": "하니스",
    "lanyard": "랜야드",
    "anchor": "앵커",
    "hard": "하드",
    "hat": "햇",
    "vest": "베스트",
    "gloves": "글러브즈",
    "boots": "부츠",
    "glasses": "글래시즈",
    "goggles": "고글즈",
    "mask": "마스크",
    "respirator": "레스피레이터",
    "earplugs": "이어플러그",
    "shield": "쉴드",
    "guardrail": "가드레일",
    "barrier": "배리어",
    "fence": "펜스",
    "net": "넷",
    "cover": "커버",
    "sign": "사인",
    "label": "라벨",
    "hospital": "호스피탈",
    "first": "퍼스트",
    "aid": "에이드",
    "stretcher": "스트레처",
    "extinguisher": "엑스팅귀셔",
    "protection": "프로텍션",
    "equipment": "이큅먼트",
    "inspection": "인스펙션",
    "permit": "퍼밋",
    "work": "워크",
    "worker": "워커",
    "working": "워킹",
    "site": "사이트",
    "area": "에어리어",
    "zone": "존",
    "floor": "플로어",
    "level": "레벨",
    "height": "하이트",
    "ground": "그라운드",
    "surface": "서피스",
    "basement": "베이스먼트",
    "underground": "언더그라운드",
    "rebar": "리바",
    "concrete": "콘크리트",
    "steel": "스틸",
    "iron": "아이언",
    "wood": "우드",
    "brick": "브릭",
    "glass": "글래스",
    "stone": "스톤",
    "cement": "시멘트",
    "mortar": "모르타르",
    "grout": "그라우트",
    "formwork": "폼워크",
    "scaffolding": "스캐폴딩",
    "scaffold": "스캐폴드",
    "shoring": "쇼링",
    "bracing": "브레이싱",
    "crane": "크레인",
    "ladder": "래더",
    "platform": "플랫폼",
    "beam": "빔",
    "column": "컬럼",
    "slab": "슬래브",
    "wall": "월",
    "roof": "루프",
    "foundation": "파운데이션",
    "trench": "트렌치",
    "pile": "파일",
    "footing": "풋팅",
    "bolt": "볼트",
    "nut": "넛",
    "screw": "스크류",
    "nail": "네일",
    "wire": "와이어",
    "cable": "케이블",
    "rope": "로프",
    "pipe": "파이프",
    "valve": "밸브",
    "duct": "덕트",
    "panel": "패널",
    "plate": "플레이트",
    "bar": "바",
    "tool": "툴",
    "machine": "머신",
    "device": "디바이스",
    "excavator": "엑스카베이터",
    "bulldozer": "불도저",
    "forklift": "포크리프트",
    "dump": "덤프",
    "truck": "트럭",
    "mixer": "믹서",
    "pump": "펌프",
    "hoist": "호이스트",
    "winch": "윈치",
    "jack": "잭",
    "drill": "드릴",
    "saw": "소",
    "grinder": "그라인더",
    "cutter": "커터",
    "welder": "웰더",
    "generator": "제너레이터",
    "compressor": "컴프레서",
    "demolition": "데몰리션",
    "asbestos": "아스베스토스",
    "toxic": "톡식",
    "ventilation": "벤틸레이션",
    "dehydration": "디하이드레이션",
    "assembly": "어셈블리",
    "briefing": "브리핑",
    "foreman": "포맨",
    "operator": "오퍼레이터",
    "manager": "매니저",
    "supervisor": "슈퍼바이저",
    "engineer": "엔지니어",
    "signal": "시그널",
    "spotter": "스파터",
    "fire": "파이어",
    "water": "워터",
    "power": "파워",
    "gas": "가스",
    "electric": "일렉트릭",
    "electrical": "일렉트리컬",
    "voltage": "볼티지",
    "current": "커런트",
    "grounding": "그라운딩",
    "circuit": "서킷",
    "breaker": "브레이커",
    "fuse": "퓨즈",
    "insulation": "인슐레이션",
    "insulating": "인슐레이팅",
    "person": "퍼슨",
    "people": "피플",
    "man": "맨",
    "men": "멘",
    "head": "헤드",
    "hand": "핸드",
    "eye": "아이",
    "ear": "이어",
    "body": "바디",
    "back": "백",
    "foot": "풋",
    "feet": "핏",
    "point": "포인트",
    "part": "파트",
    "side": "사이드",
    "top": "톱",
    "bottom": "바텀",
    "front": "프론트",
    "rear": "리어",
    "inside": "인사이드",
    "outside": "아웃사이드",
    "way": "웨이",
    "path": "패스",
    "road": "로드",
    "route": "루트",
    "door": "도어",
    "gate": "게이트",
    "window": "윈도우",
    "room": "룸",
    "office": "오피스",
    "building": "빌딩",
    "location": "로케이션",
    "position": "포지션",
    "direction": "디렉션",
    "condition": "컨디션",
    "situation": "시츄에이션",
    "operation": "오퍼레이션",
    "procedure": "프로시저",
    "regulation": "레귤레이션",
    "number": "넘버",
    "time": "타임",
    "day": "데이",
    "night": "나이트",
    "three": "쓰리",
    "four": "포",
    "five": "파이브",
    "six": "식스",
    "seven": "세븐",
    "eight": "에이트",
    "nine": "나인",
    "ten": "텐",
    "one": "원",
    "two": "투",
    "hundred": "헌드레드",
    "thousand": "사우전드",
    "experience": "익스피리언스",
    "practice": "프랙티스",
    "today": "투데이",
    "tomorrow": "투모로우",
    "morning": "모닝",
    "afternoon": "애프터눈",
    "evening": "이브닝",
    "hour": "아워",
    "minute": "미닛",
    "second": "세컨드",
    "weather": "웨더",
    "rain": "레인",
    "wind": "윈드",
    "snow": "스노우",
    "heat": "히트",
    "dust": "더스트",
    "noise": "노이즈",
    "entry": "엔트리",
    "safe": "세이프",
    "unsafe": "언세이프",
    "heavy": "헤비",
    "light": "라이트",
    "strong": "스트롱",
    "weak": "위크",
    "fast": "패스트",
    "slow": "슬로우",
    "quick": "퀵",
    "wet": "웻",
    "dry": "드라이",
    "sharp": "샤프",
    "dirty": "더티",
    "full": "풀",
    "empty": "엠프티",
    "maximum": "맥시멈",
    "minimum": "미니멈",
    "only": "온리",
    "also": "올소",
    "very": "베리",
    "too": "투",
    "here": "히어",
    "there": "데어",
    "where": "웨어",
    "now": "나우",
    "then": "덴",
    "when": "웬",
    "this": "디스",
    "that": "댓",
    "these": "디즈",
    "those": "도즈",
    "your": "유어",
    "my": "마이",
    "our": "아워",
    "their": "데어",
    "his": "히즈",
    "her": "허",
    "its": "이츠",
    "left": "레프트",
    "right": "라이트",
    "up": "업",
    "down": "다운",
    "away": "어웨이",
    "out": "아웃",
    "off": "오프",
    "before": "비포",
    "after": "애프터",
    "during": "듀링",
    "above": "어보브",
    "below": "빌로우",
    "under": "언더",
    "over": "오버",
    "between": "비트윈",
    "around": "어라운드",
    "near": "니어",
    "without": "위다웃",
    "within": "위딘",
    "always": "올웨이즈",
    "never": "네버",
    "again": "어게인",
    "immediately": "이미디어틀리",
    "carefully": "케어풀리",
    "slowly": "슬로울리",
    "properly": "프라퍼리",
    "directly": "디렉틀리",
    "required": "리콰이어드",
    "prohibited": "프로히비티드",
    "mandatory": "맨데이터리",
    "authorized": "오소라이즈드",
    "restricted": "리스트릭티드",
    "temporary": "템포러리",
    "permanent": "퍼머넌트",
    "welding": "웰딩",
    "drilling": "드릴링",
    "cutting": "커팅",
    "grinding": "그라인딩",
    "pouring": "포링",
    "curing": "큐어링",
    "lifting": "리프팅",
    "rigging": "리깅",
    "hoisting": "호이스팅",
    "erecting": "이렉팅",
    "backfilling": "백필링",
    "excavation": "엑스카베이션",
    "grading": "그레이딩",
    "waterproofing": "워터프루핑",
    "painting": "페인팅",
    "plastering": "플라스터링",
    "plumbing": "플러밍",
    "wiring": "와이어링",
    "year": "이어",
    "years": "이어즈",
    "month": "먼스",
    "months": "먼스",
    "week": "위크",
    "weeks": "위크스",
    "days": "데이즈",
    "hours": "아워즈",
    "minutes": "미닛츠",
    "seconds": "세컨즈",
    "ago": "어고",
    "later": "레이터",
    "since": "신스",
    "until": "언틸",
    "been": "빈",
    "done": "던",
    "gone": "곤",
    "made": "메이드",
    "were": "워",
    "was": "워즈",
    "had": "해드",
    "has": "해즈",
    "have": "해브",
    "each": "이치",
    "every": "에브리",
    "other": "아더",
    "another": "어나더",
    "same": "세임",
    "different": "디퍼런트",
    "next": "넥스트",
    "last": "라스트",
    "own": "오운",
    "such": "서치",
    "than": "댄",
    "just": "저스트",
    "still": "스틸",
    "even": "이븐",
    "most": "모스트",
    "much": "머치",
    "many": "매니",
    "more": "모어",
    "less": "레스",
    "few": "퓨",
    "some": "섬",
    "several": "세버럴",
    "enough": "이너프",
    "able": "에이블",
    "ready": "레디",
    "sure": "슈어",
    "clear": "클리어",
    "free": "프리",
    "line": "라인",
    "type": "타입",
    "form": "폼",
    "size": "사이즈",
    "name": "네임",
    "case": "케이스",
    "thing": "씽",
    "things": "씽즈",
    "ways": "웨이즈",
    "hands": "핸즈",
    "eyes": "아이즈",
    "face": "페이스",
    "life": "라이프",
    "lives": "라이브즈",
    "world": "월드",
    "important": "임포턴트",
    "possible": "파서블",
    "necessary": "네세서리",
    "available": "어베일러블",
    "special": "스페셜",
    "general": "제너럴",
    "public": "퍼블릭",
    "private": "프라이빗",
    "local": "로컬",
    "national": "내셔널",
    "international": "인터내셔널",
    "about": "어바웃",
    "through": "스루",
    "across": "어크로스",
    "along": "얼롱",
    "into": "인투",
    "onto": "온투",
    "upon": "어폰",
    "toward": "투워드",
    "towards": "투워즈",
    "against": "어겐스트",
    "among": "어몽",
    "per": "퍼",
    "because": "비코즈",
    "however": "하우에버",
    "therefore": "데어포",
    "although": "올도",
    "while": "와일",
    "unless": "언레스",
    "whether": "웨더",
    "either": "이더",
    "neither": "니더",
    "both": "보스",
    "already": "올레디",
    "yet": "옛",
    "perhaps": "퍼햅스",
    "quite": "콰이트",
    "rather": "래더",
    "whose": "후즈",
    "whom": "훔",
    "which": "위치",
    "itself": "잇셀프",
    "himself": "힘셀프",
    "herself": "허셀프",
    "themselves": "뎀셀브즈",
    "ourselves": "아워셀브즈",
    "everything": "에브리씽",
    "everyone": "에브리원",
    "something": "섬씽",
    "someone": "섬원",
    "nothing": "나씽",
    "anything": "애니씽",
    "anyone": "애니원",
    "shutdown": "셧다운",
    "shoes": "슈즈",
    "shoe": "슈",
    "radius": "레이디어스",
    "swing": "스윙",
    "rotate": "로테이트",
    "rotating": "로테이팅",
    "reverse": "리버스",
    "reversing": "리버싱",
    "speed": "스피드",
    "limit": "리밋",
    "guide": "가이드",
    "assign": "어사인",
    "conduct": "컨덕트",
    "headcount": "헤드카운트",
    "ambulance": "앰뷸런스",
    "preserve": "프리저브",
    "scene": "씬",
    "confined": "컨파인드",
    "space": "스페이스",
    "oxygen": "옥시젠",
    "measure": "메져",
    "ventilate": "벤틸레이트",
    "chemical": "케미컬",
    "detector": "디텍터",
    "combustible": "컴버스터블",
    "flammable": "플래머블",
    "ignition": "이그니션",
    "source": "소스",
    "frostbite": "프로스트바이트",
    "heatstroke": "히트스트로크",
    "lightning": "라이트닝",
    "earthquake": "어스퀘이크",
    "mudslide": "머드슬라이드",
    "flood": "플러드",
    "icy": "아이시",
    "slippery": "슬리퍼리",
    "hydrated": "하이드레이티드",
    "stretch": "스트레치",
    "uniform": "유니폼",
    "wash": "워시",
    "break": "브레이크",
    "breaks": "브레이크스",
    "rest": "레스트",
    "drink": "드링크",
    "plenty": "플렌티",
    "illness": "일니스",
    "symptom": "심프텀",
    "symptoms": "심프텀즈",
    "securing": "시큐어링",
    "collision": "콜리전",
    "anti-collision": "안티콜리전",
    "pedestrian": "페데스트리안",
    "walkway": "워크웨이",
    "marking": "마킹",
}

function genericHangulize(text: string): string {
    const words = text.toLowerCase().split(/\s+/);
    const result = words.map(word => {
        // 구두점 분리
        const punctMatch = word.match(/^([^a-z]*)([a-z'-]+)([^a-z]*)$/);
        const prefix = punctMatch?.[1] || '';
        const core = punctMatch?.[2] || word;
        const suffix = punctMatch?.[3] || '';

        // 1. 정확한 단어 매핑
        if (commonWords[core]) return prefix + commonWords[core] + suffix;

        // 2. 복합어: 접미사 -ing, -ed, -s, -er, -ly 분리 시도
        const suffixes = [
            ['ing', '잉'], ['ting', '팅'], ['ding', '딩'], ['ning', '닝'],
            ['ed', '드'], ['ted', '티드'], ['ded', '디드'],
            ['ly', '리'], ['ily', '일리'],
            ['er', '어'], ['or', '어'], ['ers', '어즈'],
            ['ness', '니스'], ['ment', '먼트'], ['tion', '션'], ['sion', '전'],
            ['able', '에이블'], ['ible', '이블'],
            ['ful', '풀'], ['less', '리스'],
            ['ous', '어스'], ['ive', '이브'],
            ['al', '올'], ['ial', '이얼'],
            ['es', '즈'], ['s', '스'],
        ];
        for (const [sfx, sfxKr] of suffixes) {
            if (core.length > sfx.length + 2 && core.endsWith(sfx)) {
                const stem = core.slice(0, core.length - sfx.length);
                if (commonWords[stem]) return prefix + commonWords[stem] + sfxKr + suffix;
                // 자음 중복 제거 (running → run + ning)
                if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
                    const dedupStem = stem.slice(0, -1);
                    if (commonWords[dedupStem]) return prefix + commonWords[dedupStem] + sfxKr + suffix;
                }
                // e 복원 (making → make)
                if (commonWords[stem + 'e']) return prefix + commonWords[stem + 'e'] + sfxKr + suffix;
            }
        }

        // 3. 사전에 없는 단어 → 영어 원문 유지 (깨진 한글보다 나음)
        return prefix + core + suffix;
    });

    return result.join(' ');
}
