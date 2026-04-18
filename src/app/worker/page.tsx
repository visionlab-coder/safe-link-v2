"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import SwarmAgentHUD from "@/components/agents/SwarmAgentHUD";
import { playNotificationSound } from "@/utils/notifications";

const workerUI: Record<string, any> = {
    ko: {
        greeting: (name: string) => `반갑습니다, ${name}님`,
        tbmBadge: "금일 안전 지침 (TBM)",
        tbmDesc: "작업 투입 전, 반드시 확인하고 서명해야 하는 안전 수칙이 도착했습니다.",
        tbmBtn: "확인 및 서명하기",
        newTBM: "🚨 새 안전 지침이 도착했습니다!",
        chatTitle: "실시간 대화",
        chatDesc: "버튼을 눌러 관리자와 대화할 수 있습니다.",
        chatBtn: "채널 열기",
        signOut: "로그아웃",
        safeWork: "오늘도 안전하게!",
        status: "작업 준비 상태",
        newChat: "🚨 관리자가 대화를 요청했습니다!",
        openChat: "대화방 입장",
        stopWork: "작업 중지",
        stopWorkDesc: "위험을 느끼면 즉시 누르세요",
        stopWorkFamily: "당신의 생명과 가족이 가장 소중합니다",
        stopWorkConfirm: "작업중지 요청이 전송되었습니다",
        stopWorkCancel: "취소",
        stopWorkSend: "작업중지 요청 전송",
        stopWorkReason: "위험 상황을 간단히 설명해주세요",
        visionTitle: "AI 위험 감지",
        visionDesc: "사진으로 현장 위험을 AI가 분석합니다",
        quizTitle: "안전 퀴즈",
        quizDesc: "안전 교육 퀴즈에 참여하세요",
        liveTitle: "실시간 통역",
        liveDesc: "관리자의 말을 실시간으로 통역합니다",
    },
    en: {
        greeting: (name: string) => `Welcome, ${name}`,
        tbmBadge: "Today's Safety (TBM)",
        tbmDesc: "Safety instructions have arrived. Please review and sign before starting work.",
        tbmBtn: "View & Sign",
        newTBM: "🚨 New Safety Alert!",
        chatTitle: "Live Chat",
        chatDesc: "Tap to chat with admin.",
        chatBtn: "Open Chat",
        signOut: "Sign out",
        safeWork: "Work Safe Today!",
        status: "Status",
        newChat: "🚨 Admin requested a chat!",
        openChat: "Enter Chat",
        stopWork: "STOP WORK",
        stopWorkDesc: "Press immediately if you sense danger",
        stopWorkFamily: "Your life and your family matter most",
        stopWorkConfirm: "Stop work request has been sent",
        stopWorkCancel: "Cancel",
        stopWorkSend: "Send Stop Work Request",
        stopWorkReason: "Briefly describe the danger",
        visionTitle: "AI HAZARD SCAN",
        visionDesc: "AI analyzes site hazards from photos",
        quizTitle: "SAFETY QUIZ",
        quizDesc: "Take the safety training quiz",
        liveTitle: "LIVE INTERPRETER",
        liveDesc: "Real-time interpretation of admin speech",
    },
    zh: {
        greeting: (name: string) => `您好, ${name}`,
        tbmBadge: "今日安全 (TBM)",
        tbmDesc: "安全简报已送达。请在开始工作前阅读并签名。",
        tbmBtn: "确认并签名",
        newTBM: "🚨 收到新的安全警报！",
        chatTitle: "实时聊天",
        chatDesc: "点击即可与管理员（Admin）聊天。",
        chatBtn: "打开频道",
        signOut: "退出",
        safeWork: "祝您今天工作安全！",
        status: "状态",
        newChat: "🚨 管理员请求与您对话！",
        openChat: "进入聊天",
        stopWork: "停止作业",
        stopWorkDesc: "如果感到危险，请立即按下",
        stopWorkFamily: "您的生命和家人最重要",
        stopWorkConfirm: "停工请求已发送",
        stopWorkCancel: "取消",
        stopWorkSend: "发送停工请求",
        stopWorkReason: "请简要描述危险情况",
        visionTitle: "AI危险检测",
        visionDesc: "AI通过照片分析现场危险",
        quizTitle: "安全测验",
        quizDesc: "参加安全培训测验",
        liveTitle: "实时翻译",
        liveDesc: "实时翻译管理员讲话",
    },
    vi: {
        greeting: (name: string) => `Chào mừng, ${name}`,
        tbmBadge: "Chỉ dẫn an toàn (TBM)",
        tbmDesc: "Đã có chỉ dẫn an toàn. Vui lòng xem và ký trước khi làm việc.",
        tbmBtn: "Xem và Ký",
        newTBM: "🚨 Cảnh báo an toàn mới!",
        chatTitle: "Trò chuyện",
        chatDesc: "Nhấn để trò chuyện với quản trị viên.",
        chatBtn: "Mo ho tro",
        signOut: "Đăng xuất",
        safeWork: "Làm việc an toàn hôm nay!",
        status: "Trạng thái",
        newChat: "🚨 Quản trị viên muốn trò chuyện!",
        openChat: "Vào trò chuyện",
        stopWork: "DỪNG CÔNG VIỆC",
        stopWorkDesc: "Nhấn ngay nếu bạn cảm thấy nguy hiểm",
        stopWorkFamily: "Cuộc sống và gia đình bạn là quan trọng nhất",
        stopWorkConfirm: "Yêu cầu dừng công việc đã được gửi",
        stopWorkCancel: "Hủy",
        stopWorkSend: "Gửi yêu cầu dừng việc",
        stopWorkReason: "Mô tả ngắn gọn tình huống nguy hiểm",
        visionTitle: "AI PHÁT HIỆN",
        visionDesc: "AI phân tích nguy hiểm qua ảnh",
        quizTitle: "BÀI KIỂM TRA",
        quizDesc: "Tham gia bài kiểm tra an toàn",
        liveTitle: "PHIÊN DỊCH",
        liveDesc: "Phiên dịch trực tiếp lời quản trị viên",
    },
    th: {
        greeting: (name: string) => `ยินดีต้อนรับ, ${name}`,
        tbmBadge: "คำแนะนำความปลอดภัย (TBM)",
        tbmDesc: "มีคำแนะนำความปลอดภัยมาถึงแล้ว โปรดตรวจสอบและลงนามก่อนเริ่มงาน",
        tbmBtn: "ดูและลงนาม",
        newTBM: "🚨 การแจ้งเตือนใหม่!",
        chatTitle: "แชทสด",
        chatDesc: "แตะเพื่อพูดคุยกับผู้ดูแล",
        chatBtn: "เปิดแชท",
        signOut: "ออกจากระบบ",
        safeWork: "ทำงานอย่างปลอดภัยวันนี้!",
        status: "สถานะ",
        newChat: "🚨 ผู้ดูแลระบบขอแชท!",
        openChat: "เข้าสู่แชท",
        stopWork: "หยุดงาน",
        stopWorkDesc: "กดทันทีหากคุณรู้สึกอันตราย",
        stopWorkFamily: "ชีวิตและครอบครัวของคุณสำคัญที่สุด",
        stopWorkConfirm: "ส่งคำขอหยุดงานแล้ว",
        stopWorkCancel: "ยกเลิก",
        stopWorkSend: "ส่งคำขอหยุดงาน",
        stopWorkReason: "อธิบายสถานการณ์อันตรายสั้นๆ",
        visionTitle: "AI ตรวจจับ",
        visionDesc: "AI วิเคราะห์อันตรายจากภาพ",
        quizTitle: "แบบทดสอบ",
        quizDesc: "ทำแบบทดสอบความปลอดภัย",
        liveTitle: "ล่ามสด",
        liveDesc: "แปลคำพูดผู้ดูแลแบบเรียลไทม์",
    },
    uz: {
        greeting: (name: string) => `Xush kelibsiz, ${name}`,
        tbmBadge: "Bugungi tahlika (TBM)",
        tbmDesc: "Xavfsizlik yo'riqnomalari keldi. Iltimos, ish boshlashdan oldin ko'rib chiqing va imzolang.",
        tbmBtn: "Ko'rish va imzolash",
        newTBM: "🚨 Yangi xavfsizlik ogohlantirishi!",
        chatTitle: "Jonli chat",
        chatDesc: "Admin bilan suhbatlashish uchun bosing.",
        chatBtn: "Chatni ochish",
        signOut: "Chiqish",
        safeWork: "Bugun xavfsiz ishlang!",
        status: "Holat",
        newChat: "🚨 Admin chat so'radi!",
        openChat: "Chatga kirish",
        stopWork: "ISHNI TO'XTATISH",
        stopWorkDesc: "Xavf sezsangiz darhol bosing",
        stopWorkFamily: "Hayotingiz va oilangiz eng muhim",
        stopWorkConfirm: "Ishni to'xtatish so'rovi yuborildi",
        stopWorkCancel: "Bekor qilish",
        stopWorkSend: "To'xtatish so'rovini yuborish",
        stopWorkReason: "Xavfli vaziyatni qisqacha tushuntiring",
        visionTitle: "AI XAVF",
        visionDesc: "AI suratlar orqali xavfni tahlil qiladi",
        quizTitle: "XAVFSIZLIK TESTI",
        quizDesc: "Xavfsizlik testida qatnashing",
        liveTitle: "JONLI TARJIMA",
        liveDesc: "Admin nutqini jonli tarjima",
    },
    ph: {
        greeting: (name: string) => `Maligayang pagdating, ${name}`,
        tbmBadge: "Kaligtasan Ngayon (TBM)",
        tbmDesc: "Dumating na ang mga tagubilin sa kaligtasan. Mangyaring suriin at lagdaan bago magsimulang magtrabaho.",
        tbmBtn: "Tingnan at Pirmahan",
        newTBM: "🚨 Bagong Alert sa Kaligtasan!",
        chatTitle: "Live Chat",
        chatDesc: "I-tap para makipag-chat sa admin.",
        chatBtn: "Buksan ang Chat",
        signOut: "Mag-sign out",
        safeWork: "Magtrabaho nang Ligtas Ngayon!",
        status: "Katayuan",
        newChat: "🚨 Humiling ng chat ang Admin!",
        openChat: "Pumasok sa Chat",
        stopWork: "ITIGIL ANG TRABAHO",
        stopWorkDesc: "Pindutin agad kung nakakaramdam ng panganib",
        stopWorkFamily: "Ang iyong buhay at pamilya ang pinakamahalaga",
        stopWorkConfirm: "Naipadala na ang kahilingan",
        stopWorkCancel: "Kanselahin",
        stopWorkSend: "Ipadala ang kahilingan",
        stopWorkReason: "Maikling ilarawan ang panganib",
        visionTitle: "AI HAZARD",
        visionDesc: "AI ang nag-aanalisa ng panganib",
        quizTitle: "SAFETY QUIZ",
        quizDesc: "Sumali sa safety quiz",
        liveTitle: "LIVE INTERPRETER",
        liveDesc: "Real-time na pagsasalin",
    },
    ru: {
        greeting: (name: string) => `Добро пожаловать, ${name}`,
        tbmBadge: "Безопасность сегодня (TBM)",
        tbmDesc: "Пришли инструкции по технике безопасности. Пожалуйста, прочтите и подпишите перед началом работы.",
        tbmBtn: "Посмотреть и подписать",
        newTBM: "🚨 Новое оповещение по безопасности!",
        chatTitle: "Живой чат",
        chatDesc: "Нажмите, чтобы пообщаться с админом.",
        chatBtn: "Открыть чат",
        signOut: "Выйти",
        safeWork: "Работайте безопасно сегодня!",
        status: "Статус",
        newChat: "🚨 Админ запрашивает чат!",
        openChat: "Войти в чат",
        stopWork: "ОСТАНОВИТЬ РАБОТУ",
        stopWorkDesc: "Нажмите немедленно при угрозе",
        stopWorkFamily: "Ваша жизнь и семья — самое важное",
        stopWorkConfirm: "Запрос на остановку отправлен",
        stopWorkCancel: "Отмена",
        stopWorkSend: "Отправить запрос",
        stopWorkReason: "Кратко опишите опасность",
        visionTitle: "AI АНАЛИЗ",
        visionDesc: "AI анализирует опасности по фото",
        quizTitle: "ТЕСТ",
        quizDesc: "Пройдите тест по безопасности",
        liveTitle: "СИНХРОННЫЙ ПЕРЕВОД",
        liveDesc: "Перевод речи в реальном времени",
    },
    jp: {
        greeting: (name: string) => `ようこそ、${name}さん`,
        tbmBadge: "本日の安全指示 (TBM)",
        tbmDesc: "安全指示が届きました。作業開始前に確認し、署名してください。",
        tbmBtn: "確認して署名する",
        newTBM: "🚨 新しい安全アラート！",
        chatTitle: "ライブチャット",
        chatDesc: "タップして管理者とチャットします。",
        chatBtn: "チャットを開く",
        signOut: "ログアウト",
        safeWork: "今日も一日安全に！",
        status: "ステータス",
        newChat: "🚨 管理者がチャットをリクエストしました！",
        openChat: "チャットに入る",
        stopWork: "作業停止",
        stopWorkDesc: "危険を感じたら直ちに押してください",
        stopWorkFamily: "あなたの命と家族が最も大切です",
        stopWorkConfirm: "作業停止リクエストが送信されました",
        stopWorkCancel: "キャンセル",
        stopWorkSend: "作業停止リクエスト送信",
        stopWorkReason: "危険な状況を簡単に説明してください",
        visionTitle: "AI危険検知",
        visionDesc: "AIが写真から現場の危険を分析します",
        quizTitle: "安全クイズ",
        quizDesc: "安全教育クイズに参加",
        liveTitle: "同時通訳",
        liveDesc: "管理者の発言をリアルタイム通訳",
    },
    km: {
        greeting: (name: string) => `សូមស្វាគមន៍, ${name}`,
        tbmBadge: "សុវត្ថិភាពថ្ងៃនេះ (TBM)",
        tbmDesc: "ការណែនាំសុវត្ថិភាពបានមកដល់។ សូមពិនិត្យ និងចុះហត្ថលេខាមុននឹងចាប់ផ្តើមការងារ។",
        tbmBtn: "មើល និងចុះហត្ថលេខា",
        newTBM: "🚨 ការជូនដំណឹងសុវត្ថិភាពថ្មី!",
        chatTitle: "ជជែក",
        chatDesc: "ចុចដើម្បីជជែកជាមួយអ្នកគ្រប់គ្រង",
        chatBtn: "បើកការជជែក",
        signOut: "ចាកចេញ",
        safeWork: "ធ្វើការដោយសុវត្ថិភាពថ្ងៃនេះ!",
        status: "ស្ថានភាព",
        newChat: "🚨 អ្នកគ្រប់គ្រងស្នើសុំការជជែក!",
        openChat: "ចូលការជជែក",
        stopWork: "ឈប់ការងារ",
        stopWorkDesc: "ចុចភ្លាមៗប្រសិនបើអ្នកមានអារម្មណ៍គ្រោះថ្នាក់",
        stopWorkFamily: "ជីវិត និងគ្រួសាររបស់អ្នកមានតម្លៃច្រើនបំផុត",
        stopWorkConfirm: "សំណើឈប់ការងារត្រូវបានផ្ញើ",
        stopWorkCancel: "បោះបង់",
        stopWorkSend: "ផ្ញើសំណើឈប់ការងារ",
        stopWorkReason: "ពិពណ៌នាអំពីស្ថានភាពគ្រោះថ្នាក់",
        visionTitle: "AI រកគ្រោះថ្នាក់",
        visionDesc: "AI វិភាគគ្រោះថ្នាក់ពីរូបថត",
        quizTitle: "តេស្តសុវត្ថិភាព",
        quizDesc: "ចូលរួមតេស្តការបណ្តុះបណ្តាលសុវត្ថិភាព",
        liveTitle: "បកប្រែផ្ទាល់",
        liveDesc: "បកប្រែជាក់ស្តែងនៃការផ្សាយរបស់អ្នកគ្រប់គ្រង",
    },
    mn: {
        greeting: (name: string) => `Тавтай морилно уу, ${name}`,
        tbmBadge: "Өнөөдрийн аюулгүй байдал (TBM)",
        tbmDesc: "Аюулгүй байдлын заавар ирлээ. Ажил эхлэхийн өмнө уншиж гарын үсэг зурна уу.",
        tbmBtn: "Үзэж гарын үсэг зурах",
        newTBM: "🚨 Шинэ аюулгүй байдлын сэрэмжлүүлэг!",
        chatTitle: "Чат",
        chatDesc: "Захиргаатай чатлахын тулд дарна уу.",
        chatBtn: "Чат нээх",
        signOut: "Гарах",
        safeWork: "Өнөөдөр аюулгүй ажиллаарай!",
        status: "Төлөв",
        newChat: "🚨 Захиргаа чат хүслэй!",
        openChat: "Чатад нэвтрэх",
        stopWork: "АЖЛАА ЗОГСОО",
        stopWorkDesc: "Аюул мэдэрвэл даруй дарна уу",
        stopWorkFamily: "Таны амь насны болон гэр бүлийн хамгийн чухал",
        stopWorkConfirm: "Ажил зогсоох хүсэлт илгээгдлээ",
        stopWorkCancel: "Цуцлах",
        stopWorkSend: "Хүсэлт илгээх",
        stopWorkReason: "Аюулт нөхцлийг товч тайлбарлана уу",
        visionTitle: "AI АЮУЛ",
        visionDesc: "AI зураас аюулыг шинжилдэг",
        quizTitle: "АЮУЛГҮЙ ТЕСТ",
        quizDesc: "Аюулгүй байдлын тестэд оролцоорой",
        liveTitle: "ШУУД ОРЧУУЛГА",
        liveDesc: "Захиргааны ярианы шууд орчуулга",
    },
    my: {
        greeting: (name: string) => `ကြိုဆိုပါသည်, ${name}`,
        tbmBadge: "ယနေ့ ဘေးကင်းရေး (TBM)",
        tbmDesc: "ဘေးကင်းရေး လမ်းညွှန်ချက်များ ရောက်ရှိပါပြီ။ အလုပ်မစတင်မီ စစ်ဆေး၍ လက်မှတ်ထိုးပါ။",
        tbmBtn: "ကြည့်ရှု၍ လက်မှတ်ထိုးပါ",
        newTBM: "🚨 ဘေးကင်းရေး သတိပေးချက် အသစ်!",
        chatTitle: "Chat",
        chatDesc: "မန်နေဂျာနှင့် ဆွေးနွေးရန် နှိပ်ပါ",
        chatBtn: "Chat ဖွင့်ပါ",
        signOut: "ထွက်သည်",
        safeWork: "ယနေ့ ဘေးကင်းစွာ အလုပ်လုပ်ပါ!",
        status: "အခြေအနေ",
        newChat: "🚨 မန်နေဂျာ chat တောင်းဆိုသည်!",
        openChat: "Chat ဝင်ပါ",
        stopWork: "အလုပ်ရပ်ပါ",
        stopWorkDesc: "အန္တရာယ် ခံစားရလျှင် ချက်ချင်းနှိပ်ပါ",
        stopWorkFamily: "သင်၏ ဘဝနှင့် မိသားစုသည် အရေးအကြီးဆုံး",
        stopWorkConfirm: "အလုပ်ရပ်ရန် တောင်းဆိုချက် ပို့ပြီးပါပြီ",
        stopWorkCancel: "မလုပ်တော့",
        stopWorkSend: "တောင်းဆိုချက် ပို့ပါ",
        stopWorkReason: "အန္တရာယ် အခြေအနေကို အကျဉ်းချုပ် ဖော်ပြပါ",
        visionTitle: "AI အန္တရာယ် ရှာဖွေ",
        visionDesc: "AI သည် ဓာတ်ပုံမှ အန္တရာယ်ကို စစ်ဆေးသည်",
        quizTitle: "ဘေးကင်းရေး ကွစ်ဇ်",
        quizDesc: "ဘေးကင်းရေး ကွစ်ဇ်တွင် ပါဝင်ပါ",
        liveTitle: "တိုက်ရိုက် ဘာသာပြန်",
        liveDesc: "မန်နေဂျာ၏ စကားကို တိုက်ရိုက် ဘာသာပြန်ဆိုသည်",
    },
    ne: {
        greeting: (name: string) => `स्वागत छ, ${name}`,
        tbmBadge: "आजको सुरक्षा (TBM)",
        tbmDesc: "सुरक्षा निर्देशन आइसकेको छ। काम सुरु गर्नुअघि हेर्नुहोस् र हस्ताक्षर गर्नुहोस्।",
        tbmBtn: "हेर्नुहोस् र हस्ताक्षर गर्नुहोस्",
        newTBM: "🚨 नयाँ सुरक्षा सूचना!",
        chatTitle: "च्याट",
        chatDesc: "व्यवस्थापकसँग कुराकानी गर्न थिच्नुहोस्।",
        chatBtn: "च्याट खोल्नुहोस्",
        signOut: "बाहिर निस्कनुहोस्",
        safeWork: "आज सुरक्षित काम गर्नुहोस्!",
        status: "स्थिति",
        newChat: "🚨 व्यवस्थापकले च्याट माग्नुभयो!",
        openChat: "च्याटमा प्रवेश गर्नुहोस्",
        stopWork: "काम रोक्नुहोस्",
        stopWorkDesc: "खतरा महसुस भएमा तुरन्त थिच्नुहोस्",
        stopWorkFamily: "तपाईंको जीवन र परिवार सबैभन्दा महत्त्वपूर्ण",
        stopWorkConfirm: "काम रोक्ने अनुरोध पठाइयो",
        stopWorkCancel: "रद्द गर्नुहोस्",
        stopWorkSend: "अनुरोध पठाउनुहोस्",
        stopWorkReason: "खतरनाक अवस्थाको संक्षिप्त वर्णन गर्नुहोस्",
        visionTitle: "AI खतर पहिचान",
        visionDesc: "AI ले फोटोबाट खतर विश्लेषण गर्छ",
        quizTitle: "सुरक्षा क्विज",
        quizDesc: "सुरक्षा प्रशिक्षण क्विजमा भाग लिनुहोस्",
        liveTitle: "लाइभ अनुवाद",
        liveDesc: "व्यवस्थापकको भाषणको तत्काल अनुवाद",
    },
    bn: {
        greeting: (name: string) => `স্বাগতম, ${name}`,
        tbmBadge: "আজকের নিরাপত্তা (TBM)",
        tbmDesc: "নিরাপত্তা নির্দেশনা এসেছে। কাজ শুরু করার আগে দেখুন এবং স্বাক্ষর করুন।",
        tbmBtn: "দেখুন এবং স্বাক্ষর করুন",
        newTBM: "🚨 নতুন নিরাপত্তা সতর্কতা!",
        chatTitle: "চ্যাট",
        chatDesc: "ম্যানেজারের সাথে কথা বলতে ট্যাপ করুন।",
        chatBtn: "চ্যাট খুলুন",
        signOut: "বের হন",
        safeWork: "আজ নিরাপদে কাজ করুন!",
        status: "অবস্থা",
        newChat: "🚨 ম্যানেজার চ্যাট চেয়েছেন!",
        openChat: "চ্যাটে প্রবেশ করুন",
        stopWork: "কাজ বন্ধ করুন",
        stopWorkDesc: "বিপদ অনুভব করলে তাৎক্ষণিক চাপুন",
        stopWorkFamily: "আপনার জীবন এবং পরিবার সবচেয়ে গুরুত্বপূর্ণ",
        stopWorkConfirm: "কাজ বন্ধের অনুরোধ পাঠানো হয়েছে",
        stopWorkCancel: "বাতিল",
        stopWorkSend: "অনুরোধ পাঠান",
        stopWorkReason: "বিপজ্জনক পরিস্থিতি সংক্ষেপে বর্ণনা করুন",
        visionTitle: "AI বিপদ শনাক্তকরণ",
        visionDesc: "AI ছবি থেকে বিপদ বিশ্লেষণ করে",
        quizTitle: "নিরাপত্তা কুইজ",
        quizDesc: "নিরাপত্তা প্রশিক্ষণ কুইজে অংশ নিন",
        liveTitle: "লাইভ অনুবাদ",
        liveDesc: "ম্যানেজারের বক্তব্যের তাৎক্ষণিক অনুবাদ",
    },
    kk: {
        greeting: (name: string) => `Қош келдіңіз, ${name}`,
        tbmBadge: "Бүгінгі қауіпсіздік (TBM)",
        tbmDesc: "Қауіпсіздік нұсқаулары келді. Жұмысты бастамас бұрын қараңыз және қол қойыңыз.",
        tbmBtn: "Қарап, қол қою",
        newTBM: "🚨 Жаңа қауіпсіздік ескертуі!",
        chatTitle: "Чат",
        chatDesc: "Менеджермен сөйлесу үшін басыңыз.",
        chatBtn: "Чатты ашу",
        signOut: "Шығу",
        safeWork: "Бүгін қауіпсіз жұмыс істеңіз!",
        status: "Мәртебе",
        newChat: "🚨 Менеджер чат сұрады!",
        openChat: "Чатқа кіру",
        stopWork: "ЖҰМЫСТЫ ТОҚТАТУ",
        stopWorkDesc: "Қауіп сезінсеңіз дереу басыңыз",
        stopWorkFamily: "Сіздің өміріңіз бен отбасыңыз ең маңызды",
        stopWorkConfirm: "Жұмысты тоқтату өтініші жіберілді",
        stopWorkCancel: "Болдырмау",
        stopWorkSend: "Өтінішті жіберу",
        stopWorkReason: "Қауіпті жағдайды қысқаша сипаттаңыз",
        visionTitle: "AI ҚАУІП",
        visionDesc: "AI суреттен қауіпті талдайды",
        quizTitle: "ҚАУІПСІЗДІК ТЕСТІ",
        quizDesc: "Қауіпсіздік тестіне қатысыңыз",
        liveTitle: "ТІКЕЛЕЙ АУДАРМА",
        liveDesc: "Менеджердің сөзін тікелей аударма",
    },
    ar: {
        greeting: (name: string) => `مرحبًا، ${name}`,
        tbmBadge: "سلامة اليوم (TBM)",
        tbmDesc: "وصلت تعليمات السلامة. يرجى المراجعة والتوقيع قبل بدء العمل.",
        tbmBtn: "مراجعة والتوقيع",
        newTBM: "🚨 تنبيه سلامة جديد!",
        chatTitle: "محادثة",
        chatDesc: "اضغط للتحدث مع المدير",
        chatBtn: "فتح المحادثة",
        signOut: "تسجيل الخروج",
        safeWork: "اعمل بأمان اليوم!",
        status: "الحالة",
        newChat: "🚨 المدير يطلب محادثة!",
        openChat: "دخول المحادثة",
        stopWork: "إيقاف العمل",
        stopWorkDesc: "اضغط فورًا إذا شعرت بالخطر",
        stopWorkFamily: "حياتك وعائلتك هي الأهم",
        stopWorkConfirm: "تم إرسال طلب إيقاف العمل",
        stopWorkCancel: "إلغاء",
        stopWorkSend: "إرسال الطلب",
        stopWorkReason: "صف الموقف الخطير باختصار",
        visionTitle: "كشف المخاطر AI",
        visionDesc: "يحلل الذكاء الاصطناعي المخاطر من الصور",
        quizTitle: "اختبار السلامة",
        quizDesc: "شارك في اختبار التدريب على السلامة",
        liveTitle: "ترجمة فورية",
        liveDesc: "ترجمة فورية لكلام المدير",
    },
    hi: {
        greeting: (name: string) => `स्वागत है, ${name}`,
        tbmBadge: "आज की सुरक्षा (TBM)",
        tbmDesc: "सुरक्षा निर्देश आ गए हैं। काम शुरू करने से पहले देखें और हस्ताक्षर करें।",
        tbmBtn: "देखें और हस्ताक्षर करें",
        newTBM: "🚨 नई सुरक्षा चेतावनी!",
        chatTitle: "चैट",
        chatDesc: "प्रबंधक से बात करने के लिए टैप करें।",
        chatBtn: "चैट खोलें",
        signOut: "लॉग आउट",
        safeWork: "आज सुरक्षित काम करें!",
        status: "स्थिति",
        newChat: "🚨 प्रबंधक ने चैट मांगी!",
        openChat: "चैट में प्रवेश करें",
        stopWork: "काम रोकें",
        stopWorkDesc: "खतरा महसूस होने पर तुरंत दबाएं",
        stopWorkFamily: "आपका जीवन और परिवार सबसे महत्वपूर्ण है",
        stopWorkConfirm: "काम रोकने का अनुरोध भेजा गया",
        stopWorkCancel: "रद्द करें",
        stopWorkSend: "अनुरोध भेजें",
        stopWorkReason: "खतरनाक स्थिति का संक्षेप में वर्णन करें",
        visionTitle: "AI खतरा पहचान",
        visionDesc: "AI फोटो से खतरे का विश्लेषण करता है",
        quizTitle: "सुरक्षा प्रश्नोत्तरी",
        quizDesc: "सुरक्षा प्रशिक्षण प्रश्नोत्तरी में भाग लें",
        liveTitle: "लाइव अनुवाद",
        liveDesc: "प्रबंधक के भाषण का तत्काल अनुवाद",
    },
    id: {
        greeting: (name: string) => `Selamat datang, ${name}`,
        tbmBadge: "Keselamatan Hari Ini (TBM)",
        tbmDesc: "Petunjuk keselamatan telah tiba. Harap periksa dan tandatangani sebelum memulai kerja.",
        tbmBtn: "Lihat dan Tandatangani",
        newTBM: "🚨 Peringatan Keselamatan Baru!",
        chatTitle: "Obrolan",
        chatDesc: "Ketuk untuk mengobrol dengan admin.",
        chatBtn: "Buka Obrolan",
        signOut: "Keluar",
        safeWork: "Bekerja dengan Aman Hari Ini!",
        status: "Status",
        newChat: "🚨 Admin meminta obrolan!",
        openChat: "Masuk Obrolan",
        stopWork: "HENTIKAN PEKERJAAN",
        stopWorkDesc: "Tekan segera jika Anda merasakan bahaya",
        stopWorkFamily: "Nyawa dan keluarga Anda yang paling penting",
        stopWorkConfirm: "Permintaan menghentikan kerja telah dikirim",
        stopWorkCancel: "Batal",
        stopWorkSend: "Kirim Permintaan",
        stopWorkReason: "Jelaskan situasi berbahaya secara singkat",
        visionTitle: "AI DETEKSI BAHAYA",
        visionDesc: "AI menganalisis bahaya dari foto",
        quizTitle: "KUIS KESELAMATAN",
        quizDesc: "Ikuti kuis pelatihan keselamatan",
        liveTitle: "PENERJEMAH LANGSUNG",
        liveDesc: "Terjemahan langsung ucapan admin",
    },
};
const getUI = (lang: string) => workerUI[lang] || workerUI["en"];

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

function WorkerHomeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [profile, setProfile] = useState<any>(null);
    const [hasNewTBM, setHasNewTBM] = useState(false);
    const [newTBMTime, setNewTBMTime] = useState<string>("");

    // 신규 채팅 알림 관련 상태
    const [newChatCount, setNewChatCount] = useState(0);
    const [newChatTime, setNewChatTime] = useState<string>("");

    const [showStopWorkModal, setShowStopWorkModal] = useState(false);
    const [stopWorkReason, setStopWorkReason] = useState("");
    const [stopWorkSent, setStopWorkSent] = useState(false);

    const urlLang = searchParams.get("lang");

    const triggerAlert = () => {
        playNotificationSound();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch { }
    };

    const handleStopWork = async () => {
        if (!profile) return;
        try {
            const supabase = createClient();
            await supabase.from("stop_work_alerts").insert({
                worker_id: profile.id,
                worker_name: profile.display_name,
                site_id: profile.site_id,
                reason: stopWorkReason || "Emergency stop - no reason provided",
                lang: lang,
            });
            setStopWorkSent(true);
            setStopWorkReason("");
            triggerAlert();
            setTimeout(() => {
                setShowStopWorkModal(false);
                setStopWorkSent(false);
            }, 3000);
        } catch (error) {
            console.error("[StopWork] Failed:", error);
        }
    };

    useEffect(() => {
        const supabase = createClient();
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .single();

                if (urlLang && urlLang !== data?.preferred_lang) {
                    await supabase
                        .from("profiles")
                        .update({ preferred_lang: urlLang })
                        .eq("id", session.user.id);
                    setProfile({ ...data, preferred_lang: urlLang });
                } else {
                    setProfile(data);
                }
            }
        };
        fetchProfile();

        const channel = supabase
            .channel("worker_tbm_realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "tbm_notices" },
                () => {
                    setHasNewTBM(true);
                    setNewTBMTime(new Date().toLocaleTimeString());
                    triggerAlert();
                }
            )
            .subscribe();

        // 관리자가 보낸 1:1 메시지 감지 리스너 추가
        const chatChannel = supabase
            .channel(`worker_home_chat_alert`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                async (payload) => {
                    const msg = payload.new as any;
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session && msg.to_user === session.user.id) {
                        setNewChatCount(prev => prev + 1);
                        setNewChatTime(new Date().toLocaleTimeString());
                        triggerAlert();

                        // 자동 활성화 옵션: 알림과 함께 즉각적인 대화창 이동 지원 (선택적)
                        // router.push("/worker/chat"); 
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(chatChannel);
        };
    }, [urlLang]);

    const lang = profile?.preferred_lang || urlLang || "ko";
    const t = getUI(lang);
    const iso = isoMap[lang] || "un";

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-8 pb-12 font-sans selection:bg-red-500/30">

                {/* 💎 Premium Header */}
                <header className="flex justify-between items-start animate-float">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase text-gradient">Safe-Link</h1>
                            <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] text-green-400 font-black tracking-widest leading-none">LIVE</span>
                            </div>
                        </div>
                        <p className="text-slate-400 font-bold text-lg leading-tight uppercase tracking-tight">
                            {profile ? t.greeting(profile.display_name || "Worker") : "Connecting..."}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-3 glass px-4 py-2 rounded-full border-white/5 shadow-xl">
                            <Image
                                src={`https://flagcdn.com/w40/${iso}.png`}
                                alt={lang}
                                width={40}
                                height={30}
                                className="w-8 h-5.5 object-cover rounded-sm shadow-md"
                                unoptimized
                            />
                            <span className="text-xs text-white font-black">{lang.toUpperCase()}</span>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => router.push('/auth/setup')} className="text-[10px] font-black text-blue-400 hover:text-blue-200 uppercase tracking-widest py-1 transition-colors">
                                Profile Edit
                            </button>
                            <button onClick={handleSignOut} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest py-1 transition-colors">
                                {t.signOut}
                            </button>
                        </div>
                    </div>
                </header>

                {/* 🛑 작업중지권 (Stop Work Authority) — 긴급 버튼 */}
                <section className="relative">
                    <button
                        onClick={() => setShowStopWorkModal(true)}
                        className="w-full py-6 bg-gradient-to-r from-red-700 via-red-600 to-red-700 rounded-[32px] border-2 border-red-400/50 shadow-[0_0_40px_-10px_rgba(239,68,68,0.6)] flex items-center justify-center gap-4 tap-effect hover:scale-[1.02] transition-all active:scale-95"
                    >
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-white text-xl font-black tracking-tight uppercase">{t.stopWork}</span>
                            <span className="text-red-200/80 text-xs font-bold">{t.stopWorkDesc}</span>
                        </div>
                    </button>
                    <p className="text-center text-red-300/40 text-[11px] font-bold mt-2 tracking-wide italic">{t.stopWorkFamily}</p>
                </section>

                {/* 🛑 작업중지 모달 */}
                {showStopWorkModal && (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
                        <div className="bg-slate-900 rounded-[40px] p-8 w-full max-w-md border-2 border-red-500/50 shadow-[0_0_80px_-20px_rgba(239,68,68,0.5)] flex flex-col gap-6">
                            {stopWorkSent ? (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                                        <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <p className="text-green-400 text-xl font-black text-center">{t.stopWorkConfirm}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center">
                                            <svg className="w-9 h-9 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-2xl font-black text-white">{t.stopWork}</h3>
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm">{t.stopWorkFamily}</p>
                                    <textarea
                                        value={stopWorkReason}
                                        onChange={(e) => setStopWorkReason(e.target.value)}
                                        placeholder={t.stopWorkReason}
                                        className="w-full h-24 bg-slate-800 border border-white/10 rounded-2xl p-4 text-white font-bold placeholder:text-slate-600 resize-none focus:outline-none focus:border-red-500/50"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowStopWorkModal(false)}
                                            className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl tap-effect"
                                        >
                                            {t.stopWorkCancel}
                                        </button>
                                        <button
                                            onClick={handleStopWork}
                                            className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg tap-effect hover:bg-red-500 transition-colors"
                                        >
                                            {t.stopWorkSend}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 🚀 New Notification (High Impact) */}
                {hasNewTBM && (
                    <div
                        className="relative overflow-hidden p-8 glass-red rounded-[40px] border-red-500 border-2 shadow-[0_0_60px_-15px_rgba(239,68,68,0.6)] cursor-pointer tap-effect group"
                        onClick={() => { setHasNewTBM(false); router.push("/worker/tbm/today"); }}
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white relative">
                                <div className="absolute inset-0 bg-white rounded-3xl animate-ping opacity-20" />
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-white italic lowercase tracking-tight">{t.newTBM}</h2>
                                <p className="text-red-200/60 font-medium text-sm">Arrived at {newTBMTime}</p>
                            </div>
                            <div className="w-12 h-12 glass rounded-full flex items-center justify-center text-white group-hover:translate-x-1 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
                {/* 💬 신규 채팅 알림 (강제 팝업 형태) */}
                {newChatCount > 0 && (
                    <div
                        className="relative overflow-hidden p-8 bg-blue-600/90 backdrop-blur-md rounded-[40px] border-blue-400 border-2 shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)] cursor-pointer tap-effect animate-float z-50 transform transition-all hover:scale-[1.02]"
                        onClick={() => { setNewChatCount(0); router.push("/worker/chat"); }}
                    >
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-white relative shadow-inner">
                                <div className="absolute inset-0 bg-white rounded-3xl animate-ping opacity-30" />
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">{t.newChat}</h2>
                                <p className="text-blue-100/80 font-bold text-sm">Requested at {newChatTime}</p>
                            </div>
                            <div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-50 transition-colors">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 3l14 9-14 9V3z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🎯 Daily TBM (The Main Mission) */}
                <section className="glass rounded-[48px] p-10 border-white/10 shadow-3xl relative overflow-hidden flex flex-col gap-10">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none" />

                    <div className="flex flex-col gap-4 relative">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-8 bg-red-500 rounded-full" />
                            <h2 className="text-2xl font-black text-white text-gradient uppercase tracking-tighter">{t.tbmBadge}</h2>
                        </div>
                        <p className="text-xl font-bold text-slate-400 leading-snug">
                            {t.tbmDesc}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.status}</span>
                            <span className="text-xl font-black text-red-400 italic">WAITING</span>
                        </div>
                        <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 flex flex-col gap-2 text-right">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Sign Rate</span>
                            <span className="text-xl font-black text-blue-400 italic">82%</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/worker/tbm/today")}
                        className="w-full py-8 bg-gradient-to-br from-green-400 to-green-600 text-slate-950 text-2xl font-black rounded-[32px] shadow-[0_20px_50px_-15px_rgba(34,197,94,0.4)] transition-all tap-effect hover:scale-[1.02]"
                    >
                        {t.tbmBtn.toUpperCase()}
                    </button>
                </section>

                {/* 📸 AI Vision Section */}
                <section
                    onClick={() => router.push('/worker/vision')}
                    className="glass rounded-[40px] p-8 border-white/10 hover:border-purple-500/30 relative overflow-hidden group cursor-pointer tap-effect transition-all"
                >
                    <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                    <div className="flex items-center gap-6 relative">
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-purple-400 shadow-lg">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-white">{t.visionTitle}</h2>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{t.visionDesc}</p>
                        </div>
                    </div>
                </section>

                {/* 🧠 Safety Quiz Section */}
                <section
                    onClick={() => router.push('/worker/quiz')}
                    className="glass rounded-[40px] p-8 border-white/10 hover:border-amber-500/30 relative overflow-hidden group cursor-pointer tap-effect transition-all"
                >
                    <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors" />
                    <div className="flex items-center gap-6 relative">
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-amber-400 shadow-lg">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-white">{t.quizTitle}</h2>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{t.quizDesc}</p>
                        </div>
                    </div>
                </section>

                {/* 🎙️ Live Interpretation Section */}
                <section
                    onClick={() => router.push('/worker/live')}
                    className="glass rounded-[40px] p-8 border-white/10 hover:border-green-500/30 relative overflow-hidden group cursor-pointer tap-effect transition-all"
                >
                    <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
                    <div className="flex items-center gap-6 relative">
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-green-400 shadow-lg">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-white">{t.liveTitle}</h2>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{t.liveDesc}</p>
                        </div>
                    </div>
                </section>

                {/* 💬 Communication Section */}
                <section
                    onClick={() => router.push('/worker/chat')}
                    className="glass rounded-[40px] p-8 border-white/10 hover:border-blue-500/30 relative overflow-hidden group cursor-pointer tap-effect transition-all"
                >
                    <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                    <div className="flex items-center gap-6 mb-8 relative">
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-blue-400 shadow-lg relative">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {newChatCount > 0 && (
                                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 bg-red-500 rounded-full border-[3px] border-white text-white text-[10px] font-black flex items-center justify-center shadow-md">
                                    {newChatCount}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-white">{t.chatTitle}</h2>
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{t.chatDesc}</p>
                        </div>
                    </div>
                    <button className="w-full py-5 bg-blue-600/20 text-blue-300 font-black flex items-center justify-center gap-3 group-hover:bg-blue-600/30 transition-colors rounded-2xl relative z-10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        {t.chatBtn.toUpperCase()}
                    </button>
                </section>

                {/* 🛡️ Footer Brand */}
                <footer className="mt-auto flex flex-col items-center gap-4 py-6">
                    <div className="flex items-center gap-2 opacity-20">
                        <div className="w-8 h-8 rounded-lg bg-white/20" />
                        <span className="font-black text-xl italic text-white uppercase tracking-tighter">Safe-Link OS</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-700 tracking-[0.4em] uppercase">{t.safeWork}</p>
                </footer>

                {/* 🤖 Tier 3 Ambient Edge Agent */}
                <SwarmAgentHUD />

            </div>
        </RoleGuard>
    );
}

export default function WorkerHome() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <WorkerHomeContent />
        </Suspense>
    );
}
