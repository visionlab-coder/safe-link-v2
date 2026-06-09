// 한국어 관리자 최우선, 이후 국내 외국인 근로자 많은 순서 기준 정렬 (2024년 통계)
// koreanName: 한국 관리자/팀장이 어느 나라 언어인지 한눈에 인지할 수 있도록 한국어 병행 표기
export const languages = [
    { code: "ko", name: "한국어", koreanName: "한국어",  iso: "kr" }, // 관리자용 (최우선)
    { code: "vi", name: "Tiếng Việt", koreanName: "베트남어", iso: "vn" }, // 1위 베트남
    { code: "zh", name: "中文", koreanName: "중국어", iso: "cn" }, // 2위 중국
    { code: "th", name: "ไทย", koreanName: "태국어", iso: "th" }, // 3위 태국
    { code: "uz", name: "O'zbek", koreanName: "우즈벡어", iso: "uz" }, // 4위 우즈베키스탄
    { code: "ph", name: "Tagalog", koreanName: "필리핀어", iso: "ph" }, // 5위 필리핀
    { code: "km", name: "ខ្មែរ", koreanName: "캄보디아어", iso: "kh" }, // 6위 캄보디아
    { code: "id", name: "Indonesia", koreanName: "인도네시아어", iso: "id" }, // 7위 인도네시아
    { code: "mn", name: "Монгол", koreanName: "몽골어", iso: "mn" }, // 8위 몽골
    { code: "my", name: "မြန်မာ", koreanName: "미얀마어", iso: "mm" }, // 9위 미얀마
    { code: "ne", name: "नेपाली", koreanName: "네팔어", iso: "np" }, // 10위 네팔
    { code: "bn", name: "বাংলা", koreanName: "방글라데시어", iso: "bd" }, // 11위 방글라데시
    { code: "kk", name: "Қазақша", koreanName: "카자흐어", iso: "kz" }, // 12위 카자흐스탄
    { code: "ru", name: "Русский", koreanName: "러시아어", iso: "ru" }, // 13위 러시아
    { code: "en", name: "English", koreanName: "영어", iso: "us" }, // 14위 영어권
    { code: "jp", name: "日本語", koreanName: "일본어", iso: "jp" }, // 일본
    { code: "fr", name: "Français", koreanName: "프랑스어", iso: "fr" }, // 프랑스
    { code: "es", name: "Español", koreanName: "스페인어", iso: "es" }, // 스페인
    { code: "ar", name: "العربية", koreanName: "아랍어", iso: "sa" }, // 아랍어
    { code: "hi", name: "हिन्दी", koreanName: "힌디어", iso: "in" }, // 힌디
];

export const sites = [
    { id: "SITE-001", name: "강남 G-Tower 신축현장" },
    { id: "SITE-002", name: "판교 R&D 센터" },
    { id: "SITE-003", name: "송도 주상복합 2단지" },
];
