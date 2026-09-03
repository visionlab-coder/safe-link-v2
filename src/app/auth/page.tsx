"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { languages } from "@/constants";
import { HardHat, ShieldCheck, Info, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { getT } from "./translations";
import BrandLogo from "@/components/BrandLogo";
import { getDefaultRouteForProfileRole, type ProfileRole } from "@/lib/roles";
import { adminSignupV3, getV3CurrentUser, loginV3, logoutV3, quickLoginWorkerV3 } from "@/lib/v3-auth";
import type { V3Role } from "@/lib/v3-role-contract";

type AuthNotice = "retry" | "network" | "workerNotFound" | "signupPending" | "multipleSites" | "nfcHint";

/** 로그인 과정에서만 쓰는 안내 문구도 선택 언어 사전으로 관리한다. */
const AUTH_NOTICES: Record<string, Record<AuthNotice, string>> = {
  ko: { retry: "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.", network: "네트워크 연결을 확인해주세요.", workerNotFound: "이니셜 또는 휴대전화 뒷 4자리가 일치하지 않거나, 등록·승인되지 않은 근로자입니다. 관리자에게 NFC 등록 상태를 확인해주세요.", signupPending: "관리자 가입 신청이 접수되었습니다. 승인 후 로그인할 수 있습니다.", multipleSites: "여러 현장에서 일치하는 근로자가 확인되었습니다. 현장을 선택해주세요.", nfcHint: "입장 전 관리자에게 NFC 등록을 요청해주세요." },
  vi: { retry: "Đã xảy ra lỗi. Vui lòng thử lại sau.", network: "Vui lòng kiểm tra kết nối mạng.", workerNotFound: "Không tìm thấy công nhân khớp với thông tin đã nhập. Vui lòng yêu cầu quản lý đăng ký NFC.", signupPending: "Yêu cầu đăng ký quản lý đã được gửi. Bạn có thể đăng nhập sau khi được phê duyệt.", multipleSites: "Tìm thấy công nhân phù hợp tại nhiều công trường. Vui lòng chọn công trường.", nfcHint: "Vui lòng yêu cầu quản lý đăng ký NFC trước khi vào." },
  zh: { retry: "发生错误，请稍后重试。", network: "请检查网络连接。", workerNotFound: "未找到与输入信息匹配的工人。请向管理员申请 NFC 登记。", signupPending: "管理员注册申请已提交。审批后即可登录。", multipleSites: "在多个现场找到了匹配的工人。请选择现场。", nfcHint: "进入前请向管理员申请 NFC 登记。" },
  th: { retry: "เกิดข้อผิดพลาด โปรดลองอีกครั้งภายหลัง", network: "โปรดตรวจสอบการเชื่อมต่อเครือข่าย", workerNotFound: "ไม่พบคนงานที่ตรงกับข้อมูลที่กรอก โปรดขอให้ผู้ดูแลลงทะเบียน NFC", signupPending: "ส่งคำขอสมัครผู้ดูแลแล้ว คุณจะเข้าสู่ระบบได้หลังได้รับอนุมัติ", multipleSites: "พบคนงานที่ตรงกันในหลายไซต์ โปรดเลือกไซต์", nfcHint: "โปรดขอให้ผู้ดูแลลงทะเบียน NFC ก่อนเข้า" },
  uz: { retry: "Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.", network: "Tarmoq ulanishini tekshiring.", workerNotFound: "Kiritilgan ma'lumotlarga mos ishchi topilmadi. Administratordan NFC ro'yxatdan o'tkazishni so'rang.", signupPending: "Administrator ro'yxatdan o'tish so'rovi yuborildi. Tasdiqlangandan so'ng kirishingiz mumkin.", multipleSites: "Mos ishchi bir nechta saytda topildi. Saytni tanlang.", nfcHint: "Kirishdan oldin administratordan NFC ro'yxatdan o'tkazishni so'rang." },
  ph: { retry: "May naganap na error. Pakisubukan muli mamaya.", network: "Pakisuri ang koneksyon sa network.", workerNotFound: "Walang manggagawang tumutugma sa inilagay na impormasyon. Hilinging iparehistro ang NFC sa administrator.", signupPending: "Naipadala ang kahilingan sa pagpaparehistro ng admin. Maaari kang mag-login pagkatapos maaprubahan.", multipleSites: "May tumutugmang manggagawa sa maraming site. Pumili ng site.", nfcHint: "Hilinging irehistro ng administrator ang NFC bago pumasok." },
  km: { retry: "មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។", network: "សូមពិនិត្យការតភ្ជាប់បណ្តាញ។", workerNotFound: "រកមិនឃើញកម្មករដែលត្រូវនឹងព័ត៌មានដែលបានបញ្ចូលទេ។ សូមស្នើអ្នកគ្រប់គ្រងចុះឈ្មោះ NFC។", signupPending: "សំណើចុះឈ្មោះអ្នកគ្រប់គ្រងត្រូវបានផ្ញើ។ អ្នកអាចចូលបានបន្ទាប់ពីអនុម័ត។", multipleSites: "រកឃើញកម្មករត្រូវគ្នានៅកន្លែងច្រើន។ សូមជ្រើសរើសទីតាំង។", nfcHint: "សូមស្នើអ្នកគ្រប់គ្រងចុះឈ្មោះ NFC មុនចូល។" },
  id: { retry: "Terjadi kesalahan. Silakan coba lagi nanti.", network: "Periksa koneksi jaringan Anda.", workerNotFound: "Pekerja yang sesuai dengan informasi tidak ditemukan. Minta administrator mendaftarkan NFC.", signupPending: "Permohonan pendaftaran admin telah dikirim. Anda dapat masuk setelah disetujui.", multipleSites: "Pekerja yang sesuai ditemukan di beberapa lokasi. Pilih lokasi.", nfcHint: "Minta administrator mendaftarkan NFC sebelum masuk." },
  mn: { retry: "Алдаа гарлаа. Дараа дахин оролдоно уу.", network: "Сүлжээний холболтоо шалгана уу.", workerNotFound: "Оруулсан мэдээлэлтэй тохирох ажилтан олдсонгүй. Админаас NFC бүртгэл хүснэ үү.", signupPending: "Админы бүртгэлийн хүсэлт илгээгдлээ. Зөвшөөрсний дараа нэвтэрнэ үү.", multipleSites: "Тохирох ажилтан хэд хэдэн талбайд олдлоо. Талбайг сонгоно уу.", nfcHint: "Орохын өмнө админаас NFC бүртгэл хүснэ үү." },
  my: { retry: "အမှားဖြစ်ပွားခဲ့သည်။ နောက်မှ ထပ်မံကြိုးစားပါ။", network: "ကွန်ရက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။", workerNotFound: "ထည့်သွင်းထားသော အချက်အလက်နှင့် ကိုက်ညီသည့် အလုပ်သမားမတွေ့ပါ။ စီမံခန့်ခွဲသူထံ NFC မှတ်ပုံတင်ရန် တောင်းဆိုပါ။", signupPending: "စီမံခန့်ခွဲသူ အကောင့်လျှောက်လွှာကို ပို့ပြီးပါပြီ။ အတည်ပြုပြီးနောက် ဝင်ရောက်နိုင်ပါသည်။", multipleSites: "ကိုက်ညီသည့် အလုပ်သမားကို နေရာအများအပြားတွင် တွေ့ရှိခဲ့သည်။ နေရာကို ရွေးပါ။", nfcHint: "မဝင်မီ စီမံခန့်ခွဲသူထံ NFC မှတ်ပုံတင်ရန် တောင်းဆိုပါ။" },
  ne: { retry: "त्रुटि भयो। कृपया पछि पुन: प्रयास गर्नुहोस्।", network: "नेटवर्क जडान जाँच गर्नुहोस्।", workerNotFound: "दिइएको जानकारीसँग मिल्ने कामदार भेटिएन। प्रशासकलाई NFC दर्ता गर्न अनुरोध गर्नुहोस्।", signupPending: "प्रशासक दर्ता अनुरोध पठाइएको छ। स्वीकृति पछि लगइन गर्न सक्नुहुन्छ।", multipleSites: "मिल्ने कामदार धेरै साइटमा भेटियो। साइट छान्नुहोस्।", nfcHint: "प्रवेश गर्नु अघि प्रशासकलाई NFC दर्ता गर्न अनुरोध गर्नुहोस्।" },
  bn: { retry: "একটি ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।", network: "নেটওয়ার্ক সংযোগ পরীক্ষা করুন।", workerNotFound: "প্রদত্ত তথ্যের সঙ্গে মেলে এমন কর্মী পাওয়া যায়নি। প্রশাসককে NFC নিবন্ধনের অনুরোধ করুন।", signupPending: "অ্যাডমিন নিবন্ধনের অনুরোধ পাঠানো হয়েছে। অনুমোদনের পর লগইন করা যাবে।", multipleSites: "একাধিক সাইটে মিল থাকা কর্মী পাওয়া গেছে। সাইট নির্বাচন করুন।", nfcHint: "প্রবেশের আগে প্রশাসককে NFC নিবন্ধনের অনুরোধ করুন।" },
  kk: { retry: "Қате орын алды. Кейінірек қайталап көріңіз.", network: "Желі қосылымын тексеріңіз.", workerNotFound: "Енгізілген ақпаратқа сәйкес жұмысшы табылмады. Әкімшіден NFC тіркеуді сұраңыз.", signupPending: "Әкімшіге тіркелу өтінімі жіберілді. Мақұлданғаннан кейін кіре аласыз.", multipleSites: "Сәйкес жұмысшы бірнеше нысанда табылды. Нысанды таңдаңыз.", nfcHint: "Кірмес бұрын әкімшіден NFC тіркеуді сұраңыз." },
  ru: { retry: "Произошла ошибка. Повторите попытку позже.", network: "Проверьте подключение к сети.", workerNotFound: "Работник с указанными данными не найден. Попросите администратора зарегистрировать NFC.", signupPending: "Заявка на регистрацию администратора отправлена. Войти можно после одобрения.", multipleSites: "Подходящий работник найден на нескольких объектах. Выберите объект.", nfcHint: "Перед входом попросите администратора зарегистрировать NFC." },
  en: { retry: "An error occurred. Please try again later.", network: "Check your network connection.", workerNotFound: "No worker matches the entered information. Ask an administrator to register NFC.", signupPending: "Your administrator registration request was submitted. You can sign in after approval.", multipleSites: "A matching worker was found at multiple sites. Select a site.", nfcHint: "Ask an administrator to register NFC before entering." },
  jp: { retry: "エラーが発生しました。しばらくしてからもう一度お試しください。", network: "ネットワーク接続を確認してください。", workerNotFound: "入力した情報に一致する作業員が見つかりません。管理者に NFC 登録を依頼してください。", signupPending: "管理者登録の申請を受け付けました。承認後にログインできます。", multipleSites: "複数の現場で一致する作業員が見つかりました。現場を選択してください。", nfcHint: "入場前に管理者へ NFC 登録を依頼してください。" },
  fr: { retry: "Une erreur est survenue. Veuillez réessayer plus tard.", network: "Vérifiez votre connexion réseau.", workerNotFound: "Aucun travailleur ne correspond aux informations saisies. Demandez à un administrateur d'enregistrer le NFC.", signupPending: "Votre demande d'inscription administrateur a été envoyée. Vous pourrez vous connecter après approbation.", multipleSites: "Un travailleur correspondant a été trouvé sur plusieurs sites. Sélectionnez un site.", nfcHint: "Demandez à un administrateur d'enregistrer le NFC avant d'entrer." },
  es: { retry: "Se produjo un error. Inténtelo de nuevo más tarde.", network: "Compruebe la conexión de red.", workerNotFound: "No hay ningún trabajador que coincida con la información introducida. Pida a un administrador que registre el NFC.", signupPending: "La solicitud de registro de administrador se ha enviado. Podrá iniciar sesión tras la aprobación.", multipleSites: "Se encontró un trabajador coincidente en varios sitios. Seleccione un sitio.", nfcHint: "Pida a un administrador que registre el NFC antes de entrar." },
  ar: { retry: "حدث خطأ. يرجى المحاولة مرة أخرى لاحقاً.", network: "تحقق من اتصال الشبكة.", workerNotFound: "لم يتم العثور على عامل يطابق المعلومات المدخلة. اطلب من المسؤول تسجيل NFC.", signupPending: "تم إرسال طلب تسجيل المسؤول. يمكنك تسجيل الدخول بعد الموافقة.", multipleSites: "تم العثور على عامل مطابق في مواقع متعددة. اختر الموقع.", nfcHint: "اطلب من المسؤول تسجيل NFC قبل الدخول." },
  hi: { retry: "एक त्रुटि हुई। कृपया बाद में पुनः प्रयास करें।", network: "अपना नेटवर्क कनेक्शन जाँचें।", workerNotFound: "दर्ज जानकारी से मेल खाने वाला कर्मचारी नहीं मिला। व्यवस्थापक से NFC पंजीकरण का अनुरोध करें।", signupPending: "व्यवस्थापक पंजीकरण अनुरोध भेज दिया गया है। स्वीकृति के बाद लॉगिन कर सकते हैं।", multipleSites: "मिलान करने वाला कर्मचारी कई साइटों पर मिला। साइट चुनें।", nfcHint: "प्रवेश से पहले व्यवस्थापक से NFC पंजीकरण का अनुरोध करें।" },
};

/** 가입 검증 오류는 사용자가 바로 수정할 수 있는 정보만 안전하게 안내한다. */
const ADMIN_SIGNUP_ERROR_NOTICES: Record<string, Record<"domain" | "duplicate" | "password" | "rate", string>> = {
  ko: {
    domain: "관리자 가입은 @seowonenc.co.kr 이메일로만 가능합니다.",
    duplicate: "이미 가입 신청되었거나 등록된 이메일입니다. 기존 계정으로 로그인하거나 승인 상태를 확인해주세요.",
    password: "비밀번호는 12자 이상으로 입력해주세요.",
    rate: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
  en: {
    domain: "Administrator sign-up is available only with an @seowonenc.co.kr email address.",
    duplicate: "This email is already registered or has a pending sign-up request. Sign in with the existing account or check its approval status.",
    password: "Enter a password with at least 12 characters.",
    rate: "Too many sign-up requests. Please try again shortly.",
  },
};

function adminSignupErrorNotice(language: string, key: "domain" | "duplicate" | "password" | "rate"): string {
  return (ADMIN_SIGNUP_ERROR_NOTICES[language] ?? ADMIN_SIGNUP_ERROR_NOTICES.en)[key];
}

/** 원시 API 에러를 사용자 친화적 문구로 변환. 내부 에러 메시지를 그대로 노출하지 않는다. */
function sanitizeAuthError(msg: string, language: string): string {
  // production에서 원시 에러 로그 비활성화 — 민감 정보 노출 방지
  if (process.env.NODE_ENV !== 'production') {
    console.error("[Auth] Raw error:", msg);
  }
  const m = msg.toLowerCase();
  if (m.includes("api key") || m.includes("apikey") || m.includes("unauthorized") || m.includes("authentication")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_credentials") || m.includes("wrong password") || m.includes("v3_login_failed_401")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("already registered") || m.includes("already exists") || m.includes("duplicate") || m.includes("email_already_registered")) {
    return adminSignupErrorNotice(language, "duplicate");
  }
  if (m.includes("password_min_length") || m.includes("password_too_short")) {
    return adminSignupErrorNotice(language, "password");
  }
  if (m.includes("domain_not_allowed")) {
    return adminSignupErrorNotice(language, "domain");
  }
  if (m.includes("admin_signup_role_fields_not_allowed")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("admin_signup_forbidden_by_security_filter") || m.includes("v3_admin_signup_failed_403")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("v3_backend_unreachable") || m.includes("v3_admin_signup_failed_503")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("account_pending") || m.includes("account_not_active")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("not confirmed") || m.includes("email") && m.includes("confirm")) {
    return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
  }
  if (m.includes("rate limit") || m.includes("rate_limited") || m.includes("too many")) {
    return adminSignupErrorNotice(language, "rate");
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("connection")) {
    return AUTH_NOTICES[language]?.network ?? AUTH_NOTICES.en.network;
  }
  return AUTH_NOTICES[language]?.retry ?? AUTH_NOTICES.en.retry;
}

type Mode = "lang" | "role" | "worker" | "admin";

const V3_ROLE_PRIORITY: V3Role[] = ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER", "WORKER", "VIEWER"];

const RESET_PASSWORD_LABELS: Record<string, string> = {
  ko: "비밀번호를 잊으셨나요?",
  vi: "Quên mật khẩu?",
  zh: "忘记密码？",
  th: "ลืมรหัสผ่าน?",
  uz: "Parolni unutdingizmi?",
  ph: "Nakalimutan ang password?",
  km: "ភ្លេចពាក្យសម្ងាត់?",
  id: "Lupa kata sandi?",
  mn: "Нууц үгээ мартсан уу?",
  my: "စကားဝှက်မေ့နေပါသလား?",
  ne: "पासवर्ड बिर्सनुभयो?",
  bn: "পাসওয়ার্ড ভুলে গেছেন?",
  kk: "Құпия сөзді ұмыттыңыз ба?",
  ru: "Забыли пароль?",
  en: "Forgot password?",
  jp: "パスワードをお忘れですか？",
  fr: "Mot de passe oublié ?",
  es: "¿Olvidó su contraseña?",
  ar: "هل نسيت كلمة المرور؟",
  hi: "पासवर्ड भूल गए?",
};

const EMAIL_LABELS: Record<string, string> = {
  ko: "이메일", vi: "Email", zh: "电子邮件", th: "อีเมล", uz: "Email", ph: "Email", km: "អ៊ីមែល", id: "Email", mn: "Имэйл", my: "အီးမေးလ်", ne: "इमेल", bn: "ইমেইল", kk: "Электрондық пошта", ru: "Электронная почта", en: "Email", jp: "メールアドレス", fr: "E-mail", es: "Correo electrónico", ar: "البريد الإلكتروني", hi: "ईमेल",
};

function pickDefaultV3Role(roles: V3Role[]): V3Role | null {
  return V3_ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated background orbs
// ─────────────────────────────────────────────────────────────────────────────
function BgOrbs() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes safeOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-28px) scale(1.08)}}
        @keyframes safeOrb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-32px,36px) scale(0.93)}}
        @keyframes safeOrb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,28px) scale(1.05)}}
      `}} />
      <div style={{
        position:"absolute",width:560,height:560,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 68%)",
        top:"-18%",left:"-5%",pointerEvents:"none",
        animation:"safeOrb1 11s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:400,height:400,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 68%)",
        bottom:"-5%",right:"-5%",pointerEvents:"none",
        animation:"safeOrb2 13s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute",width:280,height:280,borderRadius:"50%",
        background:"radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 68%)",
        top:"42%",right:"15%",pointerEvents:"none",
        animation:"safeOrb3 8s ease-in-out infinite",
      }} />
    </>
  );
}

// ─── Shared panel styles ───────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #d9e1ea",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  borderRadius: 24,
  boxShadow: "0 18px 42px rgba(16,42,67,0.14)",
};
const accentLine: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, #0b5ed7, transparent)",
};
const fieldBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #cdd6e2",
  borderRadius: 12,
  transition: "border-color 0.2s",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Auth Content
// ─────────────────────────────────────────────────────────────────────────────
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlLang = searchParams.get("lang");
  const [lang, setLang] = useState<string>(urlLang || "");
  const t = getT(lang || "en");
  const emailLabel = EMAIL_LABELS[lang || "en"] || EMAIL_LABELS.en;

  const [mode, setMode] = useState<Mode>(urlLang ? "role" : "lang");
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<{ email: string; role: string | null } | null>(null);

  // 🔐 2026-06-08: phone+name 흐름 폐기 → 이니셜 + 휴대전화 뒷 4자리 단일 흐름.
  // 기존 phone, workerName, countryCode state 도 같이 제거 (UI 무효화 + ESLint unused-vars 박제).
  const [password, setPassword] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [hoveredLang, setHoveredLang] = useState<string | null>(null);
  const [adminSignupMode, setAdminSignupMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [initials, setInitials] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [multipleSites, setMultipleSites] = useState<Array<{ site_id: string; name: string; site_code: string | null }>>([]);
  const [workerLoginError, setWorkerLoginError] = useState("");

  useEffect(() => {
    const savedLang = localStorage.getItem("safe-link-lang");
    if (!urlLang && savedLang) {
      setLang(savedLang);
      // setMode("role"); // 로컬 저장소가 있어도 항상 언어 선택부터 시작하도록 주석 처리
    }
    
    // URL에 역할(role)이 있으면 즉시 해당 로그인 폼으로 진입 (자동 로그인 방지 및 진입 단계 단축)
    const urlRole = searchParams.get("role");
    if (urlRole === "worker") setMode("worker");
    else if (urlRole === "admin") setMode("admin");
  }, [urlLang, searchParams]);

  useEffect(() => {
    const checkUser = async () => {
      const user = await getV3CurrentUser().catch(() => null);
      if (!user) return;
      setExistingUser({
        email: user.email || "",
        role: pickDefaultV3Role(user.roles),
      });
    };
    checkUser();
  }, []);

  // 자동 로그인 제거 — 기존 세션이 있어도 사용자가 직접 선택하며 진입해야 함
  useEffect(() => {
    // 세션이 있어도 모드를 강제로 'role'로 바꾸지 않음. 
    // 사용자가 언어를 먼저 선택하도록 유도.
  }, [existingUser]);

  const redirectByRoleString = useCallback((role: string | null, activeLang: string) => {
    const targetRole = searchParams.get("role");
    const rawSiteId = searchParams.get("site_id");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const siteId = rawSiteId && UUID_RE.test(rawSiteId) ? rawSiteId : null;
    if (!role) {
      router.push(`/auth/setup?lang=${activeLang}${targetRole ? `&role=${targetRole}` : ""}${siteId ? `&site_id=${siteId}` : ""}`);
      return;
    }
    router.push(`${getDefaultRouteForProfileRole(role as ProfileRole)}?lang=${activeLang}`);
  }, [router, searchParams]);

  const handleLangSelect = (code: string) => {
    setLang(code);
    localStorage.setItem("safe-link-lang", code);
    setMode("role");
  };

  // No auto-login — worker enters fresh every time

  // 🔐 2026-06-08: 이니셜 + 휴대전화 뒷 4자리 빠른 로그인.
  // phone+name 흐름 폐기 — 단일 로그인 흐름으로 통합 (NFC 사전 등록 전제).
  const submitQuickLogin = async (siteId?: string) => {
    setLoading(true);
    const activeLang = lang || "ko";
    const notices = AUTH_NOTICES[activeLang] ?? AUTH_NOTICES.en;

    if (!initials.trim()) {
      setWorkerLoginError(activeLang === "ko" ? "이니셜 또는 이름을 입력해주세요." : "Enter your initials or name.");
      setLoading(false);
      return;
    }
    if (phoneLast4.length !== 4) {
      setWorkerLoginError(activeLang === "ko" ? "휴대전화 뒷 4자리를 입력해주세요." : "Enter the last 4 digits of your phone number.");
      setLoading(false);
      return;
    }

    setWorkerLoginError("");

    try {
      const result = await quickLoginWorkerV3({
        nameInitials: initials.trim(),
        phoneLast4,
        preferredLang: activeLang,
        siteId,
      });

      if (!result.ok && result.status === 429) {
        setWorkerLoginError(sanitizeAuthError("rate limit", activeLang));
        setLoading(false);
        return;
      }

      if (!result.ok && result.status === 409) {
        const sites = "sites" in result ? result.sites : [];
        setMultipleSites(sites);
        if (sites.length === 0) {
          setWorkerLoginError(activeLang === "ko"
            ? "동일한 이니셜과 휴대전화 뒷 4자리를 가진 근로자가 여러 명입니다. 관리자에게 등록 정보를 확인해주세요."
            : "More than one worker matches these details. Ask an administrator to verify the registration.");
        }
        setLoading(false);
        return;
      }

      if (!result.ok && result.status === 404) {
        setWorkerLoginError(notices.workerNotFound);
        setLoading(false);
        return;
      }

      if (!result.ok) {
        setWorkerLoginError(sanitizeAuthError("error" in result ? result.error : "unknown", activeLang));
        setLoading(false);
        return;
      }

      // 세션 쿠키는 응답에 이미 박힘 — /api/auth/me 로 확정 후 /worker 진입
      const meRes = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      if (meRes.ok) {
        sessionStorage.setItem("safe-link-session-active", "true");
        if (!localStorage.getItem("safe-link-remember")) {
          localStorage.setItem("safe-link-remember", "false");
        }
        router.push(`/worker?lang=${activeLang}`);
      } else {
        setWorkerLoginError(activeLang === "ko"
          ? "로그인 정보는 확인됐지만 세션을 시작하지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해주세요."
          : "Your details were verified, but the sign-in session could not start. Refresh the browser and try again.");
      }
    } catch {
      setWorkerLoginError(sanitizeAuthError("network", activeLang));
    }
    setLoading(false);
  };

  const handleWorkerEnter = () => submitQuickLogin();

  const handleAdminLogin = async () => {
    if (!adminEmail || !password) return;
    setLoading(true);
    const activeLang = lang || "ko";
    try {
      const user = await loginV3(adminEmail, password);
      // 로그인 화면에서 고른 언어를 다음 화면의 기본 언어로 유지하고,
      // 로그인한 사용자의 설정에도 저장한다. 저장 실패가 로그인을 막지는 않는다.
      localStorage.setItem("safe-link-lang", activeLang);
      await fetch("/api/auth/setup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ display_name: user.displayName, preferred_lang: activeLang }),
      }).catch(() => null);
      sessionStorage.setItem("safe-link-session-active", "true");
      redirectByRoleString(pickDefaultV3Role(user.roles), activeLang);
    } catch (err) {
      alert(sanitizeAuthError(err instanceof Error ? err.message : "unknown", activeLang));
      setLoading(false);
    }
  };

  const handleAdminSignup = async () => {
    if (!adminEmail || !password || !passConfirm) return;
    if (password !== passConfirm) {
      alert(t.noMatch);
      return;
    }

    setLoading(true);
    const activeLang = lang || "ko";
    try {
      const signup = await adminSignupV3({
        email: adminEmail,
        password,
        preferredLang: activeLang,
      });
      if (signup.approvalRequired || signup.accountStatus === "PENDING") {
        alert((AUTH_NOTICES[activeLang] ?? AUTH_NOTICES.en).signupPending);
        setAdminSignupMode(false);
        setPassConfirm("");
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch (err) {
      alert(sanitizeAuthError(err instanceof Error ? err.message : "unknown", activeLang));
      setLoading(false);
    }
  };

  const selectedLangObj = languages.find(l => l.code === lang);

  const Spinner = () => (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
    </span>
  );

  // ── SCREEN 1: LANGUAGE SELECTION ──────────────────────────────────────────
  if (mode === "lang") {
    return (
      <main className="auth-light min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ background: "#eef3f8" }}>
        <BgOrbs />
        <div className="w-full max-w-[400px] relative z-10" style={glassCard}>
          <div style={accentLine} />
          <div className="p-7">
            {/* Header */}
            <div className="text-center mb-7">
              <BrandLogo compact={false} framed className="mb-4 justify-center" imageClassName="max-w-[250px]" />
              <div className="relative mb-4 h-28 overflow-hidden rounded-2xl border border-[#cdd6e2]">
                <picture>
                  <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/access.webp" />
                  <Image src="/images/mobile-v3/website/access.webp" alt="SQ LINK access" fill className="object-cover" priority />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#071b36]/50 to-transparent" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase">SQ LINK · v2.0</span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                SQ<span className="text-blue-400"> LINK</span>
              </h1>
              <p className="text-[10px] text-slate-600 tracking-[0.4em] uppercase mt-2">Field Communication OS</p>
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-sm font-semibold text-slate-300">{t.changeLang}</p>
                <p className="text-xs text-slate-600 mt-1">Select Language · 语言选择</p>
              </div>
            </div>

            {/* Language grid — 5 columns */}
            <div className="grid grid-cols-5 gap-2">
              {languages.map((l) => {
                const isHov = hoveredLang === l.code;
                return (
                  <button key={l.code} onClick={() => handleLangSelect(l.code)}
                    onMouseEnter={() => setHoveredLang(l.code)}
                    onMouseLeave={() => setHoveredLang(null)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200"
                    style={{
                      background: isHov ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isHov ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.05)"}`,
                      transform: isHov ? "scale(1.08) translateY(-2px)" : "scale(1)",
                    }}>
                    <div className="w-9 h-6 rounded-md overflow-hidden shadow-md"
                      style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                      <Image src={`/flags/${l.iso}.png`} alt={l.name}
                        width={36} height={24} className="w-full h-full object-cover" unoptimized />
                    </div>
                    <span className="text-[9px] font-bold text-center leading-tight transition-colors duration-200"
                      style={{ color: isHov ? "#93C5FD" : "#4B5563" }}>
                      {l.name}
                    </span>
                    {l.code !== "ko" && (
                      <span className="text-[8px] font-medium text-center leading-tight"
                        style={{ color: isHov ? "#60A5FA" : "#374151" }}>
                        ({l.koreanName})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-slate-700 mt-5">
              탭하면 즉시 해당 언어로 전환됩니다 / Tap to switch language
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── SCREENS 2-4 (role / worker / admin) ──────────────────────────────────
  return (
    <main className="auth-light min-h-screen flex flex-col items-center justify-center p-5 overflow-hidden relative" style={{ background: "#eef3f8" }}>
      <BgOrbs />
      <div className="w-full max-w-[380px] relative z-10">

        {/* Brand + lang chip */}
        <div className="text-center mb-5">
          <BrandLogo compact framed className="mb-3 justify-center" imageClassName="max-w-[180px]" />
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
            SQ<span className="text-blue-400"> LINK</span>
          </h1>
          <p className="text-[10px] text-slate-700 tracking-[0.4em] uppercase mt-1.5">Field Communication OS</p>
          {selectedLangObj && (
            <button onClick={() => setMode("lang")}
              className="mt-3 min-h-11 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-slate-200 transition-all duration-200 hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Image src={`/flags/${selectedLangObj.iso}.png`}
                alt={selectedLangObj.name} width={16} height={11} className="rounded-sm" unoptimized />
              <span className="font-medium">{selectedLangObj.name}</span>
              <span className="text-slate-600">· {t.changeLang}</span>
            </button>
          )}
        </div>

        <div className="relative mb-5 h-32 w-full overflow-hidden rounded-3xl border border-[#cdd6e2] shadow-lg">
          <picture>
            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/access.webp" />
            <Image src="/images/mobile-v3/website/access.webp" alt="SQ LINK access" fill className="object-cover" priority />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        </div>

        {/* Card */}
        <div style={glassCard} className="overflow-hidden">
          <div style={accentLine} />
          <div className="p-6">

            {/* ── ROLE SCREEN ── */}
            {mode === "role" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-black text-white">{t.chooseRole}</h2>
                  <p className="text-xs text-slate-500 mt-1">{t.chooseRoleDesc}</p>
                </div>

                {existingUser && (
                  <div className="p-4 rounded-2xl"
                    style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-amber-300 text-xs font-bold flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                      <span className="truncate">{existingUser.email}</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => redirectByRoleString(existingUser.role, lang || "ko")}
                        className="flex-1 py-2 text-xs font-black text-slate-900 rounded-xl transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg,#F59E0B,#FCD34D)" }}>
                        이 계정으로 계속
                      </button>
                      <button onClick={async () => { await logoutV3().catch(() => undefined); setExistingUser(null); }}
                        className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl transition-all active:scale-95"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        다른 계정
                      </button>
                    </div>
                  </div>
                )}

                {/* 2-column role split */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMode("worker")}
                    className="group flex flex-col items-center gap-3 p-5 rounded-2xl text-center transition-all duration-300 active:scale-95"
                    style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(16,185,129,0.13)";
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)";
                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(16,185,129,0.07)";
                      e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                      <HardHat className="w-6 h-6" style={{ color: "#6EE7B7" }} />
                    </div>
                    <div>
                      <span className="text-sm font-black block" style={{ color: "#6EE7B7" }}>{t.workerRole}</span>
                      <span className="text-[11px] block mt-0.5 leading-snug" style={{ color: "#475569" }}>{t.workerRoleDesc}</span>
                    </div>
                  </button>

                  <button onClick={() => { setAdminSignupMode(false); setMode("admin"); }}
                    className="group flex flex-col items-center gap-3 p-5 rounded-2xl text-center transition-all duration-300 active:scale-95"
                    style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(59,130,246,0.13)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(59,130,246,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(59,130,246,0.07)";
                      e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                      <ShieldCheck className="w-6 h-6" style={{ color: "#93C5FD" }} />
                    </div>
                    <div>
                      <span className="text-sm font-black block" style={{ color: "#93C5FD" }}>{t.adminRole}</span>
                      <span className="text-[11px] block mt-0.5 leading-snug" style={{ color: "#475569" }}>{t.adminRoleDesc}</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── WORKER SCREEN ── */}
            {mode === "worker" && (
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <HardHat className="w-5 h-5" style={{ color: "#6EE7B7" }} />
                  </div>
                  <div>
                    <h2 className="text-base font-black" style={{ color: "#6EE7B7" }}>{t.workerTitle}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.workerDesc}</p>
                  </div>
                </div>

                {/* 이니셜 (4~6자) */}
                <div style={fieldBox}>
                  <input
                    type="text"
                    aria-label={t.name}
                    placeholder={`${t.name} (BK, NGUYEN)`}
                    value={initials}
                    onChange={e => {
                      setInitials(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase());
                      setWorkerLoginError("");
                    }}
                    maxLength={6}
                    className="w-full bg-transparent text-white text-base font-mono font-black tracking-wider placeholder-slate-700 outline-none px-4 py-3.5"
                  />
                </div>

                {/* 휴대전화 뒷 4자리 */}
                <div style={fieldBox}>
                  <input
                    type="tel"
                    aria-label={t.phone}
                    inputMode="numeric"
                    placeholder={`${t.phone} (1234)`}
                    value={phoneLast4}
                    onChange={e => {
                      setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4));
                      setWorkerLoginError("");
                    }}
                    onKeyDown={e => e.key === "Enter" && handleWorkerEnter()}
                    maxLength={4}
                    className="w-full bg-transparent text-white text-base font-mono font-black tracking-[0.3em] placeholder-slate-700 outline-none px-4 py-3.5"
                  />
                </div>

                {workerLoginError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-700" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{workerLoginError}</span>
                  </div>
                )}

                {/* 복수 사이트 매칭 시 사이트 선택 */}
                {multipleSites.length > 0 && (
                  <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <p className="text-amber-300 text-xs font-bold">{(AUTH_NOTICES[lang || "en"] ?? AUTH_NOTICES.en).multipleSites}</p>
                    {multipleSites.map(s => (
                      <button
                        key={s.site_id}
                        onClick={() => { setMultipleSites([]); submitQuickLogin(s.site_id); }}
                        className="w-full text-left p-3 rounded-lg text-sm font-bold text-white"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        {s.name}{s.site_code ? ` · ${s.site_code}` : ""}
                      </button>
                    ))}
                  </div>
                )}

                {/* Hint */}
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-600" />
                  <p className="text-[11px] text-slate-600 leading-snug">{(AUTH_NOTICES[lang || "en"] ?? AUTH_NOTICES.en).nfcHint}</p>
                </div>

                {/* CTA */}
                <button onClick={handleWorkerEnter} disabled={loading}
                  className="w-full py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#059669 0%,#10B981 100%)", boxShadow: "0 4px 24px rgba(16,185,129,0.28)" }}>
                  {loading ? <Spinner /> : t.doEnter}
                </button>

                {/* Back */}
                <button onClick={() => setMode("role")}
                  className="min-h-11 flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-300 transition-colors mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.back}
                </button>
              </div>
            )}

            {/* ── ADMIN SCREEN ── */}
            {mode === "admin" && (
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                    <ShieldCheck className="w-5 h-5" style={{ color: "#93C5FD" }} />
                  </div>
                  <div>
                    <h2 className="text-base font-black" style={{ color: "#93C5FD" }}>
                      {adminSignupMode ? t.doSignup : t.adminTitle}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.adminDesc}</p>
                  </div>
                </div>

                {/* Email */}
                <div style={fieldBox}>
                  <input type="email" aria-label={emailLabel} placeholder={emailLabel} value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                </div>

                {/* Password */}
                <div style={fieldBox}>
                  <input type="password" aria-label={t.pass} placeholder={t.pass} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => !adminSignupMode && e.key === "Enter" && handleAdminLogin()}
                    className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                </div>

                {!adminSignupMode && (
                  <button
                    type="button"
                    onClick={() => router.push(`/auth/reset-password?lang=${encodeURIComponent(lang || "en")}`)}
                    className="min-h-11 -mt-2 self-end px-2 text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    {RESET_PASSWORD_LABELS[lang || "en"] ?? RESET_PASSWORD_LABELS.en}
                  </button>
                )}

                {adminSignupMode && (
                  <>
                    <div className="relative" style={{
                      ...fieldBox,
                      border: `1px solid ${passConfirm && passConfirm !== password
                        ? "rgba(239,68,68,0.5)"
                        : passConfirm && passConfirm === password
                          ? "rgba(16,185,129,0.5)"
                          : "rgba(255,255,255,0.08)"}`,
                    }}>
                      <input type="password" aria-label={t.passConfirm} placeholder={t.passConfirm} value={passConfirm}
                        onChange={e => setPassConfirm(e.target.value)}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5 pr-11" />
                      {passConfirm && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          {passConfirm === password
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : <XCircle className="w-4 h-4 text-red-400" />
                          }
                        </span>
                      )}
                    </div>
                    <div style={fieldBox}>
                      <input type="email" aria-label={t.backupEmail} placeholder={t.backupEmail} value={backupEmail}
                        onChange={e => setBackupEmail(e.target.value)}
                        className="w-full bg-transparent text-white text-sm placeholder-slate-700 outline-none px-4 py-3.5" />
                    </div>
                  </>
                )}

                {/* CTA */}
                <button onClick={adminSignupMode ? handleAdminSignup : handleAdminLogin}
                  disabled={loading || !adminEmail || !password || (adminSignupMode && !passConfirm)}
                  className="w-full py-3.5 font-black text-sm text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#2563EB 0%,#3B82F6 100%)", boxShadow: "0 4px 24px rgba(59,130,246,0.28)" }}>
                  {loading ? <Spinner /> : adminSignupMode ? t.doSignup : t.doLogin}
                </button>

                <button onClick={() => { setAdminSignupMode(v => !v); setPassConfirm(""); setBackupEmail(""); }}
                  className="min-h-11 px-3 text-xs font-semibold text-center text-blue-400 hover:text-blue-300 transition-colors">
                  {adminSignupMode ? t.adminLoginLink : t.adminSignupLink}
                </button>

                {/* Back */}
                <button onClick={() => setMode("role")}
                  className="min-h-11 flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-300 transition-colors mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.back}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#eef3f8" }}>
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
