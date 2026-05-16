export type QrLanguageCode =
  | "ko"
  | "vi"
  | "zh"
  | "th"
  | "uz"
  | "ph"
  | "km"
  | "id"
  | "mn"
  | "my"
  | "ne"
  | "bn"
  | "kk"
  | "ru"
  | "en"
  | "jp"
  | "fr"
  | "es"
  | "ar"
  | "hi";

export type QrLanguageOption = {
  lang: QrLanguageCode;
  country: string;
  iso: string;
  name: string;
  nativeName: string;
};

export type QrEntryText = {
  loading: string;
  qrLoading: string;
  siteLoading: string;
  siteQrLabel: string;
  workerQrLabel: string;
  quickEntryTitle: string;
  chooseLanguageTitle: string;
  selectedLanguage: string;
  siteLabel: string;
  siteFallback: string;
  initialsLabel: string;
  initialsPlaceholder: string;
  phoneLast4Label: string;
  enterWorker: string;
  entering: string;
  errorTitle: string;
  blockedTitle: string;
  blockedBody: string;
  workerFallbackName: string;
};

export const QR_LANGUAGE_OPTIONS: QrLanguageOption[] = [
  { lang: "ko", country: "KR", iso: "kr", name: "Korean", nativeName: "한국어" },
  { lang: "vi", country: "VN", iso: "vn", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { lang: "zh", country: "CN", iso: "cn", name: "Chinese", nativeName: "中文" },
  { lang: "th", country: "TH", iso: "th", name: "Thai", nativeName: "ไทย" },
  { lang: "uz", country: "UZ", iso: "uz", name: "Uzbek", nativeName: "O'zbek" },
  { lang: "ph", country: "PH", iso: "ph", name: "Filipino", nativeName: "Filipino" },
  { lang: "km", country: "KH", iso: "kh", name: "Khmer", nativeName: "ខ្មែរ" },
  { lang: "id", country: "ID", iso: "id", name: "Indonesian", nativeName: "Indonesia" },
  { lang: "mn", country: "MN", iso: "mn", name: "Mongolian", nativeName: "Монгол" },
  { lang: "my", country: "MM", iso: "mm", name: "Myanmar", nativeName: "မြန်မာ" },
  { lang: "ne", country: "NP", iso: "np", name: "Nepali", nativeName: "नेपाली" },
  { lang: "bn", country: "BD", iso: "bd", name: "Bengali", nativeName: "বাংলা" },
  { lang: "kk", country: "KZ", iso: "kz", name: "Kazakh", nativeName: "Қазақ" },
  { lang: "ru", country: "RU", iso: "ru", name: "Russian", nativeName: "Русский" },
  { lang: "en", country: "US", iso: "us", name: "English", nativeName: "English" },
  { lang: "jp", country: "JP", iso: "jp", name: "Japanese", nativeName: "日本語" },
  { lang: "fr", country: "FR", iso: "fr", name: "French", nativeName: "Français" },
  { lang: "es", country: "ES", iso: "es", name: "Spanish", nativeName: "Español" },
  { lang: "ar", country: "SA", iso: "sa", name: "Arabic", nativeName: "العربية" },
  { lang: "hi", country: "IN", iso: "in", name: "Hindi", nativeName: "हिन्दी" },
];

const EN_TEXT: QrEntryText = {
  loading: "Loading.",
  qrLoading: "Checking the QR code.",
  siteLoading: "Checking the worksite.",
  siteQrLabel: "SAFE-LINK Site QR",
  workerQrLabel: "SAFE-LINK Worker QR",
  quickEntryTitle: "Quick entry",
  chooseLanguageTitle: "Choose language",
  selectedLanguage: "Selected language",
  siteLabel: "Worksite",
  siteFallback: "SAFE-LINK worksite",
  initialsLabel: "Name initials",
  initialsPlaceholder: "e.g. KMB",
  phoneLast4Label: "Last 4 digits of phone",
  enterWorker: "Open worker screen",
  entering: "Processing entry",
  errorTitle: "Entry failed",
  blockedTitle: "Work ended for today",
  blockedBody: "SAFE-LINK access is disabled until the next TBM check-in.",
  workerFallbackName: "Worker",
};

export const QR_ENTRY_TEXT: Record<QrLanguageCode, QrEntryText> = {
  ko: {
    loading: "불러오는 중입니다.",
    qrLoading: "QR 정보를 확인하고 있습니다.",
    siteLoading: "현장 정보를 확인하고 있습니다.",
    siteQrLabel: "SAFE-LINK 현장 QR",
    workerQrLabel: "SAFE-LINK 근로자 QR",
    quickEntryTitle: "간편입장",
    chooseLanguageTitle: "언어를 선택하세요",
    selectedLanguage: "선택된 언어",
    siteLabel: "근무 현장",
    siteFallback: "SAFE-LINK 현장",
    initialsLabel: "이름 이니셜",
    initialsPlaceholder: "예: KMB",
    phoneLast4Label: "휴대전화 뒤 4자리",
    enterWorker: "근로자 화면으로 이동",
    entering: "입장 처리 중",
    errorTitle: "입장 실패",
    blockedTitle: "오늘 근무가 종료되었습니다",
    blockedBody: "다음 TBM 출근 태깅 전까지 SAFE-LINK 사용이 중지됩니다.",
    workerFallbackName: "근로자",
  },
  vi: {
    ...EN_TEXT,
    quickEntryTitle: "Vào nhanh",
    chooseLanguageTitle: "Chọn ngôn ngữ",
    selectedLanguage: "Ngôn ngữ đã chọn",
    siteLabel: "Công trường",
    initialsLabel: "Chữ cái đầu tên",
    phoneLast4Label: "4 số cuối điện thoại",
    enterWorker: "Mở màn hình công nhân",
    entering: "Đang xử lý",
    errorTitle: "Không vào được",
    blockedTitle: "Ca làm hôm nay đã kết thúc",
    blockedBody: "SAFE-LINK bị tắt cho đến lần điểm danh TBM tiếp theo.",
  },
  zh: {
    ...EN_TEXT,
    quickEntryTitle: "快速进入",
    chooseLanguageTitle: "请选择语言",
    selectedLanguage: "已选语言",
    siteLabel: "施工现场",
    initialsLabel: "姓名首字母",
    phoneLast4Label: "手机号后4位",
    enterWorker: "进入工人页面",
    entering: "正在处理",
    errorTitle: "进入失败",
    blockedTitle: "今天工作已结束",
    blockedBody: "在下次 TBM 签到前，SAFE-LINK 将停止使用。",
  },
  th: {
    ...EN_TEXT,
    quickEntryTitle: "เข้าใช้งานด่วน",
    chooseLanguageTitle: "เลือกภาษา",
    selectedLanguage: "ภาษาที่เลือก",
    siteLabel: "ไซต์งาน",
    initialsLabel: "อักษรย่อชื่อ",
    phoneLast4Label: "เบอร์โทร 4 ตัวท้าย",
    enterWorker: "ไปยังหน้าคนงาน",
    entering: "กำลังดำเนินการ",
    errorTitle: "เข้าใช้งานไม่สำเร็จ",
    blockedTitle: "สิ้นสุดงานวันนี้แล้ว",
    blockedBody: "SAFE-LINK จะถูกปิดจนกว่าจะเช็กอิน TBM ครั้งถัดไป",
  },
  uz: {
    ...EN_TEXT,
    quickEntryTitle: "Tez kirish",
    chooseLanguageTitle: "Tilni tanlang",
    selectedLanguage: "Tanlangan til",
    siteLabel: "Ish joyi",
    initialsLabel: "Ism bosh harflari",
    phoneLast4Label: "Telefonning oxirgi 4 raqami",
    enterWorker: "Ishchi ekranini ochish",
    entering: "Kirish bajarilmoqda",
    errorTitle: "Kirish xatosi",
    blockedTitle: "Bugungi ish tugadi",
    blockedBody: "Keyingi TBM kirishigacha SAFE-LINK o'chiriladi.",
  },
  ph: {
    ...EN_TEXT,
    quickEntryTitle: "Mabilis na pasok",
    chooseLanguageTitle: "Pumili ng wika",
    selectedLanguage: "Napiling wika",
    siteLabel: "Lugar ng trabaho",
    initialsLabel: "Inisyal ng pangalan",
    phoneLast4Label: "Huling 4 numero ng telepono",
    enterWorker: "Buksan ang worker screen",
    entering: "Pinoproseso",
    errorTitle: "Nabigo ang pagpasok",
    blockedTitle: "Tapos na ang trabaho ngayong araw",
    blockedBody: "Naka-disable ang SAFE-LINK hanggang sa susunod na TBM check-in.",
  },
  km: {
    ...EN_TEXT,
    quickEntryTitle: "ចូលរហ័ស",
    chooseLanguageTitle: "ជ្រើសរើសភាសា",
    selectedLanguage: "ភាសាដែលបានជ្រើស",
    siteLabel: "ការដ្ឋាន",
    initialsLabel: "អក្សរកាត់ឈ្មោះ",
    phoneLast4Label: "លេខទូរស័ព្ទ 4 ខ្ទង់ចុងក្រោយ",
    enterWorker: "បើកទំព័រកម្មករ",
    entering: "កំពុងដំណើរការ",
    errorTitle: "ចូលមិនបាន",
    blockedTitle: "ការងារថ្ងៃនេះបានបញ្ចប់",
    blockedBody: "SAFE-LINK ត្រូវបានបិទរហូតដល់ TBM បន្ទាប់។",
  },
  id: {
    ...EN_TEXT,
    quickEntryTitle: "Masuk cepat",
    chooseLanguageTitle: "Pilih bahasa",
    selectedLanguage: "Bahasa dipilih",
    siteLabel: "Lokasi kerja",
    initialsLabel: "Inisial nama",
    phoneLast4Label: "4 digit terakhir telepon",
    enterWorker: "Buka layar pekerja",
    entering: "Memproses masuk",
    errorTitle: "Gagal masuk",
    blockedTitle: "Pekerjaan hari ini selesai",
    blockedBody: "SAFE-LINK dinonaktifkan sampai check-in TBM berikutnya.",
  },
  mn: {
    ...EN_TEXT,
    quickEntryTitle: "Шуурхай нэвтрэх",
    chooseLanguageTitle: "Хэл сонгоно уу",
    selectedLanguage: "Сонгосон хэл",
    siteLabel: "Ажлын талбай",
    initialsLabel: "Нэрийн эхний үсэг",
    phoneLast4Label: "Утасны сүүлийн 4 орон",
    enterWorker: "Ажилтны дэлгэц рүү",
    entering: "Боловсруулж байна",
    errorTitle: "Нэвтрэх алдаа",
    blockedTitle: "Өнөөдрийн ажил дууссан",
    blockedBody: "Дараагийн TBM бүртгэл хүртэл SAFE-LINK идэвхгүй байна.",
  },
  my: {
    ...EN_TEXT,
    quickEntryTitle: "အမြန်ဝင်ရန်",
    chooseLanguageTitle: "ဘာသာစကား ရွေးပါ",
    selectedLanguage: "ရွေးထားသော ဘာသာစကား",
    siteLabel: "လုပ်ငန်းခွင်",
    initialsLabel: "အမည် အတိုကောက်",
    phoneLast4Label: "ဖုန်းနံပါတ် နောက်ဆုံး 4 လုံး",
    enterWorker: "အလုပ်သမား မျက်နှာပြင်သို့",
    entering: "ဆောင်ရွက်နေသည်",
    errorTitle: "ဝင်ရောက်မှု မအောင်မြင်ပါ",
    blockedTitle: "ယနေ့အလုပ် ပြီးဆုံးပါပြီ",
    blockedBody: "နောက် TBM check-in မတိုင်မီ SAFE-LINK ကို ပိတ်ထားသည်။",
  },
  ne: {
    ...EN_TEXT,
    quickEntryTitle: "छिटो प्रवेश",
    chooseLanguageTitle: "भाषा छान्नुहोस्",
    selectedLanguage: "छानिएको भाषा",
    siteLabel: "काम गर्ने स्थान",
    initialsLabel: "नामको सुरु अक्षर",
    phoneLast4Label: "फोनको अन्तिम 4 अंक",
    enterWorker: "कामदार स्क्रिन खोल्नुहोस्",
    entering: "प्रवेश प्रक्रिया हुँदैछ",
    errorTitle: "प्रवेश असफल",
    blockedTitle: "आजको काम सकियो",
    blockedBody: "अर्को TBM चेक-इनसम्म SAFE-LINK बन्द हुन्छ।",
  },
  bn: {
    ...EN_TEXT,
    quickEntryTitle: "দ্রুত প্রবেশ",
    chooseLanguageTitle: "ভাষা নির্বাচন করুন",
    selectedLanguage: "নির্বাচিত ভাষা",
    siteLabel: "কাজের স্থান",
    initialsLabel: "নামের আদ্যক্ষর",
    phoneLast4Label: "ফোনের শেষ 4 সংখ্যা",
    enterWorker: "কর্মী স্ক্রিন খুলুন",
    entering: "প্রবেশ প্রক্রিয়া চলছে",
    errorTitle: "প্রবেশ ব্যর্থ",
    blockedTitle: "আজকের কাজ শেষ হয়েছে",
    blockedBody: "পরবর্তী TBM চেক-ইন পর্যন্ত SAFE-LINK বন্ধ থাকবে।",
  },
  kk: {
    ...EN_TEXT,
    quickEntryTitle: "Жылдам кіру",
    chooseLanguageTitle: "Тілді таңдаңыз",
    selectedLanguage: "Таңдалған тіл",
    siteLabel: "Жұмыс орны",
    initialsLabel: "Аты-жөнінің бас әріптері",
    phoneLast4Label: "Телефонның соңғы 4 саны",
    enterWorker: "Жұмысшы экранын ашу",
    entering: "Кіру өңделуде",
    errorTitle: "Кіру сәтсіз",
    blockedTitle: "Бүгінгі жұмыс аяқталды",
    blockedBody: "Келесі TBM тіркелуіне дейін SAFE-LINK өшіріледі.",
  },
  ru: {
    ...EN_TEXT,
    quickEntryTitle: "Быстрый вход",
    chooseLanguageTitle: "Выберите язык",
    selectedLanguage: "Выбранный язык",
    siteLabel: "Объект",
    initialsLabel: "Инициалы имени",
    phoneLast4Label: "Последние 4 цифры телефона",
    enterWorker: "Открыть экран работника",
    entering: "Вход выполняется",
    errorTitle: "Ошибка входа",
    blockedTitle: "Работа на сегодня завершена",
    blockedBody: "SAFE-LINK отключен до следующей отметки TBM.",
  },
  en: EN_TEXT,
  jp: {
    ...EN_TEXT,
    quickEntryTitle: "簡単入場",
    chooseLanguageTitle: "言語を選択してください",
    selectedLanguage: "選択した言語",
    siteLabel: "現場",
    initialsLabel: "氏名のイニシャル",
    phoneLast4Label: "電話番号の下4桁",
    enterWorker: "作業員画面へ",
    entering: "入場処理中",
    errorTitle: "入場失敗",
    blockedTitle: "本日の作業は終了しました",
    blockedBody: "次回のTBM出勤タグまでSAFE-LINKは停止されます。",
  },
  fr: {
    ...EN_TEXT,
    quickEntryTitle: "Entrée rapide",
    chooseLanguageTitle: "Choisissez la langue",
    selectedLanguage: "Langue sélectionnée",
    siteLabel: "Chantier",
    initialsLabel: "Initiales du nom",
    phoneLast4Label: "4 derniers chiffres du téléphone",
    enterWorker: "Ouvrir l'écran travailleur",
    entering: "Entrée en cours",
    errorTitle: "Échec de l'entrée",
    blockedTitle: "Travail terminé aujourd'hui",
    blockedBody: "SAFE-LINK est désactivé jusqu'au prochain pointage TBM.",
  },
  es: {
    ...EN_TEXT,
    quickEntryTitle: "Entrada rápida",
    chooseLanguageTitle: "Seleccione idioma",
    selectedLanguage: "Idioma seleccionado",
    siteLabel: "Obra",
    initialsLabel: "Iniciales del nombre",
    phoneLast4Label: "Últimos 4 dígitos del teléfono",
    enterWorker: "Abrir pantalla del trabajador",
    entering: "Procesando entrada",
    errorTitle: "Error de entrada",
    blockedTitle: "El trabajo de hoy terminó",
    blockedBody: "SAFE-LINK queda desactivado hasta el próximo registro TBM.",
  },
  ar: {
    ...EN_TEXT,
    quickEntryTitle: "دخول سريع",
    chooseLanguageTitle: "اختر اللغة",
    selectedLanguage: "اللغة المختارة",
    siteLabel: "موقع العمل",
    initialsLabel: "الأحرف الأولى من الاسم",
    phoneLast4Label: "آخر 4 أرقام من الهاتف",
    enterWorker: "فتح شاشة العامل",
    entering: "جار معالجة الدخول",
    errorTitle: "فشل الدخول",
    blockedTitle: "انتهى عمل اليوم",
    blockedBody: "سيتم تعطيل SAFE-LINK حتى تسجيل TBM التالي.",
  },
  hi: {
    ...EN_TEXT,
    quickEntryTitle: "त्वरित प्रवेश",
    chooseLanguageTitle: "भाषा चुनें",
    selectedLanguage: "चुनी गई भाषा",
    siteLabel: "कार्य स्थल",
    initialsLabel: "नाम के पहले अक्षर",
    phoneLast4Label: "फोन के अंतिम 4 अंक",
    enterWorker: "वर्कर स्क्रीन खोलें",
    entering: "प्रवेश प्रक्रिया जारी",
    errorTitle: "प्रवेश विफल",
    blockedTitle: "आज का काम समाप्त हुआ",
    blockedBody: "अगले TBM चेक-इन तक SAFE-LINK बंद रहेगा।",
  },
};

export const LANG_TO_COUNTRY = Object.fromEntries(
  QR_LANGUAGE_OPTIONS.map((option) => [option.lang, option.country])
) as Record<QrLanguageCode, string>;

export const COUNTRY_TO_LANGUAGE = Object.fromEntries(
  QR_LANGUAGE_OPTIONS.map((option) => [option.country, option.lang])
) as Record<string, QrLanguageCode>;

export function findQrLanguageByCountry(country: string | null | undefined) {
  const normalized = String(country ?? "").trim().toUpperCase();
  return QR_LANGUAGE_OPTIONS.find((option) => option.country === normalized);
}

export function findQrLanguageByCode(lang: string | null | undefined) {
  const normalized = String(lang ?? "").trim().toLowerCase();
  return QR_LANGUAGE_OPTIONS.find((option) => option.lang === normalized) ?? QR_LANGUAGE_OPTIONS[0];
}

export function getQrEntryText(lang: string | null | undefined) {
  return QR_ENTRY_TEXT[findQrLanguageByCode(lang).lang];
}

export function getQrFlagUrl(option: QrLanguageOption) {
  return `https://flagcdn.com/w160/${option.iso}.png`;
}
