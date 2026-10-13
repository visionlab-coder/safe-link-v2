import { englishNameUI } from './english-name';

export const ADMIN_PASSWORD_MIN_LENGTH = 10;

// Keep registration guidance in the selected UI language, including disabled-button reasons.
const messages: Record<string, [string, string]> = {
  ko: ['비밀번호는 10자 이상 입력해 주세요.', '{field}을 입력해 주세요.'],
  en: ['Enter a password with at least 10 characters.', 'Enter {field}.'],
  vi: ['Nhập mật khẩu có ít nhất 10 ký tự.', 'Vui lòng nhập {field}.'],
  zh: ['请输入至少 10 个字符的密码。', '请输入{field}。'],
  th: ['กรอกรหัสผ่านอย่างน้อย 10 ตัวอักษร', 'กรอก{field}'],
  uz: ['Kamida 10 ta belgidan iborat parol kiriting.', '{field} kiriting.'],
  ph: ['Maglagay ng password na may hindi bababa sa 10 character.', 'Ilagay ang {field}.'],
  km: ['សូមបញ្ចូលពាក្យសម្ងាត់យ៉ាងតិច 10 តួអក្សរ។', 'សូមបញ្ចូល {field}។'],
  id: ['Masukkan kata sandi minimal 10 karakter.', 'Masukkan {field}.'],
  mn: ['Доод тал нь 10 тэмдэгттэй нууц үг оруулна уу.', '{field} оруулна уу.'],
  my: ['အနည်းဆုံး စာလုံး 10 လုံးပါသော စကားဝှက်ကို ထည့်ပါ။', '{field} ထည့်ပါ။'],
  ne: ['कम्तीमा 10 अक्षरको पासवर्ड प्रविष्ट गर्नुहोस्।', '{field} प्रविष्ट गर्नुहोस्।'],
  bn: ['অন্তত 10 অক্ষরের পাসওয়ার্ড লিখুন।', '{field} লিখুন।'],
  kk: ['Кемінде 10 таңбадан тұратын құпиясөз енгізіңіз.', '{field} енгізіңіз.'],
  ru: ['Введите пароль длиной не менее 10 символов.', 'Введите {field}.'],
  jp: ['パスワードは10文字以上で入力してください。', '{field}を入力してください。'],
  fr: ['Saisissez un mot de passe d’au moins 10 caractères.', 'Saisissez {field}.'],
  es: ['Introduzca una contraseña de al menos 10 caracteres.', 'Introduzca {field}.'],
  ar: ['أدخل كلمة مرور تتكون من 10 أحرف على الأقل.', 'أدخل {field}.'],
  hi: ['कम से कम 10 अक्षरों का पासवर्ड दर्ज करें।', '{field} दर्ज करें।'],
};

export function adminPasswordHint(language: string): string {
  return (messages[language === 'ja' ? 'jp' : language] ?? messages.en)[0];
}

export function adminSignupIssues(input: {
  language: string; email: string; nameReady: boolean; password: string; confirmation: string;
  emailLabel: string; confirmationLabel: string; mismatchLabel: string;
}): string[] {
  const labels = messages[input.language === 'ja' ? 'jp' : input.language] ?? messages.en;
  const issues: string[] = [];
  if (!input.email.trim()) issues.push(labels[1].replace('{field}', input.emailLabel));
  if (!input.nameReady) issues.push(englishNameUI(input.language).error);
  if (input.password.length < ADMIN_PASSWORD_MIN_LENGTH) issues.push(labels[0]);
  if (!input.confirmation) issues.push(labels[1].replace('{field}', input.confirmationLabel));
  else if (input.password !== input.confirmation) issues.push(input.mismatchLabel);
  return issues;
}
