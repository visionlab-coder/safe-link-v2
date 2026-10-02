const copy: Record<string, { start: string; busy: string; done: string; retry: string; failed: string; read: string }> = {
  ko: { start: "TBM 실시간 방송 · 종료 후 자동 요약", busy: "마지막 음성을 저장하고 요약본을 전송하는 중입니다…", done: "요약본을 TBM으로 전송했습니다.", retry: "요약 전송 다시 시도", failed: "요약본을 전송하지 못했습니다. 원문은 보존되며 다시 시도할 수 있습니다.", read: "TBM 요약 확인 및 서명" },
  en: { start: "Live TBM · summarize when finished", busy: "Saving the final speech and sending the summary…", done: "Summary published as a TBM.", retry: "Retry summary delivery", failed: "Summary was not delivered. Saved transcripts are retained; please retry.", read: "Read TBM summary and sign" },
  zh: { start: "TBM 直播 · 结束后自动总结", busy: "正在保存最后的语音并发送摘要…", done: "摘要已作为 TBM 发布。", retry: "重新发送摘要", failed: "摘要未发送。已保存的原文会保留，请重试。", read: "查看 TBM 摘要并签名" },
  vi: { start: "TBM trực tiếp · tóm tắt khi kết thúc", busy: "Đang lưu lời nói cuối và gửi tóm tắt…", done: "Đã gửi bản tóm tắt TBM.", retry: "Thử gửi lại bản tóm tắt", failed: "Chưa gửi được tóm tắt. Bản gốc đã lưu được giữ lại, vui lòng thử lại.", read: "Đọc tóm tắt TBM và ký" },
  km: { start: "TBM ផ្ទាល់ · សង្ខេបពេលបញ្ចប់", busy: "កំពុងរក្សាទុកសំឡេងចុងក្រោយ និងផ្ញើសេចក្តីសង្ខេប…", done: "បានផ្ញើសេចក្តីសង្ខេប TBM។", retry: "ព្យាយាមផ្ញើសេចក្តីសង្ខេបម្តងទៀត", failed: "មិនអាចផ្ញើសេចក្តីសង្ខេបបានទេ។ សូមព្យាយាមម្តងទៀត។", read: "អានសេចក្តីសង្ខេប TBM និងចុះហត្ថលេខា" },
th: {"start":"TBM สด · สรุปเมื่อจบ","busy":"กำลังบันทึกเสียงสุดท้ายและส่งสรุป…","done":"ส่งสรุป TBM แล้ว","retry":"ส่งสรุปอีกครั้ง","failed":"ส่งสรุปไม่สำเร็จ โปรดลองอีกครั้ง","read":"อ่านสรุป TBM และลงชื่อ"},
id: {"start":"TBM langsung · ringkasan setelah selesai","busy":"Menyimpan ucapan terakhir dan mengirim ringkasan…","done":"Ringkasan TBM telah dikirim.","retry":"Kirim ulang ringkasan","failed":"Ringkasan gagal dikirim. Silakan coba lagi.","read":"Baca ringkasan TBM dan tanda tangani"},
uz: {"start":"Jonli TBM · yakunda xulosa","busy":"Oxirgi nutq saqlanmoqda va xulosa yuborilmoqda…","done":"TBM xulosasi yuborildi.","retry":"Xulosani qayta yuborish","failed":"Xulosa yuborilmadi. Qayta urinib ko‘ring.","read":"TBM xulosasini o‘qish va imzolash"},
ph: {"start":"Live TBM · buod pagkatapos","busy":"Sine-save ang huling sinabi at ipinapadala ang buod…","done":"Naipadala na ang buod ng TBM.","retry":"Ipadala muli ang buod","failed":"Hindi naipadala ang buod. Subukan muli.","read":"Basahin ang buod ng TBM at lumagda"},
mn: {"start":"Шууд TBM · дуусмагц хураангуйлах","busy":"Сүүлийн яриаг хадгалж, хураангуйг илгээж байна…","done":"TBM хураангуйг илгээлээ.","retry":"Хураангуйг дахин илгээх","failed":"Хураангуйг илгээж чадсангүй. Дахин оролдоно уу.","read":"TBM хураангуйг уншиж гарын үсэг зурах"},
my: {"start":"တိုက်ရိုက် TBM · ပြီးဆုံးလျှင် အကျဉ်းချုပ်","busy":"နောက်ဆုံးစကားကို သိမ်းပြီး အကျဉ်းချုပ် ပို့နေသည်…","done":"TBM အကျဉ်းချုပ် ပို့ပြီးပါပြီ။","retry":"အကျဉ်းချုပ် ပြန်ပို့ရန်","failed":"အကျဉ်းချုပ် မပို့နိုင်ပါ။ ထပ်ကြိုးစားပါ။","read":"TBM အကျဉ်းချုပ်ဖတ်ပြီး လက်မှတ်ထိုးရန်"},
ne: {"start":"प्रत्यक्ष TBM · सकिएपछि सारांश","busy":"अन्तिम बोली सुरक्षित गर्दै सारांश पठाउँदै…","done":"TBM सारांश पठाइयो।","retry":"सारांश फेरि पठाउनुहोस्","failed":"सारांश पठाउन सकिएन। फेरि प्रयास गर्नुहोस्।","read":"TBM सारांश पढेर हस्ताक्षर गर्नुहोस्"},
bn: {"start":"সরাসরি TBM · শেষে সারসংক্ষেপ","busy":"শেষ বক্তব্য সংরক্ষণ এবং সারসংক্ষেপ পাঠানো হচ্ছে…","done":"TBM সারসংক্ষেপ পাঠানো হয়েছে।","retry":"সারসংক্ষেপ আবার পাঠান","failed":"সারসংক্ষেপ পাঠানো যায়নি। আবার চেষ্টা করুন।","read":"TBM সারসংক্ষেপ পড়ে স্বাক্ষর করুন"},
kk: {"start":"Тікелей TBM · соңында қорытынды","busy":"Соңғы сөз сақталып, қорытынды жіберілуде…","done":"TBM қорытындысы жіберілді.","retry":"Қорытындыны қайта жіберу","failed":"Қорытынды жіберілмеді. Қайталап көріңіз.","read":"TBM қорытындысын оқып, қол қою"},
ru: {"start":"Прямой TBM · итог после завершения","busy":"Сохраняем последние слова и отправляем итог…","done":"Итог TBM отправлен.","retry":"Отправить итог повторно","failed":"Не удалось отправить итог. Повторите попытку.","read":"Прочитать итог TBM и подписать"},
jp: {"start":"TBMライブ · 終了後に自動要約","busy":"最後の音声を保存し、要約を送信しています…","done":"TBMの要約を送信しました。","retry":"要約の送信を再試行","failed":"要約を送信できませんでした。再試行してください。","read":"TBM要約を確認して署名"},
fr: {"start":"TBM en direct · résumé à la fin","busy":"Enregistrement des derniers propos et envoi du résumé…","done":"Résumé TBM envoyé.","retry":"Réessayer l’envoi","failed":"Le résumé n’a pas été envoyé. Réessayez.","read":"Lire le résumé TBM et signer"},
es: {"start":"TBM en directo · resumen al finalizar","busy":"Guardando las últimas palabras y enviando el resumen…","done":"Resumen TBM enviado.","retry":"Reintentar el envío","failed":"No se pudo enviar el resumen. Inténtelo de nuevo.","read":"Leer el resumen TBM y firmar"},
ar: {"start":"بث TBM مباشر · ملخص عند الانتهاء","busy":"جارٍ حفظ الكلام الأخير وإرسال الملخص…","done":"تم إرسال ملخص TBM.","retry":"إعادة إرسال الملخص","failed":"تعذر إرسال الملخص. يرجى المحاولة مجددًا.","read":"قراءة ملخص TBM والتوقيع"},
hi: {"start":"लाइव TBM · समाप्ति पर सारांश","busy":"अंतिम बात सहेजकर सारांश भेजा जा रहा है…","done":"TBM सारांश भेज दिया गया।","retry":"सारांश फिर से भेजें","failed":"सारांश नहीं भेजा जा सका। फिर कोशिश करें।","read":"TBM सारांश पढ़ें और हस्ताक्षर करें"},
};
export function tbmSummaryUI(lang: string) { return copy[lang] || copy.en; }

