import { TBM_TRADES } from "./tbm-trades";
import type { QrLanguageCode } from "@/utils/qr/language-options";

// Display labels only. Never translate the canonical trade_types persisted with a TBM.
// Order matches TBM_TRADES; keep the two formwork categories distinct.
const labels: Record<QrLanguageCode, string> = {
  ko: TBM_TRADES.join("|"),
  en: "Rebar|Formwork|Concrete|Gang formwork|Aluminum formwork|Scaffolding|Lifting|Chipping & plastering|Dismantling|Cleanup|System scaffolding|Direct labor|Contract labor|Rope access|Formwork carpentry|Concrete pouring (concrete scaffolding)",
  vi: "Cốt thép|Cốp pha|Bê tông|Cốp pha mảng lớn|Cốp pha nhôm|Giàn giáo|Nâng hạ|Đục và trát|Tháo dỡ|Dọn dẹp|Giàn giáo hệ thống|Lao động trực tiếp|Lao động thuê ngoài|Làm việc bằng dây|Mộc cốp pha|Đổ bê tông (giàn giáo bê tông)",
  zh: "钢筋|模板|混凝土|大模板|铝模板|脚手架|吊装|凿除与抹灰|拆除|清理|系统脚手架|直营用工|劳务用工|绳索作业|木工模板|混凝土浇筑（混凝土脚手架）",
  th: "เหล็กเสริม|แบบหล่อ|คอนกรีต|แบบหล่อแผงใหญ่|แบบหล่ออะลูมิเนียม|นั่งร้าน|งานยก|สกัดและฉาบปูน|รื้อถอน|ทำความสะอาด|นั่งร้านระบบ|แรงงานโดยตรง|แรงงานรับเหมา|งานเชือก|ช่างไม้แบบหล่อ|เทคอนกรีต (นั่งร้านคอนกรีต)",
  uz: "Armatura|Qolip|Beton|Yirik panelli qolip|Alyuminiy qolip|Havoza|Yuk ko‘tarish|Chopish va suvoq|Demontaj|Tozalash|Tizimli havoza|Bevosita yollangan ishchilar|Pudrat ishchilari|Arqonda ishlash|Qolip duradgorligi|Beton quyish (beton havozasi)",
  ph: "Bakal na pampatibay|Hulmahan|Kongkreto|Malalaking panel na hulmahan|Aluminum na hulmahan|Plantsa|Pagbubuhat|Pagtibag at pagpalitada|Pagbaklas|Paglilinis|Sistemang plantsa|Direktang manggagawa|Kontratang manggagawa|Trabaho gamit ang lubid|Karpinterya ng hulmahan|Pagbuhos ng kongkreto (plantsa para sa kongkreto)",
  km: "ដែកពង្រឹង|ពុម្ព|បេតុង|ពុម្ពផ្ទាំងធំ|ពុម្ពអាលុយមីញ៉ូម|រន្ទា|ការលើក|ការដាប់និងបូកកំបោរ|ការរុះរើ|ការសម្អាត|រន្ទាប្រព័ន្ធ|កម្មករផ្ទាល់|កម្មករម៉ៅការ|ការងារប្រើខ្សែពួរ|ជាងឈើពុម្ព|ការចាក់បេតុង (រន្ទាបេតុង)",
  id: "Besi tulangan|Bekisting|Beton|Bekisting panel besar|Bekisting aluminium|Perancah|Pengangkatan|Pembobokan dan plesteran|Pembongkaran|Pembersihan|Perancah sistem|Pekerja langsung|Pekerja kontrak|Akses tali|Pertukangan bekisting|Pengecoran beton (perancah beton)",
  mn: "Арматур|Хэв хашмал|Бетон|Том хавтан хэв|Хөнгөн цагаан хэв|Шат вандан|Өргөх ажил|Цүүцдэх ба шавардлага|Буулгалт|Цэвэрлэгээ|Систем шат|Шууд ажилтан|Гэрээт ажилтан|Олсны ажил|Хэв хашмалын мужаан|Бетон цутгалт (бетоны шат)",
  my: "သံချောင်း|ပုံစံခွက်|ကွန်ကရစ်|အပြားကြီးပုံစံခွက်|အလူမီနီယမ်ပုံစံခွက်|ငြမ်း|ပင့်တင်ခြင်း|ထွင်းဖောက်နှင့်အင်္ဂတေကိုင်ခြင်း|ဖြုတ်ဖျက်ခြင်း|သန့်ရှင်းရေး|စနစ်ငြမ်း|တိုက်ရိုက်လုပ်သား|ကန်ထရိုက်လုပ်သား|ကြိုးဖြင့်လုပ်ကိုင်ခြင်း|ပုံစံခွက်လက်သမား|ကွန်ကရစ်လောင်းခြင်း (ကွန်ကရစ်ငြမ်း)",
  ne: "डन्डी|फर्मवर्क|कङ्क्रिट|ठूला प्यानल फर्मवर्क|आलुमिनियम फर्मवर्क|मचान|उठाउने काम|खोप्ने र प्लास्टर|भत्काउने काम|सरसफाइ|प्रणालीगत मचान|प्रत्यक्ष कामदार|ठेक्का कामदार|डोरीमा काम|फर्मवर्क सिकर्मी|कङ्क्रिट खन्याउने (कङ्क्रिट मचान)",
  bn: "রড|ছাঁচ|কংক্রিট|বড় প্যানেলের ছাঁচ|অ্যালুমিনিয়ামের ছাঁচ|মাচা|উত্তোলন|চিপিং ও প্লাস্টার|খোলা ও ভাঙা|পরিষ্কার|সিস্টেম মাচা|সরাসরি শ্রমিক|ঠিকাদারি শ্রমিক|দড়ির কাজ|ছাঁচের কাঠমিস্ত্রি|কংক্রিট ঢালাই (কংক্রিট মাচা)",
  kk: "Арматура|Қалып|Бетон|Ірі панельді қалып|Алюминий қалып|Құрылыс сатысы|Жүк көтеру|Қашау және сылақ|Бөлшектеу|Тазалау|Жүйелік құрылыс сатысы|Тікелей жұмысшылар|Мердігер жұмысшылар|Арқанмен жұмыс|Қалып ағаш шебері|Бетон құю (бетонға арналған саты)",
  ru: "Арматура|Опалубка|Бетон|Крупнощитовая опалубка|Алюминиевая опалубка|Строительные леса|Подъём грузов|Скалывание и штукатурка|Демонтаж|Уборка|Системные леса|Штатные рабочие|Подрядные рабочие|Канатный доступ|Плотницкая опалубка|Бетонирование (леса для бетонирования)",
  jp: "鉄筋|型枠|コンクリート|大型パネル型枠|アルミ型枠|足場|揚重|はつり・左官|解体|片付け|システム足場|直営作業員|請負作業員|ロープ作業|型枠大工|コンクリート打設（コンクリート用足場）",
  fr: "Ferraillage|Coffrage|Béton|Coffrage en grands panneaux|Coffrage aluminium|Échafaudage|Levage|Piquage et enduit|Démontage|Nettoyage|Échafaudage modulaire|Main-d’œuvre directe|Main-d’œuvre sous-traitante|Travaux sur cordes|Charpenterie de coffrage|Coulage du béton (échafaudage pour béton)",
  es: "Armadura|Encofrado|Hormigón|Encofrado de grandes paneles|Encofrado de aluminio|Andamios|Izaje|Picado y enlucido|Desmontaje|Limpieza|Andamio modular|Personal directo|Personal subcontratado|Trabajos con cuerdas|Carpintería de encofrado|Vertido de hormigón (andamio para hormigón)",
  ar: "حديد التسليح|القوالب|الخرسانة|قوالب الألواح الكبيرة|قوالب الألومنيوم|السقالات|الرفع|التكسير واللياسة|الفك|التنظيف|السقالات النظامية|العمالة المباشرة|عمالة المقاول|العمل بالحبال|نجارة القوالب|صب الخرسانة (سقالات الخرسانة)",
  hi: "सरिया|फॉर्मवर्क|कंक्रीट|बड़े पैनल फॉर्मवर्क|एल्युमिनियम फॉर्मवर्क|मचान|भार उठाना|चिपिंग और प्लास्टर|खोलना और तोड़ना|सफाई|सिस्टम मचान|प्रत्यक्ष श्रमिक|ठेका श्रमिक|रस्सी से काम|फॉर्मवर्क बढ़ईगीरी|कंक्रीट डालना (कंक्रीट मचान)",
};

