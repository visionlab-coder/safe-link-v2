import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { tbmChatHref, tbmChatUI } from "@/lib/tbm-chat";

export default function TbmQuestionLink({ adminId, tbmId, lang }: {
  adminId: unknown; tbmId: string; lang: string;
}) {
  const href = tbmChatHref(adminId, tbmId, lang);
  const t = tbmChatUI(lang);
  if (!href) return <p role="status" className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm font-semibold text-slate-700">{t.unavailable}</p>;
  return <Link href={href} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-blue-700 bg-blue-700 px-5 py-4 text-center font-bold !text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
    <MessageCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
    <span>{t.ask}</span>
  </Link>;
}
