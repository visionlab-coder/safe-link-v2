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
    "da": "다", "dai": "다이", "dan": "딴", "dang": "땅", "dao": "다오", "de": "더", "dei": "데이", "den": "떤", "deng": "떵", "di": "디", "dia": "디아", "dian": "디엔", "diao": "디아오", "die": "디에", "ding": "딩", "diu": "디우", "dong": "똥", "dou": "도우", "du": "두", "duan": "돤", "dui": "두이", "dun": "둔", "duo": "두오",
    "e": "어", "ei": "에이", "en": "언", "eng": "엉", "er": "얼",
    "fa": "파", "fan": "판", "fang": "팡", "fei": "페이", "fen": "펀", "feng": "펑", "fo": "포", "fou": "포우", "fu": "푸",
    "ga": "가", "gai": "가이", "gan": "깐", "gang": "깡", "gao": "가오", "ge": "거", "gei": "게이", "gen": "껀", "geng": "껑", "gong": "꽁", "gou": "고우", "gu": "구", "gua": "구아", "guai": "구아이", "guan": "관", "guang": "구앙", "gui": "구이", "gun": "군", "guo": "궈",
    "ha": "하", "hai": "하이", "han": "한", "hang": "항", "hao": "하오", "he": "허", "hei": "헤이", "hen": "헌", "heng": "헝", "hong": "홍", "hou": "호우", "hu": "후", "hua": "후아", "huai": "후아이", "huan": "환", "huang": "후앙", "hui": "후이", "hun": "훈", "huo": "훠",
    "ji": "지", "jia": "지아", "jian": "지엔", "jiang": "지앙", "jiao": "지아오", "jie": "지에", "jin": "진", "jing": "징", "jiong": "지옹", "jiu": "지우", "ju": "쥐", "juan": "쥐엔", "jue": "쥐에", "jun": "쥔",
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
    "xi": "시", "xia": "시아", "xian": "시엔", "xiang": "시앙", "xiao": "시아오", "xie": "시에", "xin": "신", "xing": "싱", "xiong": "시옹", "xiu": "시우", "xu": "쉬", "xuan": "쉬엔", "xue": "쉬에", "xun": "쉰",
    "ya": "야", "yan": "이엔", "yang": "양", "yao": "야오", "ye": "예", "yi": "이", "yin": "인", "ying": "잉", "yo": "요", "yong": "용", "you": "요우", "yu": "위", "yuan": "위엔", "yue": "위에", "yun": "윈",
    "za": "자", "zai": "자이", "zan": "잔", "zang": "장", "zao": "자오", "ze": "저", "zei": "제이", "zen": "전", "zeng": "정", "zha": "자", "zhai": "자이", "zhan": "잔", "zhang": "장", "zhao": "자오", "zhe": "저", "zhei": "제이", "zhen": "전", "zheng": "정", "zhi": "즈", "zhong": "종", "zhou": "조우", "zhu": "주", "zhua": "주아", "zhuai": "주아이", "zhuan": "주안", "zhuang": "주앙", "zhui": "주이", "zhun": "준", "zhuo": "주오", "zi": "즈", "zong": "종", "zou": "조우", "zu": "주", "zuan": "주안", "zui": "주이", "zun": "준", "zuo": "주오"
};

const vMap: Record<string, string> = {
    'a': '아', 'b': '브', 'c': '츠', 'd': '드', 'e': '에', 'f': '프', 'g': '그', 'h': '흐', 'i': '이', 'j': '즈', 'k': '크', 'l': '르', 'm': '므', 'n': '느', 'o': '오', 'p': '프', 'q': '크', 'r': '르', 's': '스', 't': '트', 'u': '우', 'v': '브', 'w': '으', 'x': '스', 'y': '이', 'z': '즈'
};

const batchimCandidates: Record<string, string> = { 'n': 'ㄴ', 'g': 'ㅇ', 'l': 'ㄹ', 'm': 'ㅁ', 'p': 'ㅂ', 't': 'ㅅ', 'k': 'ㄱ' };

export function hangulize(text: string, lang: string): string {
    if (!text) return "";
    let normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/u:/g, "v").replace(/ü/g, "v");

    if (lang === 'zh') return hangulizePinyin(normalized);
    return genericHangulize(normalized);
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

function genericHangulize(text: string): string {
    return text.split('').map(c => vMap[c] || c).join('');
}