export function tbmLanguage(lang: string): QrLanguageCode {
  const code = lang.toLowerCase().split(/[-_]/)[0];
  const normalized = code === "ja" ? "jp" : code === "tl" || code === "fil" ? "ph" : code;
  return Object.hasOwn(labels, normalized) ? normalized as QrLanguageCode : "en";
}

export function tbmTradeLabel(trade: string, lang: string): string {
  const index = TBM_TRADES.indexOf(trade as typeof TBM_TRADES[number]);
  return index < 0 ? trade : labels[tbmLanguage(lang)].split("|")[index];
}

// [Select all, composer heading, composer guidance]
const selectorLabels: Record<QrLanguageCode, [string, string, string]> = {
  ko: ["전체", "TBM 공종", "여러 공종을 선택할 수 있습니다. 선택한 공종은 TBM에 표시됩니다."],
  en: ["All", "TBM trades", "Select one or more trades to display on this TBM."],
  vi: ["Tất cả", "Công việc TBM", "Chọn một hoặc nhiều loại công việc để hiển thị trên TBM này."],
  zh: ["全部", "TBM 工种", "可选择一个或多个工种，所选工种将显示在此 TBM 中。"],
  th: ["ทั้งหมด", "ประเภทงาน TBM", "เลือกประเภทงานอย่างน้อยหนึ่งรายการเพื่อแสดงใน TBM นี้"],
  uz: ["Barchasi", "TBM ish turlari", "Ushbu TBMda ko‘rsatish uchun bir yoki bir nechta ish turini tanlang."],
  ph: ["Lahat", "Mga uri ng trabaho sa TBM", "Pumili ng isa o higit pang uri ng trabaho na ipapakita sa TBM na ito."],
  km: ["ទាំងអស់", "ប្រភេទការងារ TBM", "ជ្រើសរើសប្រភេទការងារមួយ ឬច្រើន ដើម្បីបង្ហាញនៅលើ TBM នេះ។"],
  id: ["Semua", "Jenis pekerjaan TBM", "Pilih satu atau beberapa jenis pekerjaan untuk ditampilkan pada TBM ini."],
  mn: ["Бүгд", "TBM ажлын төрөл", "Энэ TBM дээр харуулах нэг буюу хэд хэдэн ажлын төрлийг сонгоно уу."],
  my: ["အားလုံး", "TBM အလုပ်အမျိုးအစားများ", "ဤ TBM တွင် ဖော်ပြရန် အလုပ်အမျိုးအစား တစ်ခု သို့မဟုတ် တစ်ခုထက်ပို၍ ရွေးချယ်ပါ။"],
  ne: ["सबै", "TBM कामका प्रकार", "यस TBM मा देखाउन एक वा बढी कामका प्रकार छान्नुहोस्।"],
  bn: ["সব", "TBM কাজের ধরন", "এই TBM-এ দেখানোর জন্য এক বা একাধিক কাজের ধরন বেছে নিন।"],
  kk: ["Барлығы", "TBM жұмыс түрлері", "Осы TBM-де көрсету үшін бір немесе бірнеше жұмыс түрін таңдаңыз."],
  ru: ["Все", "Виды работ TBM", "Выберите один или несколько видов работ для отображения в этом TBM."],
  jp: ["すべて", "TBM 工種", "このTBMに表示する工種を1つ以上選択してください。"],
  fr: ["Tous", "Métiers du TBM", "Sélectionnez un ou plusieurs métiers à afficher sur ce TBM."],
  es: ["Todos", "Oficios del TBM", "Seleccione uno o varios oficios para mostrar en este TBM."],
  ar: ["الكل", "تخصصات TBM", "اختر تخصصًا واحدًا أو أكثر لعرضه في هذا TBM."],
  hi: ["सभी", "TBM कार्य प्रकार", "इस TBM में दिखाने के लिए एक या अधिक कार्य प्रकार चुनें।"],
};

export function tbmTradeSelectorUI(lang: string) {
  const [all, heading, hint] = selectorLabels[tbmLanguage(lang)];
  return { all, heading, hint };
}
