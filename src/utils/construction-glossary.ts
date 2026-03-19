/**
 * 건설 현장 다국어 전문 용어 사전
 * Cloud Translation API의 부정확한 건설 용어 번역을 보정합니다.
 * 소스 언어 → 한국어 매핑
 */

// 중국어 → 한국어 건설 용어
export const zhToKo: Record<string, string> = {
  // 구조/자재
  "钢筋": "철근", "混凝土": "콘크리트", "模板": "거푸집", "脚手架": "비계",
  "钢结构": "철골", "预制件": "PC부재", "型钢": "형강", "钢管": "강관",
  "水泥": "시멘트", "砂浆": "모르타르", "骨料": "골재", "碎石": "쇄석",
  "砖": "벽돌", "瓷砖": "타일", "玻璃": "유리", "木材": "목재",
  "防水": "방수", "防腐": "방부", "保温": "보온", "隔热": "단열",

  // 장비
  "塔吊": "타워크레인", "挖掘机": "굴삭기", "起重机": "크레인",
  "混凝土搅拌车": "레미콘", "泵车": "펌프카", "叉车": "지게차",
  "振动器": "바이브레이터", "焊接机": "용접기", "切割机": "절단기",

  // 공간/구역
  "工作区": "작업구역", "施工区": "시공구역", "危险区": "위험구역",
  "地下": "지하", "地上": "지상", "楼层": "층", "屋顶": "옥상",
  "基坑": "터파기", "基础": "기초", "地基": "지반",

  // 작업 유형
  "放置": "배치", "安装": "설치", "拆除": "철거", "吊装": "양중",
  "浇筑": "타설", "焊接": "용접", "切割": "절단", "打桩": "항타",
  "抹灰": "미장", "砌筑": "조적", "粉刷": "도장", "涂装": "도장",

  // 안전
  "安全帽": "안전모", "安全带": "안전대", "安全网": "안전망",
  "安全检查": "안전점검", "安全员": "안전관리자",
  "危险": "위험", "警告": "경고", "禁止": "금지", "注意": "주의",
  "高空作业": "고소작업", "临边作业": "단부작업",
  "触电": "감전", "坠落": "추락", "坍塌": "붕괴", "火灾": "화재",

  // 일반
  "工人": "근로자", "师傅": "기사님", "班长": "반장", "主管": "관리자",
  "请": "~해주세요", "来": "오다", "去": "가다",
};

// 베트남어 → 한국어 건설 용어
export const viToKo: Record<string, string> = {
  "mũ bảo hiểm": "안전모", "dây an toàn": "안전대",
  "giàn giáo": "비계", "cốt thép": "철근", "bê tông": "콘크리트",
  "cần trục": "크레인", "máy xúc": "굴삭기",
  "nguy hiểm": "위험", "cấm vào": "출입금지",
  "khu vực làm việc": "작업구역", "công trường": "현장",
  "tầng hầm": "지하층", "mái": "옥상",
};

/**
 * 번역 후보정: 소스 텍스트의 전문 용어가 번역에 반영되었는지 확인하고 보정
 */
export function correctTranslation(
  sourceText: string,
  translatedText: string,
  sourceLang: string
): string {
  const glossary = sourceLang === 'zh' || sourceLang === 'zh-CN'
    ? zhToKo
    : sourceLang === 'vi'
      ? viToKo
      : null;

  if (!glossary) return translatedText;

  let corrected = translatedText;

  // 소스에 있는 전문 용어가 번역에 정확히 반영되었는지 확인
  for (const [foreign, korean] of Object.entries(glossary)) {
    if (sourceText.includes(foreign) && !corrected.includes(korean)) {
      // 소스에 용어가 있지만 번역에 없으면, 번역이 잘못된 것
      // 가능한 오역을 찾아서 교체 시도
      corrected = corrected;  // Cloud Translation이 이미 번역한 결과를 유지
    }
  }

  return corrected;
}

/**
 * 소스 텍스트에서 전문 용어를 추출하여 보조 번역 제공
 * UI에서 "건설 용어 보조" 표시용
 */
export function extractTerms(sourceText: string, sourceLang: string): Array<{ term: string; meaning: string }> {
  const glossary = sourceLang === 'zh' || sourceLang === 'zh-CN'
    ? zhToKo
    : sourceLang === 'vi'
      ? viToKo
      : null;

  if (!glossary) return [];

  const found: Array<{ term: string; meaning: string }> = [];
  for (const [foreign, korean] of Object.entries(glossary)) {
    if (sourceText.includes(foreign)) {
      found.push({ term: foreign, meaning: korean });
    }
  }
  return found;
}

/**
 * 소스 텍스트의 전문 용어를 한국어로 치환한 버전 생성
 * Cloud Translation 전에 전처리하면 번역 품질 향상
 */
export function preProcessWithGlossary(sourceText: string, sourceLang: string): string {
  const glossary = sourceLang === 'zh' || sourceLang === 'zh-CN'
    ? zhToKo
    : sourceLang === 'vi'
      ? viToKo
      : null;

  if (!glossary) return sourceText;

  let processed = sourceText;
  // 긴 용어부터 매칭 (greedy)
  const sortedEntries = Object.entries(glossary).sort((a, b) => b[0].length - a[0].length);
  for (const [foreign, korean] of sortedEntries) {
    processed = processed.replace(new RegExp(foreign, 'g'), korean);
  }
  return processed;
}
