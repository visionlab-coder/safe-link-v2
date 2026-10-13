const labels: Record<string, string> = {
  ko: "TBM 작성 · 전파", en: "Create & broadcast TBM", zh: "创建并发布 TBM", vi: "Soạn và phát TBM",
  th: "สร้างและเผยแพร่ TBM", uz: "TBM yaratish va tarqatish", id: "Buat dan siarkan TBM", ja: "TBMを作成・配信",
  ph: "Gumawa at mag-broadcast ng TBM", km: "បង្កើត និងផ្សាយ TBM", mn: "TBM үүсгэж дамжуулах",
  my: "TBM ဖန်တီးပြီး ထုတ်လွှင့်ရန်", ne: "TBM तयार गरी प्रसारण गर्नुहोस्", bn: "TBM তৈরি ও সম্প্রচার করুন",
  kk: "TBM құру және тарату", ru: "Создать и передать TBM", fr: "Créer et diffuser un TBM",
  es: "Crear y transmitir TBM", ar: "إنشاء وبث TBM", hi: "TBM बनाएँ और प्रसारित करें",
};
export const tbmPublishLabel = (language: string) => labels[language === "jp" ? "ja" : language] || labels.en;