const publicationWaiting: Record<string, string> = {
  ko: "방송이 종료되었습니다. 관리자가 최종 TBM을 전파하면 요약 확인 후 서명할 수 있습니다.",
  en: "The live broadcast has ended. Once the administrator publishes the final TBM, review the summary and sign.",
  zh: "直播已结束。管理员发布最终 TBM 后，请查看摘要并签名。",
  vi: "Buổi phát trực tiếp đã kết thúc. Khi quản lý gửi TBM cuối cùng, hãy đọc tóm tắt và ký.",
  km: "ការផ្សាយផ្ទាល់បានបញ្ចប់។ បន្ទាប់ពីអ្នកគ្រប់គ្រងផ្ញើ TBM ចុងក្រោយ សូមអានសេចក្តីសង្ខេប និងចុះហត្ថលេខា។",
  th: "การถ่ายทอดสดสิ้นสุดแล้ว เมื่อผู้ดูแลส่ง TBM ฉบับสุดท้าย โปรดอ่านสรุปและลงชื่อ",
  id: "Siaran langsung selesai. Setelah admin mengirim TBM akhir, baca ringkasan dan tanda tangani.",
  uz: "Jonli efir tugadi. Administrator yakuniy TBMni yuborgach, xulosani o‘qing va imzolang.",
  ph: "Tapos na ang live broadcast. Kapag ipinadala ng admin ang huling TBM, basahin ang buod at pumirma.",
  mn: "Шууд нэвтрүүлэг дууслаа. Администратор эцсийн TBM-ийг илгээсний дараа хураангуйг уншиж гарын үсэг зурна уу.",
  my: "တိုက်ရိုက်ထုတ်လွှင့်မှု ပြီးဆုံးပါပြီ။ စီမံခန့်ခွဲသူက နောက်ဆုံး TBM ပို့ပြီးနောက် အကျဉ်းချုပ်ကိုဖတ်၍ လက်မှတ်ထိုးပါ။",
  ne: "प्रत्यक्ष प्रसारण सकियो। प्रशासकले अन्तिम TBM पठाएपछि सारांश पढेर हस्ताक्षर गर्नुहोस्।",
  bn: "সরাসরি সম্প্রচার শেষ হয়েছে। প্রশাসক চূড়ান্ত TBM পাঠালে সারসংক্ষেপ পড়ে স্বাক্ষর করুন।",
  kk: "Тікелей эфир аяқталды. Әкімші соңғы TBM жібергеннен кейін қорытындыны оқып, қол қойыңыз.",
  ru: "Прямой эфир завершён. После отправки итогового TBM администратором прочитайте сводку и подпишите.",
  jp: "ライブ配信が終了しました。管理者が最終TBMを送信したら、要約を確認して署名してください。",
  fr: "Le direct est terminé. Après l’envoi du TBM final par l’administrateur, lisez le résumé et signez.",
  es: "La transmisión terminó. Cuando el administrador envíe el TBM final, revise el resumen y firme.",
  ar: "انتهى البث المباشر. بعد أن يرسل المسؤول TBM النهائي، اقرأ الملخص ووقّع.",
  hi: "लाइव प्रसारण समाप्त हो गया है। व्यवस्थापक के अंतिम TBM भेजने के बाद सारांश पढ़ें और हस्ताक्षर करें।",
};
export function tbmPublicationWaitingUI(lang: string) { return publicationWaiting[lang] || publicationWaiting.en; }

