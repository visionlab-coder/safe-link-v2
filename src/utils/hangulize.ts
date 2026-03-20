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

export function hangulize(text: string, lang: string): string {
    if (!text) return "";
    let normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/u:/g, "v").replace(/ü/g, "v");

    if (lang === 'zh') return hangulizePinyin(normalized);
    if (lang === 'vi') {
        // 베트남어 특수 문자 처리: đ → d
        normalized = normalized.replace(/đ/g, "d");
        return hangulizeVietnamese(normalized);
    }
    return genericHangulize(normalized);
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

// 자주 쓰는 영어 단어 직접 매핑 (정확한 발음)
const commonWords: Record<string, string> = {
    "hello": "헬로", "hi": "하이", "yes": "예스", "no": "노",
    "ok": "오케이", "okay": "오케이", "please": "플리즈", "thank": "땡크", "thanks": "땡스",
    "sorry": "쏘리", "good": "굿", "bad": "배드", "the": "더",
    "safety": "세이프티", "helmet": "헬멧", "danger": "데인저", "warning": "워닝",
    "caution": "코션", "stop": "스톱", "go": "고", "come": "컴",
    "work": "워크", "worker": "워커", "site": "사이트", "area": "에어리어",
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
    "not": "낫", "don't": "돈트", "can't": "캔트", "do": "두",
};

function genericHangulize(text: string): string {
    // 1단계: 단어 단위로 분리하여 사전 매핑
    const words = text.toLowerCase().split(/\s+/);
    const result = words.map(word => {
        // 정확한 단어 매핑이 있으면 사용
        if (commonWords[word]) return commonWords[word];

        // 복합어 처리: 접미사 분리 시도
        for (const [suffix, suffixKr] of Object.entries(commonWords)) {
            if (word.endsWith(suffix) && word.length > suffix.length) {
                const prefix = word.slice(0, word.length - suffix.length);
                if (commonWords[prefix]) return commonWords[prefix] + suffixKr;
            }
        }

        // 2단계: 패턴 기반 변환
        let converted = word;
        for (const [pattern, replacement] of engPatterns) {
            converted = converted.replace(pattern, replacement);
        }

        // 3단계: 자음 클러스터 정리 (연속 자음 사이에 으 삽입)
        converted = converted.replace(/([ㅎ])/g, '');  // 독립 ㅎ 제거
        converted = converted.replace(/ㅇ/g, 'ㅇ');  // 받침 ㅇ 유지

        return converted;
    });

    return result.join(' ');
}
