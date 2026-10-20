import { normalizeTbmTrades } from "./tbm-trades";
import { tbmLanguage } from "./tbm-trade-labels";

export type DailyTrades = { date: string; selected: boolean; trades: string[] };
export function isCurrentDailyTrades(selection: DailyTrades, now = new Date()) {
  return selection.date === new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}
export function matchesDailyTrades(trades: unknown, selection: DailyTrades): boolean {
  const values = normalizeTbmTrades(trades);
  return !values.length || (selection.selected && values.some(value => selection.trades.includes(value)));
}
export async function loadDailyTrades(siteId: string, signal?: AbortSignal): Promise<DailyTrades> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(`/api/tbm/daily-trades?${new URLSearchParams({ siteId })}`,
    { cache: "no-store", credentials: "include", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error("daily_trades_unavailable");
  const data = await response.json();
  if (typeof data.date !== "string" || typeof data.selected !== "boolean" || !Array.isArray(data.trades))
    throw new Error("daily_trades_invalid");
  return data;
}
// title | explanation | save | change | other | common | error | retry | cancel
const texts: Record<string, string> = {
  ko: "오늘 작업 공종|오늘 작업할 공종을 모두 선택해 주세요. 선택 공종과 현장 공통 TBM을 안내합니다.|선택 완료|오늘 공종 변경|다른 공종 TBM 보기 (선택 열람)|현장 공통|공종 정보를 저장하거나 불러오지 못했습니다. 다시 시도해 주세요.|다시 시도|취소",
  en: "Today's work trades|Select all your trades for today. Your trades and site-wide TBMs will be shown.|Save selection|Change today's trades|Other trade TBMs (optional)|Site-wide|Unable to load or save trades. Please retry.|Retry|Cancel",
  vi: "Công việc hôm nay|Chọn tất cả công việc hôm nay để xem TBM phù hợp và TBM chung.|Lưu lựa chọn|Đổi công việc hôm nay|TBM công việc khác (tùy chọn)|Toàn công trường|Không tải hoặc lưu được. Vui lòng thử lại.|Thử lại|Hủy",
  zh: "今日工种|请选择今天的所有工种，将显示相关及全工地 TBM。|保存选择|更改今日工种|其他工种 TBM（选看）|全工地|无法读取或保存，请重试。|重试|取消",
  jp: "今日の作業工種|今日の工種をすべて選択してください。該当工種と現場共通のTBMを表示します。|選択を保存|今日の工種を変更|他の工種のTBM（任意）|現場共通|読み込み・保存に失敗しました。再試行してください。|再試行|キャンセル",
  th: "ประเภทงานวันนี้|เลือกงานทั้งหมดของวันนี้ เพื่อดู TBM ที่เกี่ยวข้องและของทั้งไซต์|บันทึก|เปลี่ยนงานวันนี้|TBM งานอื่น (เลือกดูได้)|ทั้งไซต์|โหลดหรือบันทึกไม่สำเร็จ โปรดลองอีกครั้ง|ลองอีกครั้ง|ยกเลิก",
  uz: "Bugungi ish turlari|Bugungi barcha ish turlarini tanlang. Tegishli va umumiy TBM ko‘rsatiladi.|Saqlash|Ish turlarini o‘zgartirish|Boshqa TBM (ixtiyoriy)|Butun obyekt|Yuklash yoki saqlash amalga oshmadi. Qayta urining.|Qayta urinish|Bekor qilish",
  ph: "Mga trabaho ngayong araw|Piliin ang lahat ng trabaho ngayon. Ipapakita ang kaugnay at pangkalahatang TBM.|I-save|Baguhin ang mga trabaho|Ibang TBM (opsyonal)|Buong lugar|Hindi ma-load o ma-save. Subukang muli.|Subukang muli|Kanselahin",
  km: "ប្រភេទការងារថ្ងៃនេះ|ជ្រើសរើសការងារទាំងអស់ថ្ងៃនេះ ដើម្បីមើល TBM ពាក់ព័ន្ធ និងរួម។|រក្សាទុក|ប្តូរការងារថ្ងៃនេះ|TBM ការងារផ្សេង (ជាជម្រើស)|ការដ្ឋានទាំងមូល|មិនអាចផ្ទុកឬរក្សាទុកបាន។ សូមព្យាយាមម្តងទៀត។|ព្យាយាមម្តងទៀត|បោះបង់",
  id: "Jenis pekerjaan hari ini|Pilih semua pekerjaan hari ini. TBM terkait dan seluruh lokasi akan ditampilkan.|Simpan|Ubah pekerjaan hari ini|TBM pekerjaan lain (opsional)|Seluruh lokasi|Gagal memuat atau menyimpan. Coba lagi.|Coba lagi|Batal",
  mn: "Өнөөдрийн ажлын төрөл|Өнөөдрийн бүх ажлаа сонгоно уу. Холбогдох болон нийт талбайн TBM харагдана.|Хадгалах|Ажлын төрлийг өөрчлөх|Бусад ажлын TBM (сонголтоор)|Нийт талбай|Унших эсвэл хадгалах боломжгүй. Дахин оролдоно уу.|Дахин оролдох|Цуцлах",
  my: "ယနေ့အလုပ်အမျိုးအစား|ယနေ့လုပ်မည့်အလုပ်အားလုံးကို ရွေးပါ။ သက်ဆိုင်ရာနှင့် လုပ်ငန်းခွင်တစ်ခုလုံး TBM ကို ပြသမည်။|သိမ်းဆည်း|ယနေ့အလုပ်ပြောင်းရန်|အခြားအလုပ် TBM (ရွေးချယ်ကြည့်ရန်)|လုပ်ငန်းခွင်တစ်ခုလုံး|ဖတ်ခြင်း သို့မဟုတ် သိမ်းခြင်း မအောင်မြင်ပါ။ ပြန်ကြိုးစားပါ။|ပြန်ကြိုးစား|ပယ်ဖျက်",
  ne: "आजको कामको प्रकार|आजका सबै काम छान्नुहोस्। सम्बन्धित र कार्यस्थलका साझा TBM देखाइन्छ।|सुरक्षित गर्नुहोस्|आजको काम परिवर्तन|अन्य कामका TBM (वैकल्पिक)|सम्पूर्ण कार्यस्थल|लोड वा सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।|फेरि प्रयास|रद्द",
  bn: "আজকের কাজের ধরন|আজকের সব কাজ বেছে নিন। সংশ্লিষ্ট ও সবার জন্য TBM দেখানো হবে।|সংরক্ষণ|আজকের কাজ বদলান|অন্য কাজের TBM (ঐচ্ছিক)|পুরো কর্মস্থল|লোড বা সংরক্ষণ হয়নি। আবার চেষ্টা করুন।|আবার চেষ্টা|বাতিল",
  kk: "Бүгінгі жұмыс түрлері|Бүгінгі барлық жұмысты таңдаңыз. Қатысты және жалпы TBM көрсетіледі.|Сақтау|Жұмыс түрлерін өзгерту|Басқа TBM (қосымша)|Бүкіл нысан|Жүктеу не сақтау сәтсіз. Қайталап көріңіз.|Қайталау|Бас тарту",
  ru: "Виды работ сегодня|Выберите все работы на сегодня. Будут показаны соответствующие и общие TBM.|Сохранить|Изменить работы|Другие TBM (по желанию)|Весь объект|Не удалось загрузить или сохранить. Повторите попытку.|Повторить|Отмена",
  fr: "Métiers du jour|Sélectionnez tous vos métiers du jour pour voir les TBM concernés et communs.|Enregistrer|Modifier les métiers|Autres TBM (facultatifs)|Tout le chantier|Chargement ou enregistrement impossible. Réessayez.|Réessayer|Annuler",
  es: "Oficios de hoy|Seleccione todos sus oficios de hoy para ver los TBM correspondientes y comunes.|Guardar|Cambiar oficios|Otros TBM (opcionales)|Toda la obra|No se pudo cargar o guardar. Inténtelo de nuevo.|Reintentar|Cancelar",
  ar: "أعمال اليوم|اختر جميع أعمالك اليوم لعرض تعليمات TBM المناسبة والمشتركة للموقع.|حفظ|تغيير أعمال اليوم|تعليمات أعمال أخرى (اختياري)|الموقع بالكامل|تعذر التحميل أو الحفظ. حاول مجدداً.|إعادة المحاولة|إلغاء",
  hi: "आज के कार्य प्रकार|आज के सभी काम चुनें। संबंधित और पूरे स्थल के TBM दिखेंगे।|सहेजें|आज के काम बदलें|अन्य TBM (वैकल्पिक)|पूरा कार्यस्थल|लोड या सहेजा नहीं जा सका। फिर कोशिश करें।|फिर कोशिश|रद्द",
};
export function dailyTradeUI(lang: string) {
  const [title, description, save, change, other, common, error, retry, cancel] = texts[tbmLanguage(lang)].split("|");
  return { title, description, save, change, other, common, error, retry, cancel };
}
