"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const DELETE_UI: Record<string, Record<string, string>> = {
  ko: { back:"돌아가기", title:"계정 탈퇴", description:"탈퇴 즉시 로그인 정보와 현장 권한을 해제하고 개인정보를 가명 처리합니다. 산업안전 관련 기록과 감사 로그는 법적·운영상의 보존기간 동안 별도로 보관될 수 있습니다.", reason:"탈퇴 사유 (선택)", confirmation:"확인을 위해", enter:"입력", required:"확인을 위해 ‘회원탈퇴’를 정확히 입력해 주세요.", confirm:"계정을 탈퇴하면 로그인할 수 없습니다. 계속할까요?", processing:"처리 중…", submit:"계정 탈퇴", root:"루트 관리자는 서비스 내에서 본인 계정을 삭제할 수 없습니다. 다른 루트 관리자가 권한을 이관한 뒤 처리해야 합니다.", policy:"개인정보 보존·삭제 정책 승인 전에는 계정 탈퇴를 처리할 수 없습니다. 관리자에게 문의해 주세요.", failed:"탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." },
  en: { back:"Back", title:"Delete account", description:"Deleting your account immediately revokes sign-in information and site permissions, and pseudonymizes personal information. Safety records and audit logs may be retained separately for legally and operationally required periods.", reason:"Reason for leaving (optional)", confirmation:"To confirm, enter", enter:"", required:"Enter ‘회원탈퇴’ exactly to confirm.", confirm:"You will no longer be able to sign in after deleting your account. Continue?", processing:"Processing…", submit:"Delete account", root:"The root administrator cannot delete their own account in the service. Another root administrator must transfer authority first.", policy:"Account deletion cannot be processed until the personal-information retention and deletion policy is approved. Contact an administrator.", failed:"Account deletion failed. Please try again later." },
  zh: { back:"返回", title:"注销账户", description:"注销后将立即解除登录信息和现场权限，并对个人信息进行假名化处理。安全相关记录和审计日志可能会在法定及运营保存期限内另行保管。", reason:"注销原因（可选）", confirmation:"为确认，请输入", enter:"", required:"请准确输入“회원탈퇴”以确认。", confirm:"注销后将无法登录。要继续吗？", processing:"正在处理…", submit:"注销账户", root:"根管理员无法在服务内删除自己的账户。需要由其他根管理员先移交权限。", policy:"在个人信息保留和删除政策获批前，无法处理账户注销。请联系管理员。", failed:"账户注销失败，请稍后重试。" },
  vi: { back:"Quay lại", title:"Xóa tài khoản", description:"Việc xóa sẽ ngay lập tức thu hồi thông tin đăng nhập và quyền công trường, đồng thời ẩn danh thông tin cá nhân. Hồ sơ an toàn và nhật ký kiểm toán có thể được lưu riêng theo thời hạn pháp lý và vận hành.", reason:"Lý do rời đi (tùy chọn)", confirmation:"Để xác nhận, nhập", enter:"", required:"Hãy nhập chính xác ‘회원탈퇴’ để xác nhận.", confirm:"Bạn sẽ không thể đăng nhập sau khi xóa tài khoản. Tiếp tục?", processing:"Đang xử lý…", submit:"Xóa tài khoản", root:"Quản trị viên gốc không thể tự xóa tài khoản trong dịch vụ. Quản trị viên gốc khác phải chuyển quyền trước.", policy:"Không thể xử lý xóa tài khoản trước khi chính sách lưu giữ và xóa thông tin cá nhân được phê duyệt. Hãy liên hệ quản trị viên.", failed:"Xóa tài khoản thất bại. Hãy thử lại sau." },
  ru: { back:"Назад", title:"Удалить аккаунт", description:"Удаление немедленно отзовёт данные входа и права на объекте, а персональные данные будут псевдонимизированы. Записи по безопасности и журналы аудита могут храниться отдельно в установленные законом и операционной политикой сроки.", reason:"Причина ухода (необязательно)", confirmation:"Для подтверждения введите", enter:"", required:"Для подтверждения точно введите «회원탈퇴».", confirm:"После удаления аккаунта вы не сможете войти. Продолжить?", processing:"Обработка…", submit:"Удалить аккаунт", root:"Корневой администратор не может удалить собственный аккаунт в сервисе. Сначала другой корневой администратор должен передать полномочия.", policy:"Удаление аккаунта невозможно до утверждения политики хранения и удаления персональных данных. Обратитесь к администратору.", failed:"Не удалось удалить аккаунт. Повторите попытку позже." },
};

export default function AccountDeletePage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = DELETE_UI[lang] || DELETE_UI.en;
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation !== "회원탈퇴") {
      setError(t.required);
      return;
    }
    if (!window.confirm(t.confirm)) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, reason }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || body.message || "account_deletion_failed");
      localStorage.removeItem("safe-link-remember");
      sessionStorage.removeItem("safe-link-session-active");
      window.location.href = "/auth?account_deleted=1";
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "account_deletion_failed";
      setError(
        code === "root_self_deletion_not_allowed"
          ? t.root
          : code === "account_deletion_policy_not_approved"
            ? t.policy
            : t.failed,
      );
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050508] px-5 py-16 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-red-500/20 bg-white/[0.04] p-6 shadow-2xl">
        <button type="button" onClick={() => router.back()} className="mb-6 text-sm font-bold text-slate-400">← {t.back}</button>
        <h1 className="text-2xl font-black">{t.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {t.description}
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold text-slate-300">
            {t.reason}
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
              className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-red-400" />
          </label>
          <label className="block text-sm font-bold text-slate-300">
            {t.confirmation} <strong className="text-red-400">회원탈퇴</strong> {t.enter}
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-red-400" />
          </label>
          {error && <p role="alert" className="text-sm font-bold text-red-400">{error}</p>}
          <button type="submit" disabled={loading || confirmation !== "회원탈퇴"}
            className="w-full rounded-xl bg-red-600 py-3.5 font-black disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? t.processing : t.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
