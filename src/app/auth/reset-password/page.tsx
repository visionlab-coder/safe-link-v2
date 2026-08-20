"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const RESET_UI: Record<string, Record<string, string>> = {
  ko: { title:"비밀번호 재설정", desc:"재설정 안내를 요청하거나 전달받은 토큰을 입력하세요.", email:"이메일", request:"재설정 안내 요청", token:"재설정 토큰", password:"새 비밀번호 (12자 이상)", change:"비밀번호 변경", back:"로그인으로 돌아가기", requested:"등록 여부와 관계없이, 계정이 확인되면 재설정 안내를 발송합니다.", requestFailed:"요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", changed:"비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.", expired:"재설정 링크가 만료되었습니다.", used:"이미 사용된 재설정 링크입니다.", invalid:"재설정 링크가 올바르지 않거나 처리할 수 없습니다." },
  en: { title:"Reset password", desc:"Request a reset instruction or enter the token you received.", email:"Email", request:"Request reset", token:"Reset token", password:"New password (at least 12 characters)", change:"Change password", back:"Back to sign in", requested:"If an account is confirmed, reset instructions will be sent regardless of registration status.", requestFailed:"Could not process the request. Please try again later.", changed:"Your password has been changed. Please sign in with the new password.", expired:"The reset link has expired.", used:"This reset link has already been used.", invalid:"The reset link is invalid or cannot be processed." },
  zh: { title:"重置密码", desc:"请求重置说明或输入您收到的令牌。", email:"电子邮件", request:"请求重置", token:"重置令牌", password:"新密码（至少 12 个字符）", change:"更改密码", back:"返回登录", requested:"无论注册状态如何，确认账户后都会发送重置说明。", requestFailed:"无法处理请求，请稍后重试。", changed:"密码已更改，请使用新密码登录。", expired:"重置链接已过期。", used:"此重置链接已被使用。", invalid:"重置链接无效或无法处理。" },
  vi: { title:"Đặt lại mật khẩu", desc:"Yêu cầu hướng dẫn đặt lại hoặc nhập mã bạn đã nhận.", email:"Email", request:"Yêu cầu đặt lại", token:"Mã đặt lại", password:"Mật khẩu mới (ít nhất 12 ký tự)", change:"Đổi mật khẩu", back:"Quay lại đăng nhập", requested:"Nếu tài khoản được xác nhận, hướng dẫn đặt lại sẽ được gửi bất kể trạng thái đăng ký.", requestFailed:"Không thể xử lý yêu cầu. Hãy thử lại sau.", changed:"Mật khẩu đã được thay đổi. Hãy đăng nhập bằng mật khẩu mới.", expired:"Liên kết đặt lại đã hết hạn.", used:"Liên kết đặt lại này đã được sử dụng.", invalid:"Liên kết đặt lại không hợp lệ hoặc không thể xử lý." },
  ru: { title:"Сброс пароля", desc:"Запросите инструкцию по сбросу или введите полученный токен.", email:"Электронная почта", request:"Запросить сброс", token:"Токен сброса", password:"Новый пароль (не менее 12 символов)", change:"Изменить пароль", back:"Вернуться ко входу", requested:"Если аккаунт будет подтверждён, инструкции по сбросу будут отправлены независимо от статуса регистрации.", requestFailed:"Не удалось обработать запрос. Повторите попытку позже.", changed:"Пароль изменён. Войдите с новым паролем.", expired:"Срок действия ссылки сброса истёк.", used:"Эта ссылка сброса уже использована.", invalid:"Ссылка сброса неверна или не может быть обработана." },
};

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useDisplayLanguage();
  const t = RESET_UI[lang] || RESET_UI.en;
  const initialToken = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("reset_request_failed");
      setMessage(t.requested);
    } catch {
      setMessage(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "reset_failed");
      }
      setMessage(t.changed);
      setTimeout(() => router.replace("/auth"), 1200);
    } catch (error) {
      const code = error instanceof Error ? error.message : "reset_failed";
      setMessage(code.includes("expired") ? t.expired : code.includes("used") ? t.used : t.invalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#eef3f8] text-slate-900 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[#d9e1ea] bg-white p-6 shadow-[0_18px_42px_rgba(16,42,67,0.14)] sm:p-8">
        <BrandLogo compact showProduct framed className="justify-center" imageClassName="max-w-[180px]" />
        <div className="flex items-center gap-3 my-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-200"><Lock className="w-5 h-5 text-blue-600" /></div>
          <div><h1 className="text-lg font-black text-slate-900">{t.title}</h1><p className="text-xs text-slate-500 mt-1 leading-5">{t.desc}</p></div>
        </div>
        <form onSubmit={requestReset} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm font-bold text-slate-700" htmlFor="reset-email">{t.email}</label>
          <input id="reset-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <button disabled={busy} className="w-full min-h-12 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">{t.request}</button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs font-bold text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>
        <form onSubmit={confirmReset} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="text-sm font-bold text-slate-700" htmlFor="reset-token">{t.token}</label>
          <input id="reset-token" required value={token} onChange={(event) => setToken(event.target.value)} className="w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <label className="text-sm font-bold text-slate-700" htmlFor="reset-password">{t.password}</label>
          <input id="reset-password" type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <button disabled={busy} className="w-full min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">{t.change}</button>
        </form>
        {message && <p role="status" className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700 leading-6">{message}</p>}
        <button onClick={() => router.replace("/auth")} className="mt-5 min-h-11 w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500 transition hover:text-blue-600"><ArrowLeft className="w-4 h-4" />{t.back}</button>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#eef3f8]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
