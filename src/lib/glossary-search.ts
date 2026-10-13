type SearchableTerm = { slang: string; standard: string; category: string };

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim();
}

// Search is display-only: it never edits glossary rules or the exported dataset.
export function filterGlossaryTerms<T extends SearchableTerm>(terms: T[], query: string): T[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return terms;
  return terms.filter(term => {
    const text = normalizeSearch(`${term.slang} ${term.standard} ${term.category}`);
    return words.every(word => text.includes(word));
  });
}

const labels: Record<string, [string, string, string]> = {
  ko: ["현장용어·표준어·카테고리 검색", "검색어 지우기", "검색 결과가 없습니다."],
  en: ["Search site terms, standard terms or categories", "Clear search", "No matching terms."],
  tl: ["Maghanap ng termino sa site, pamantayang termino o kategorya", "Burahin ang paghahanap", "Walang tumutugmang termino."],
  ar: ["ابحث عن مصطلحات الموقع أو المصطلحات القياسية أو الفئات", "مسح البحث", "لا توجد مصطلحات مطابقة."],
  zh: ["搜索现场用语、标准术语或分类", "清除搜索", "没有匹配的术语。"],
  vi: ["Tìm thuật ngữ công trường, từ chuẩn hoặc danh mục", "Xóa tìm kiếm", "Không tìm thấy thuật ngữ phù hợp."],
  ru: ["Поиск терминов, стандартных названий или категорий", "Очистить поиск", "Совпадений не найдено."],
  th: ["ค้นหาศัพท์หน้างาน ศัพท์มาตรฐาน หรือหมวดหมู่", "ล้างการค้นหา", "ไม่พบคำที่ตรงกัน"],
  id: ["Cari istilah lapangan, istilah baku atau kategori", "Hapus pencarian", "Tidak ada istilah yang cocok."],
  km: ["ស្វែងរកពាក្យនៅការដ្ឋាន ពាក្យស្តង់ដារ ឬប្រភេទ", "លុបពាក្យស្វែងរក", "រកមិនឃើញពាក្យដែលត្រូវគ្នា។"],
  uz: ["Qurilish atamalari, standart atamalar yoki toifalarni qidirish", "Qidiruvni tozalash", "Mos atamalar topilmadi."],
  mn: ["Талбайн нэр томьёо, стандарт нэр эсвэл ангилал хайх", "Хайлтыг цэвэрлэх", "Тохирох нэр томьёо олдсонгүй."],
  my: ["လုပ်ငန်းခွင်ဝေါဟာရ၊ စံဝေါဟာရ သို့မဟုတ် အမျိုးအစား ရှာဖွေရန်", "ရှာဖွေမှုကို ရှင်းရန်", "ကိုက်ညီသော ဝေါဟာရ မတွေ့ပါ။"],
  ne: ["कार्यस्थलका शब्द, मानक शब्द वा श्रेणी खोज्नुहोस्", "खोज खाली गर्नुहोस्", "मिल्ने शब्द भेटिएन।"],
  kk: ["Құрылыс терминдерін, стандартты атауларды немесе санаттарды іздеу", "Іздеуді тазалау", "Сәйкес терминдер табылмады."],
  ja: ["現場用語・標準用語・カテゴリを検索", "検索をクリア", "一致する用語がありません。"],
  hi: ["कार्यस्थल के शब्द, मानक शब्द या श्रेणियाँ खोजें", "खोज साफ़ करें", "कोई मेल खाने वाला शब्द नहीं मिला।"],
  bn: ["কর্মস্থলের শব্দ, প্রমিত শব্দ বা বিভাগ খুঁজুন", "অনুসন্ধান মুছুন", "কোনো মিলে যাওয়া শব্দ নেই।"],
  ur: ["کام کی جگہ کی اصطلاحات، معیاری اصطلاحات یا زمرے تلاش کریں", "تلاش صاف کریں", "کوئی مماثل اصطلاح نہیں ملی۔"],
  tr: ["Saha terimi, standart terim veya kategori ara", "Aramayı temizle", "Eşleşen terim bulunamadı."],
  es: ["Buscar términos de obra, términos estándar o categorías", "Borrar búsqueda", "No hay términos coincidentes."],
  fr: ["Rechercher un terme de chantier, standard ou une catégorie", "Effacer la recherche", "Aucun terme correspondant."],
};

export function glossarySearchUI(language: string) {
  const [placeholder, clear, empty] = labels[language === "jp" ? "ja" : language] ?? labels.en;
  return { placeholder, clear, empty };
}
