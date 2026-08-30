"use client";
import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Nfc, Plus, ChevronRight, Clock, CheckCircle } from "lucide-react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

interface Session {
  id: string;
  site_id: string;
  title: string | null;
  status: "open" | "running" | "closed";
  started_at: string;
  ended_at: string | null;
}

const TBM_LIVE_UI: Record<string, Record<string, string>> = {
  ko: { newSession:"새 세션", title:"TBM NFC 참석 확인", desc:"현장 세션을 개설하고 NFC 태그 참석 현황을 확인합니다.", createInfo:"새 TBM NFC 참석 세션을 개설합니다.", placeholder:"세션 제목 (선택, 예: 05월 07일 오전 TBM)", cancel:"취소", start:"세션 시작", loading:"로딩 중...", empty:"세션이 없습니다. 새 세션을 시작하세요.", defaultTitle:"TBM 세션", back:"뒤로", missingSite:"현장 ID가 없습니다. 프로필을 확인하세요.", open:"대기중", running:"진행중", closed:"종료" },
  en: { newSession:"New session", title:"TBM NFC Attendance", desc:"Create site sessions and review attendance through NFC tags.", createInfo:"Create a new TBM NFC attendance session.", placeholder:"Session title (optional, e.g. May 7 morning TBM)", cancel:"Cancel", start:"Start session", loading:"Loading...", empty:"There are no sessions. Start a new session.", defaultTitle:"TBM session", back:"Back", missingSite:"Site ID is unavailable. Check the profile.", open:"Waiting", running:"In progress", closed:"Closed" },
  zh: { newSession:"新建会话", title:"TBM NFC 出席确认", desc:"创建现场会话并确认 NFC 标签出席情况。", createInfo:"创建新的 TBM NFC 出席会话。", placeholder:"会话标题（可选，例如 5 月 7 日上午 TBM）", cancel:"取消", start:"开始会话", loading:"正在加载...", empty:"没有会话。请开始新会话。", defaultTitle:"TBM 会话", back:"返回", missingSite:"没有现场 ID。请检查个人资料。", open:"等待中", running:"进行中", closed:"已结束" },
  vi: { newSession:"Phiên mới", title:"Xác nhận tham gia TBM NFC", desc:"Tạo phiên công trường và kiểm tra tham gia bằng thẻ NFC.", createInfo:"Tạo phiên tham gia TBM NFC mới.", placeholder:"Tiêu đề phiên (tùy chọn, ví dụ TBM sáng 07/05)", cancel:"Hủy", start:"Bắt đầu phiên", loading:"Đang tải...", empty:"Không có phiên nào. Hãy bắt đầu phiên mới.", defaultTitle:"Phiên TBM", back:"Quay lại", missingSite:"Không có ID công trường. Hãy kiểm tra hồ sơ.", open:"Đang chờ", running:"Đang diễn ra", closed:"Đã kết thúc" },
  ru: { newSession:"Новая сессия", title:"Подтверждение участия TBM NFC", desc:"Создавайте сессии объекта и проверяйте участие по NFC-меткам.", createInfo:"Создать новую сессию участия TBM NFC.", placeholder:"Название сессии (необязательно, например TBM утром 7 мая)", cancel:"Отмена", start:"Начать сессию", loading:"Загрузка...", empty:"Нет сессий. Начните новую сессию.", defaultTitle:"Сессия TBM", back:"Назад", missingSite:"ID объекта недоступен. Проверьте профиль.", open:"Ожидание", running:"В процессе", closed:"Завершено" },
};
const TBM_LIVE_LOCALES: Record<string, string> = { ko:"ko-KR", en:"en-US", zh:"zh-CN", vi:"vi-VN", ru:"ru-RU" };

export default function TbmLiveIndexPage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = TBM_LIVE_UI[lang] || TBM_LIVE_UI.en;
  const locale = TBM_LIVE_LOCALES[lang] || TBM_LIVE_LOCALES.en;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (siteId) params.set("site_id", siteId);
    const res = await fetch(`/api/nfc/tbm-session?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions ?? []);
    }
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    const loadSite = async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { profile?: { site_id?: string | null } | null };
      if (data.profile?.site_id) setSiteId(String(data.profile.site_id));
    };
    loadSite().catch(() => undefined);
  }, []);

  useEffect(() => { void fetchSessions(); }, [fetchSessions]);

  const handleCreate = async () => {
    if (!siteId) { alert(t.missingSite); return; }
    const res = await fetch("/api/nfc/tbm-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, title: newTitle.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/admin/tbm/live/${data.session.id}`);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="visualization-light min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          <div className="concept-page-header">
            <div className="flex items-center gap-3">
              <Nfc className="w-6 h-6 text-green-400" />
            </div>
            <button
              onClick={() => setCreating(!creating)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.newSession}
            </button>
          </div>

          {/* 새 세션 생성 폼 */}
          <div className="admin-concept-hero relative mb-6 h-40 w-full overflow-hidden rounded-2xl border border-gray-800">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v4/mobile/tbm/03.webp" />
              <Image src="/images/mobile-v4/web/tbm/03.webp" alt="TBM NFC session management" fill className="object-cover" priority />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ LINK TBM NFC</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
            </div>
          </div>

          {creating && (
            <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-green-800">
              <p className="text-sm text-gray-400 mb-3">{t.createInfo}</p>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.placeholder}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm mb-3 focus:outline-none focus:border-green-500"
              />
              <div className="flex gap-3">
                <button onClick={() => setCreating(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">{t.cancel}</button>
                <button onClick={handleCreate} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg text-sm font-medium transition-colors">{t.start}</button>
              </div>
            </div>
          )}

          {/* 세션 목록 */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-center text-gray-500 py-12">{t.loading}</p>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Nfc className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t.empty}</p>
              </div>
            ) : (
              sessions.map((s) => {
                const statusColor = s.status === "open" ? "text-yellow-400" : s.status === "running" ? "text-green-400" : "text-gray-500";
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/admin/tbm/live/${s.id}`)}
                    className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-4 flex items-center gap-3 text-left border border-gray-700 hover:border-gray-500 transition-all"
                  >
                    <div className="shrink-0">
                      {s.status === "closed" ? <CheckCircle className="w-5 h-5 text-gray-600" /> : <Clock className="w-5 h-5 text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">{s.title || t.defaultTitle}</div>
                      <div className="text-sm text-gray-400">
                        {new Date(s.started_at).toLocaleString(locale)} · {s.site_id}
                      </div>
                    </div>
                    <div className={`text-sm font-medium shrink-0 ${statusColor}`}>{t[s.status] || t.closed}</div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                  </button>
                );
              })
            )}
          </div>

          <button onClick={() => router.back()} className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← {t.back}
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}
