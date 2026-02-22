/**
 * Hangulize: Converts Romanized text (Pinyin, etc.) into Korean phonetic scripts (Hangul).
 * Specialized for Chinese Pinyin but includes generic support for others.
 */

const pinyinMap: Record<string, string> = {
    "ba": "바", "bo": "보", "bi": "비", "bu": "부", "bai": "바이", "bei": "베이", "bao": "바오", "bou": "보우", "ban": "빤", "ben": "뻔", "bin": "삔", "bang": "빵", "beng": "뻥", "bing": "삥",
    "pa": "파", "po": "포", "pi": "피", "pu": "푸", "pai": "파이", "pei": "페이", "pao": "파오", "pou": "포우", "pan": "판", "pen": "펀", "pin": "핀", "pang": "팡", "peng": "펑", "ping": "핑",
    "ma": "마", "mo": "모", "me": "머", "mi": "미", "mu": "무", "mai": "마이", "mei": "메이", "mao": "마오", "mou": "모우", "miu": "미우", "mie": "미에", "man": "만", "men": "먼", "min": "민", "mang": "망", "meng": "멍", "ming": "밍",
    "fa": "파", "fo": "포", "fu": "푸", "fan": "판", "fen": "펀", "fang": "팡", "feng": "펑",
    "da": "다", "de": "더", "di": "디", "du": "두", "dai": "다이", "dei": "데이", "dao": "다오", "dou": "도우", "diu": "디우", "die": "디에", "dan": "딴", "den": "떤", "dang": "땅", "deng": "떵", "dong": "똥",
    "ta": "타", "te": "터", "ti": "티", "tu": "투", "tai": "타이", "tao": "타오", "tou": "토우", "tie": "티에", "tan": "탄", "tang": "탕", "teng": "텅", "tong": "통",
    "na": "나", "ne": "너", "ni": "니", "nu": "누", "nv": "뉘", "nai": "나이", "nei": "네이", "nao": "나오", "nou": "노우", "nie": "니에", "nve": "뉘에", "nan": "난", "nen": "넌", "nin": "닌", "nang": "낭", "neng": "넝", "ning": "닝", "nong": "농",
    "la": "라", "le": "러", "li": "리", "lu": "루", "lv": "뤼", "lai": "라이", "lei": "레이", "lao": "라오", "lou": "로우", "lie": "리에", "lve": "뤼에", "lan": "란", "lin": "린", "lang": "랑", "leng": "렁", "ling": "링", "long": "롱",
    "ga": "가", "ge": "거", "gu": "구", "gai": "가이", "gei": "게이", "gao": "가오", "gou": "고우", "gan": "깐", "gen": "껀", "gang": "깡", "geng": "껑", "gong": "꽁",
    "ka": "카", "ke": "커", "ku": "쿠", "kai": "카이", "kao": "카오", "kou": "코우", "kan": "칸", "ken": "컨", "kang": "캉", "keng": "컹", "kong": "콩",
    "ha": "하", "he": "허", "hu": "후", "hai": "하이", "hei": "헤이", "hao": "하오", "hou": "호우", "han": "한", "hen": "헌", "hang": "항", "heng": "헝", "hong": "홍",
    "ji": "지", "ju": "쥐", "jia": "지아", "jie": "지에", "jue": "쥐에", "jiao": "지아오", "jiu": "지우", "jian": "지엔", "jin": "진", "jun": "쥔", "jiang": "지앙", "jing": "징", "jiong": "지옹",
    "qi": "치", "qu": "취", "qia": "치아", "qie": "치에", "que": "취에", "qiao": "치아오", "qiu": "치우", "qian": "치엔", "qin": "친", "qun": "췬", "qiang": "치앙", "qing": "칭", "qiong": "치옹",
    "xi": "시", "xu": "쉬", "xia": "시아", "xie": "시에", "xue": "쉬에", "xiao": "시아오", "xiu": "시우", "xian": "시엔", "xin": "신", "xun": "쉰", "xiang": "시앙", "xing": "싱", "xiong": "시옹",
    "zhi": "즈", "zhe": "저", "zhu": "주", "zha": "자", "zhai": "자이", "zhei": "제이", "zhao": "자오", "zhou": "조우", "zhua": "주아", "zhui": "주이", "zhuan": "주안", "zhun": "준", "zhang": "장", "zheng": "정", "zhong": "종",
    "chi": "츠", "che": "처", "chu": "추", "cha": "차", "chai": "차이", "chao": "차오", "chou": "초우", "chua": "추아", "chui": "추이", "chuan": "추안", "chun": "춘", "chang": "창", "cheng": "청", "chong": "층",
    "shi": "스", "she": "셔", "shu": "슈", "sha": "사", "shai": "사이", "shao": "사오", "shou": "쇼우", "shua": "슈아", "shui": "슈이", "shuan": "슈안", "shun": "슌", "shang": "상", "sheng": "성", "shong": "숑",
    "ri": "르", "re": "러", "ru": "루", "rua": "루아", "rui": "루이", "ruan": "루안", "run": "룬", "rang": "랑", "reng": "렁", "rong": "롱",
    "zi": "즈", "ze": "저", "zu": "주", "za": "자", "zai": "자이", "zao": "자오", "zou": "조우", "zui": "주이", "zuan": "주안", "zun": "준", "zang": "장", "zeng": "정", "zong": "종",
    "ci": "츠", "ce": "처", "cu": "추", "ca": "차", "cai": "차이", "cao": "차오", "cou": "초우", "cui": "추이", "cuan": "추안", "cun": "춘", "cang": "창", "ceng": "청", "cong": "층",
    "si": "스", "se": "셔", "su": "슈", "sa": "사", "sai": "사이", "sao": "사오", "sou": "소우", "sui": "수이", "suan": "수안", "sun": "순", "sang": "상", "seng": "성", "song": "송",
    "yi": "이", "ya": "야", "ye": "예", "yao": "야오", "you": "요우", "yan": "이엔", "yin": "인", "yang": "양", "ying": "잉", "yu": "위", "yue": "위에", "yuan": "위엔", "yun": "윈", "yong": "용",
    "wu": "우", "wa": "와", "wo": "워", "wai": "와이", "wei": "웨이", "wan": "완", "wen": "원", "wang": "왕", "weng": "옹",
};

export function hangulize(text: string, lang: string): string {
    if (!text) return "";
    let normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/u:/g, "v");

    if (lang === 'zh') return hangulizePinyin(normalized);
    return genericHangulize(normalized);
}

function hangulizePinyin(pinyin: string): string {
    return pinyin.split(/\s+/).map(word => {
        let remaining = word;
        let res = "";
        while (remaining.length > 0) {
            let found = false;
            for (let i = 6; i >= 1; i--) {
                const sub = remaining.substring(0, i);
                if (pinyinMap[sub]) {
                    res += pinyinMap[sub];
                    remaining = remaining.substring(i);
                    found = true;
                    break;
                }
            }
            if (!found) {
                res += remaining[0];
                remaining = remaining.substring(1);
            }
        }
        return res;
    }).join(" ");
}

function genericHangulize(text: string): string {
    const vMap: Record<string, string> = { 'a': '아', 'e': '에', 'i': '이', 'o': '오', 'u': '우' };
    return text.split('').map(c => vMap[c] || c).join('');
}
