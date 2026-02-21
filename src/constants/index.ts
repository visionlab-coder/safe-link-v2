// 한국어 관리자 최우선, 이후 국내 외국인 근로자 많은 순서 기준 정렬 (2024년 통계)
export const languages = [
    { code: "ko", name: "한국어", iso: "kr" }, // 관리자용 (최우선)
    { code: "vi", name: "Tiếng Việt", iso: "vn" }, // 1위 베트남
    { code: "zh", name: "中文", iso: "cn" }, // 2위 중국
    { code: "th", name: "ไทย", iso: "th" }, // 3위 태국
    { code: "uz", name: "O'zbek", iso: "uz" }, // 4위 우즈베키스탄
    { code: "ph", name: "Tagalog", iso: "ph" }, // 5위 필리핀
    { code: "km", name: "ខ្មែរ", iso: "kh" }, // 6위 캄보디아
    { code: "id", name: "Indonesia", iso: "id" }, // 7위 인도네시아
    { code: "mn", name: "Монгол", iso: "mn" }, // 8위 몽골
    { code: "my", name: "မြန်မာ", iso: "mm" }, // 9위 미얀마
    { code: "ne", name: "नेपाली", iso: "np" }, // 10위 네팔
    { code: "bn", name: "বাংলা", iso: "bd" }, // 11위 방글라데시
    { code: "kk", name: "Қазақша", iso: "kz" }, // 12위 카자흐스탄
    { code: "ru", name: "Русский", iso: "ru" }, // 13위 러시아
    { code: "en", name: "English", iso: "us" }, // 14위 영어권
    { code: "jp", name: "日本語", iso: "jp" }, // 일본
    { code: "fr", name: "Français", iso: "fr" }, // 프랑스
    { code: "es", name: "Español", iso: "es" }, // 스페인
    { code: "ar", name: "العربية", iso: "sa" }, // 아랍어
    { code: "hi", name: "हिन्दी", iso: "in" }, // 힌디
];

export const sites = [
    { id: "SITE-001", name: "강남 G-Tower 신축현장" },
    { id: "SITE-002", name: "판교 R&D 센터" },
    { id: "SITE-003", name: "송도 주상복합 2단지" },
];
