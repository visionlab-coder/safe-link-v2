const labels: Record<string, readonly [string, string, string, string]> = {
  "ko": [
    "요약본 (수정 가능)",
    "마지막 음성을 처리하고 요약하고 있습니다…",
    "요약을 생성하지 못했습니다. 초안은 유지됩니다.",
    "요약 다시 생성"
  ],
  "en": [
    "Summary (editable)",
    "Processing final speech and summarizing…",
    "Could not generate a summary. Your draft is retained.",
    "Regenerate summary"
  ],
  "zh": [
    "摘要（可编辑）",
    "正在处理最后的语音并生成摘要…",
    "无法生成摘要，草稿已保留。",
    "重新生成摘要"
  ],
  "vi": [
    "Tóm tắt (có thể sửa)",
    "Đang xử lý lời nói cuối và tóm tắt…",
    "Không thể tạo tóm tắt. Bản nháp vẫn được giữ lại.",
    "Tạo lại tóm tắt"
  ],
  "km": [
    "សេចក្តីសង្ខេប (អាចកែបាន)",
    "កំពុងដំណើរការសំឡេងចុងក្រោយ និងសង្ខេប…",
    "មិនអាចបង្កើតសេចក្តីសង្ខេបបានទេ។ សេចក្តីព្រាងនៅរក្សាទុក។",
    "បង្កើតសេចក្តីសង្ខេបឡើងវិញ"
  ],
  "th": [
    "สรุป (แก้ไขได้)",
    "กำลังประมวลผลเสียงสุดท้ายและสรุป…",
    "สร้างสรุปไม่สำเร็จ ยังคงเก็บฉบับร่างไว้",
    "สร้างสรุปอีกครั้ง"
  ],
  "id": [
    "Ringkasan (dapat diedit)",
    "Memproses ucapan terakhir dan meringkas…",
    "Ringkasan gagal dibuat. Draf tetap disimpan.",
    "Buat ulang ringkasan"
  ],
  "uz": [
    "Xulosa (tahrirlash mumkin)",
    "Oxirgi nutq qayta ishlanmoqda va umumlashtirilmoqda…",
    "Xulosa yaratilmadi. Qoralama saqlanadi.",
    "Xulosani qayta yaratish"
  ],
  "ph": [
    "Buod (maaaring i-edit)",
    "Pinoproseso ang huling sinabi at binubuod…",
    "Hindi mabuo ang buod. Nananatili ang draft.",
    "Buuin muli ang buod"
  ],
  "mn": [
    "Хураангуй (засах боломжтой)",
    "Сүүлийн яриаг боловсруулж, хураангуйлж байна…",
    "Хураангуй үүсгэж чадсангүй. Ноорог хадгалагдсан.",
    "Хураангуйг дахин үүсгэх"
  ],
  "my": [
    "အကျဉ်းချုပ် (ပြင်ဆင်နိုင်သည်)",
    "နောက်ဆုံးစကားကို စီမံပြီး အကျဉ်းချုပ်နေသည်…",
    "အကျဉ်းချုပ် မဖန်တီးနိုင်ပါ။ မူကြမ်းကို ထိန်းသိမ်းထားသည်။",
    "အကျဉ်းချုပ် ပြန်ဖန်တီးရန်"
  ],
  "ne": [
    "सारांश (सम्पादन गर्न मिल्ने)",
    "अन्तिम बोली प्रशोधन गर्दै सारांश बनाउँदै…",
    "सारांश बनाउन सकिएन। मस्यौदा सुरक्षित छ।",
    "सारांश फेरि बनाउनुहोस्"
  ],
  "bn": [
    "সারসংক্ষেপ (সম্পাদনাযোগ্য)",
    "শেষ বক্তব্য প্রক্রিয়াকরণ ও সারসংক্ষেপ তৈরি হচ্ছে…",
    "সারসংক্ষেপ তৈরি হয়নি। খসড়া রাখা হয়েছে।",
    "আবার সারসংক্ষেপ তৈরি করুন"
  ],
  "kk": [
    "Қорытынды (өңдеуге болады)",
    "Соңғы сөз өңделіп, қорытынды жасалуда…",
    "Қорытынды жасалмады. Жоба сақталды.",
    "Қорытындыны қайта жасау"
  ],
  "ru": [
    "Итог (можно редактировать)",
    "Обработка последних слов и создание итога…",
    "Не удалось создать итог. Черновик сохранён.",
    "Создать итог повторно"
  ],
  "jp": [
    "要約（編集可能）",
    "最後の音声を処理して要約しています…",
    "要約を生成できませんでした。下書きは保持されています。",
    "要約を再生成"
  ],
  "fr": [
    "Résumé (modifiable)",
    "Traitement des derniers propos et résumé…",
    "Impossible de générer le résumé. Le brouillon est conservé.",
    "Régénérer le résumé"
  ],
  "es": [
    "Resumen (editable)",
    "Procesando las últimas palabras y resumiendo…",
    "No se pudo generar el resumen. El borrador se conserva.",
    "Regenerar resumen"
  ],
  "ar": [
    "الملخص (قابل للتعديل)",
    "جارٍ معالجة الكلام الأخير وتلخيصه…",
    "تعذر إنشاء الملخص. تم الاحتفاظ بالمسودة.",
    "إعادة إنشاء الملخص"
  ],
  "hi": [
    "सारांश (संपादन योग्य)",
    "अंतिम बात संसाधित करके सारांश बनाया जा रहा है…",
    "सारांश नहीं बन सका। मसौदा सुरक्षित है।",
    "सारांश फिर बनाएँ"
  ]
};
export function tbmDraftSummaryUI(lang: string) {
  const [title, busy, failed, retry] = labels[lang] || labels.en;
  return { title, busy, failed, retry };
}
