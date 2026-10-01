/** Identity comes from the authenticated TBM/live API, never from site-list order. */
export function tbmAdminId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = String(value);
  return /^[1-9]\d*$/.test(id) ? id : null;
}

export function tbmChatHref(adminId: unknown, tbmId: string, lang: string): string | null {
  const id = tbmAdminId(adminId);
  if (!id) return null;
  return "/worker/chat?" + new URLSearchParams({ admin_id: id, tbm_id: tbmId, lang });
}

export function tbmReturnHref(tbmId: string | null, lang: string): string | null {
  if (!tbmId || (tbmId !== "today" && !tbmAdminId(tbmId))) return null;
  return `/worker/tbm/${tbmId}?` + new URLSearchParams({ lang });
}

export function findTbmChatAdmin<T extends { id: string }>(admins: T[], requestedId: unknown): T | null {
  const id = tbmAdminId(requestedId);
  return id ? admins.find(admin => admin.id === id) ?? null : null;
}

// [question button, unavailable recipient, return link]
const labels: Record<string, readonly [string, string, string]> = {
  ko: ["관리자에게 질문하기", "이 TBM의 관리자와 대화를 연결할 수 없습니다. 현장 관리자에게 문의해 주세요.", "TBM으로 돌아가기"],
  en: ["Ask the administrator", "Chat with this TBM's administrator is unavailable. Please contact your site administrator.", "Back to TBM"],
  zh: ["向管理员提问", "无法与此TBM的管理员聊天，请联系现场管理员。", "返回TBM"],
  vi: ["Hỏi quản trị viên", "Không thể trò chuyện với quản trị viên của TBM này. Vui lòng liên hệ quản trị viên công trường.", "Quay lại TBM"],
  km: ["សួរអ្នកគ្រប់គ្រង", "មិនអាចជជែកជាមួយអ្នកគ្រប់គ្រង TBM នេះបានទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រងការដ្ឋាន។", "ត្រឡប់ទៅ TBM"],
  th: ["ถามผู้ดูแล", "ไม่สามารถแชทกับผู้ดูแล TBM นี้ได้ โปรดติดต่อผู้ดูแลหน้างาน", "กลับไปที่ TBM"],
  id: ["Tanya administrator", "Tidak dapat mengobrol dengan administrator TBM ini. Hubungi administrator lokasi.", "Kembali ke TBM"],
  my: ["စီမံခန့်ခွဲသူကို မေးရန်", "ဤ TBM ၏ စီမံခန့်ခွဲသူနှင့် စကားပြော၍ မရပါ။ လုပ်ငန်းခွင် စီမံခန့်ခွဲသူကို ဆက်သွယ်ပါ။", "TBM သို့ ပြန်သွားရန်"],
  ne: ["व्यवस्थापकलाई सोध्नुहोस्", "यस TBM का व्यवस्थापकसँग कुराकानी गर्न सकिँदैन। कार्यस्थलका व्यवस्थापकलाई सम्पर्क गर्नुहोस्।", "TBM मा फर्कनुहोस्"],
  bn: ["প্রশাসককে প্রশ্ন করুন", "এই TBM-এর প্রশাসকের সঙ্গে চ্যাট করা যাচ্ছে না। কর্মস্থলের প্রশাসকের সঙ্গে যোগাযোগ করুন।", "TBM-এ ফিরে যান"],
  hi: ["प्रबंधक से पूछें", "इस TBM के प्रबंधक से चैट उपलब्ध नहीं है। कृपया कार्यस्थल के प्रबंधक से संपर्क करें।", "TBM पर वापस जाएँ"],
  uz: ["Administratorga savol berish", "Ushbu TBM administratori bilan suhbatlashib bo‘lmaydi. Ish joyi administratoriga murojaat qiling.", "TBMga qaytish"],
  ph: ["Magtanong sa administrador", "Hindi makausap ang administrador ng TBM na ito. Makipag-ugnayan sa administrador ng lugar.", "Bumalik sa TBM"],
  mn: ["Администратороос асуух", "Энэ TBM-ийн администратортой чатлах боломжгүй. Талбайн администраторт хандана уу.", "TBM рүү буцах"],
  kk: ["Әкімшіге сұрақ қою", "Осы TBM әкімшісімен сөйлесу мүмкін емес. Нысан әкімшісіне хабарласыңыз.", "TBM-ге оралу"],
  ru: ["Задать вопрос администратору", "Чат с администратором этого TBM недоступен. Обратитесь к администратору объекта.", "Вернуться к TBM"],
  jp: ["管理者に質問する", "このTBMの管理者とチャットできません。現場の管理者にお問い合わせください。", "TBMに戻る"],
  fr: ["Poser une question à l’administrateur", "Le chat avec l’administrateur de ce TBM est indisponible. Contactez l’administrateur du chantier.", "Retour au TBM"],
  es: ["Preguntar al administrador", "El chat con el administrador de este TBM no está disponible. Contacte al administrador de la obra.", "Volver al TBM"],
  ar: ["اسأل المسؤول", "الدردشة مع مسؤول هذا الاجتماع غير متاحة. يُرجى التواصل مع مسؤول الموقع.", "العودة إلى TBM"],
};

export function tbmChatUI(lang: string) {
  const code = ({ ja: "jp", tl: "ph", fil: "ph", "zh-CN": "zh" } as Record<string, string>)[lang] ?? lang;
  const [ask, unavailable, back] = labels[code] ?? labels.en;
  return { ask, unavailable, back };
}