const liveState: Record<string, [string, string]> = {
  ko: ["방송 중", "최종 전파 대기"], en: ["Live", "Awaiting final TBM"],
  zh: ["直播中", "等待最终 TBM"], vi: ["Đang phát trực tiếp", "Chờ TBM cuối cùng"],
  km: ["កំពុងផ្សាយផ្ទាល់", "កំពុងរង់ចាំ TBM ចុងក្រោយ"],
  th: ["กำลังถ่ายทอดสด", "รอ TBM ฉบับสุดท้าย"], id: ["Siaran langsung", "Menunggu TBM akhir"],
  uz: ["Jonli efir", "Yakuniy TBM kutilmoqda"], ph: ["Live", "Hinihintay ang huling TBM"],
  mn: ["Шууд дамжуулж байна", "Эцсийн TBM-ийг хүлээж байна"],
  my: ["တိုက်ရိုက်ထုတ်လွှင့်နေသည်", "နောက်ဆုံး TBM ကို စောင့်နေသည်"],
  ne: ["प्रत्यक्ष प्रसारण", "अन्तिम TBM को प्रतीक्षामा"], bn: ["সরাসরি সম্প্রচার", "চূড়ান্ত TBM-এর অপেক্ষায়"],
  kk: ["Тікелей эфир", "Соңғы TBM күтілуде"], ru: ["Прямой эфир", "Ожидание итогового TBM"],
  jp: ["配信中", "最終TBMの配信待ち"], fr: ["En direct", "En attente du TBM final"],
  es: ["En directo", "Esperando el TBM final"], ar: ["بث مباشر", "بانتظار TBM النهائي"],
  hi: ["लाइव प्रसारण", "अंतिम TBM की प्रतीक्षा"],
};
export function tbmLiveStateUI(lang: string) {
  const [live, pending] = liveState[lang] || liveState.en;
  return { live, pending };
}
