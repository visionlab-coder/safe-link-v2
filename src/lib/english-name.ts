export function normalizeEnglishName(value: string): string {
  return value.trim().replace(/ +/g, " ").toUpperCase();
}
export function isEnglishName(value: string): boolean {
  return value.length <= 80 && /^[A-Za-z][A-Za-z .'-]*$/.test(value.trim());
}
export function filterEnglishNameInput(value: string): string {
  return value.replace(/[^A-Za-z .'-]/g, "").slice(0, 80);
}

// These labels are shared by every name-entry path; never fall back to English for a supported language.
const rows: Record<string, readonly string[]> = {
  ko: ["영문 이름", "여권 등에서 사용하는 영문 이름을 확인해 주세요. 자국어 입력 시 영문 표기를 제안합니다.", "영문 표기 제안 중…", "이 영문 이름 사용", "영문 이름을 확인했습니다.", "영문 이름을 직접 입력하고 확인해 주세요.", "로그인 아이디"],
  en: ["Name in Roman letters", "Check the spelling you use on your passport. A name in your language can be suggested in Roman letters.", "Suggesting spelling…", "Use this spelling", "I have checked my name.", "Enter your name in Roman letters and confirm it.", "Login ID"],
  zh: ["英文姓名", "请核对护照上的英文拼写。输入母语姓名可获取拉丁字母拼写建议。", "正在生成建议…", "使用此拼写", "我已核对英文姓名。", "请手动输入英文姓名并确认。", "登录账号"],
  vi: ["Tên bằng chữ La-tinh không dấu", "Kiểm tra cách viết trên hộ chiếu. Nhập tên bằng tiếng mẹ đẻ để nhận gợi ý chữ La-tinh.", "Đang gợi ý…", "Dùng cách viết này", "Tôi đã kiểm tra tên.", "Nhập tên bằng chữ La-tinh không dấu và xác nhận.", "ID đăng nhập"],
  th: ["ชื่อด้วยอักษรโรมัน", "ตรวจสอบการสะกดตามหนังสือเดินทาง ป้อนชื่อภาษาของคุณเพื่อรับคำแนะนำอักษรโรมัน", "กำลังแนะนำ…", "ใช้การสะกดนี้", "ฉันตรวจสอบชื่อแล้ว", "กรอกชื่อด้วยอักษรโรมันและยืนยัน", "รหัสเข้าสู่ระบบ"],
  ru: ["Имя латиницей", "Проверьте написание в паспорте. Для имени на родном языке будет предложена латиница.", "Подбираем написание…", "Использовать написание", "Я проверил(а) имя.", "Введите имя латиницей и подтвердите.", "Идентификатор входа"],
  km: ["ឈ្មោះជាអក្សរឡាតាំង", "សូមពិនិត្យអក្ខរាវិរុទ្ធតាមលិខិតឆ្លងដែន។ បញ្ចូលឈ្មោះជាភាសារបស់អ្នក ដើម្បីទទួលការណែនាំជាអក្សរឡាតាំង។", "កំពុងណែនាំ…", "ប្រើអក្ខរាវិរុទ្ធនេះ", "ខ្ញុំបានពិនិត្យឈ្មោះហើយ។", "សូមបញ្ចូលឈ្មោះជាអក្សរឡាតាំងដោយខ្លួនឯង ហើយបញ្ជាក់។", "លេខសម្គាល់ចូលប្រើ"],
  my: ["လက်တင်အက္ခရာဖြင့် အမည်", "နိုင်ငံကူးလက်မှတ်ရှိ စာလုံးပေါင်းကို စစ်ဆေးပါ။ မိခင်ဘာသာဖြင့် ရိုက်ထည့်လျှင် လက်တင်အက္ခရာ အကြံပြုချက်ရမည်။", "အကြံပြုနေသည်…", "ဤစာလုံးပေါင်းကို သုံးမည်", "အမည်ကို စစ်ဆေးပြီးပါပြီ။", "လက်တင်အက္ခရာဖြင့် အမည်ကို ကိုယ်တိုင်ရိုက်ထည့်ပြီး အတည်ပြုပါ။", "ဝင်ရောက်ရန် အိုင်ဒီ"],
  id: ["Nama dalam huruf Latin", "Periksa ejaan pada paspor. Nama dalam bahasa Anda akan diberi saran ejaan Latin.", "Menyiapkan saran…", "Gunakan ejaan ini", "Saya telah memeriksa nama.", "Masukkan nama dalam huruf Latin dan konfirmasi.", "ID masuk"],
  ne: ["रोमन अक्षरमा नाम", "राहदानीको हिज्जे जाँच्नुहोस्। आफ्नो भाषामा नाम लेख्दा रोमन हिज्जे सुझाइन्छ।", "हिज्जे सुझाउँदै…", "यो हिज्जे प्रयोग गर्ने", "मैले नाम जाँचें।", "रोमन अक्षरमा नाम लेखेर पुष्टि गर्नुहोस्।", "लगइन आईडी"],
  bn: ["রোমান অক্ষরে নাম", "পাসপোর্টের বানান যাচাই করুন। নিজের ভাষায় নাম লিখলে রোমান বানান প্রস্তাব করা হবে।", "বানান প্রস্তাব করা হচ্ছে…", "এই বানান ব্যবহার করুন", "আমি নাম যাচাই করেছি।", "রোমান অক্ষরে নাম লিখে নিশ্চিত করুন।", "লগইন আইডি"],
  uz: ["Lotin harflaridagi ism", "Pasportdagi yozilishini tekshiring. O‘z tilingizda ism kiritsangiz, lotincha yozilishi taklif qilinadi.", "Taklif tayyorlanmoqda…", "Shu yozilishni ishlatish", "Ismimni tekshirdim.", "Ismni lotin harflarida kiriting va tasdiqlang.", "Kirish ID"],
  kk: ["Латын әріптерімен аты-жөні", "Паспорттағы жазылуын тексеріңіз. Өз тіліңізде енгізсеңіз, латынша нұсқа ұсынылады.", "Нұсқа ұсынылуда…", "Осы нұсқаны қолдану", "Аты-жөнімді тексердім.", "Атыңызды латын әріптерімен енгізіп, растаңыз.", "Кіру идентификаторы"],
  mn: ["Латин үсгээр нэр", "Паспорт дахь бичлэгийг шалгана уу. Эх хэлээрээ нэрээ оруулбал латин бичлэг санал болгоно.", "Бичлэг санал болгож байна…", "Энэ бичлэгийг ашиглах", "Нэрээ шалгасан.", "Нэрээ латин үсгээр оруулж баталгаажуулна уу.", "Нэвтрэх ID"],
  tl: ["Pangalan sa titik Latin", "Suriin ang baybay sa pasaporte. Magmumungkahi ng baybay sa Latin para sa pangalan sa sariling wika.", "Nagmumungkahi…", "Gamitin ang baybay", "Nasuri ko ang pangalan.", "Ilagay ang pangalan sa titik Latin at kumpirmahin.", "Login ID"],
  jp: ["ローマ字氏名", "パスポートの綴りを確認してください。母語で入力するとローマ字表記を提案します。", "表記を提案中…", "この表記を使用", "氏名を確認しました。", "ローマ字氏名を直接入力して確認してください。", "ログインID"],
  fr: ["Nom en lettres latines", "Vérifiez l’orthographe du passeport. Un nom dans votre langue peut recevoir une proposition en lettres latines.", "Proposition en cours…", "Utiliser cette orthographe", "J’ai vérifié mon nom.", "Saisissez votre nom en lettres latines sans accents et confirmez.", "Identifiant de connexion"],
  es: ["Nombre en letras latinas", "Compruebe la escritura del pasaporte. Se sugerirá una escritura latina para el nombre en su idioma.", "Preparando sugerencia…", "Usar esta escritura", "He comprobado mi nombre.", "Escriba su nombre en letras latinas sin acentos y confirme.", "ID de acceso"],
  ar: ["الاسم بحروف لاتينية", "راجع تهجئة الاسم في جواز السفر. أدخل اسمك بلغتك لاقتراح كتابته بحروف لاتينية.", "جارٍ اقتراح التهجئة…", "استخدام هذه التهجئة", "راجعت اسمي.", "أدخل اسمك بحروف لاتينية وأكّده.", "معرّف الدخول"],
  hi: ["रोमन अक्षरों में नाम", "पासपोर्ट की वर्तनी जाँचें। अपनी भाषा में नाम लिखने पर रोमन वर्तनी सुझाई जाएगी।", "वर्तनी सुझाई जा रही है…", "यह वर्तनी इस्तेमाल करें", "मैंने नाम जाँच लिया है।", "रोमन अक्षरों में नाम लिखकर पुष्टि करें।", "लॉगिन आईडी"],
};
export function englishNameUI(language: string) {
  const normalized = language === "ja" ? "jp" : language === "ph" ? "tl" : language;
  const [label, , , , confirm, error, loginId] = rows[normalized] ?? rows.en;
  return { label, help: directInputHelp[normalized] ?? directInputHelp.en, confirm, error, loginId };
}

const directInputHelp: Record<string, string> = {
  ko: "영문 알파벳(A–Z)으로 입력해 주세요. 공백, 하이픈(-), 아포스트로피('), 마침표(.)를 사용할 수 있습니다.",
  en: "Use English letters (A–Z). Spaces, hyphens (-), apostrophes (') and periods (.) are allowed.",
  zh: "请使用英文字母（A–Z）。可使用空格、连字符（-）、撇号（'）和句点（.）。",
  vi: "Chỉ nhập chữ cái không dấu (A–Z). Cho phép khoảng trắng, dấu gạch nối (-), dấu nháy đơn (') và dấu chấm (.).",
  th: "กรอกด้วยตัวอักษรอังกฤษ (A–Z) ใช้ช่องว่าง ยัติภังค์ (-) อัญประกาศเดี่ยว (') และจุด (.) ได้",
  ru: "Введите имя английскими буквами (A–Z). Допустимы пробелы, дефисы (-), апострофы (') и точки (.).",
  km: "សូមប្រើអក្សរអង់គ្លេស (A–Z)។ អាចប្រើចន្លោះ សញ្ញា (-), (') និង (.) បាន។",
  my: "အင်္ဂလိပ်အက္ခရာ (A–Z) ဖြင့် ရိုက်ထည့်ပါ။ နေရာလွတ်နှင့် (-), ('), (.) သင်္ကေတများ အသုံးပြုနိုင်သည်။",
  id: "Gunakan huruf Inggris (A–Z). Spasi, tanda hubung (-), apostrof (') dan titik (.) diperbolehkan.",
  ne: "अंग्रेजी अक्षर (A–Z) प्रयोग गर्नुहोस्। खाली ठाउँ, हाइफन (-), एपोस्ट्रोफ (') र बिन्दु (.) प्रयोग गर्न सकिन्छ।",
  bn: "ইংরেজি অক্ষর (A–Z) ব্যবহার করুন। ফাঁকা স্থান, হাইফেন (-), অ্যাপস্ট্রফি (') ও বিন্দু (.) ব্যবহার করা যাবে।",
  uz: "Ingliz harflaridan (A–Z) foydalaning. Bo‘sh joy, chiziqcha (-), apostrof (') va nuqta (.) mumkin.",
  kk: "Ағылшын әріптерімен (A–Z) енгізіңіз. Бос орын, дефис (-), апостроф (') және нүкте (.) қолдануға болады.",
  mn: "Англи үсгээр (A–Z) оруулна уу. Зай, зураас (-), апостроф (') болон цэг (.) ашиглаж болно.",
  tl: "Gumamit ng mga letrang Ingles (A–Z). Puwede ang espasyo, gitling (-), kudlit (') at tuldok (.).",
  jp: "英字（A–Z）で入力してください。空白、ハイフン（-）、アポストロフィ（'）、ピリオド（.）を使用できます。",
  fr: "Utilisez les lettres anglaises (A–Z), sans accents. Espaces, traits d’union (-), apostrophes (') et points (.) autorisés.",
  es: "Use letras inglesas (A–Z), sin tildes. Se permiten espacios, guiones (-), apóstrofos (') y puntos (.).",
  ar: "استخدم الأحرف الإنجليزية (A–Z). يُسمح بالمسافات والشرطات (-) والفواصل العليا (') والنقاط (.).",
  hi: "अंग्रेज़ी अक्षर (A–Z) इस्तेमाल करें। खाली जगह, हाइफ़न (-), एपॉस्ट्रॉफ़ी (') और बिंदु (.) स्वीकार्य हैं।",
};
