"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Hammer, RefreshCw } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { TRADE_LABEL, type TradeType } from "@/lib/roles";
import { QRCodeCanvas } from "qrcode.react";
import Image from "next/image";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const TEAM_QR_UI: Record<string, Record<string, string>> = {
    ko: { title:"팀별 QR 생성", teamLeaderDesc:"본인 현장과 공종이 자동 설정됩니다. QR 스캔 시 근로자가 자동 배속됩니다.", globalDesc:"현장과 공종을 선택해 팀별 QR을 생성합니다.", siteDesc:"본인 현장의 공종을 선택해 팀별 QR을 생성합니다.", loginInfo:"로그인 정보", name:"이름", role:"역할", assignedSite:"소속 현장", team:"소속 팀", site:"현장", select:"선택…", trade:"공종 (팀)", leaderPolicy:"팀장은 본인 팀의 QR만 생성할 수 있습니다. (보안 정책)", teamQr:"팀 QR", download:"QR 다운로드", copied:"복사됨!", copy:"URL 복사", assigned:"근로자가 이 QR을 스캔하면 자동으로", to:"으로 배속됩니다.", preservation:"기존 공종이 'general'인 경우에만 자동 변경되며, 명시적 공종이 이미 있는 경우 보존됩니다.", downloadFailed:"QR 이미지 다운로드에 실패했습니다." },
    en: { title:"Team QR Generator", teamLeaderDesc:"Your site and trade are set automatically. Workers are assigned automatically when they scan the QR code.", globalDesc:"Select a site and trade to create a QR code for a team.", siteDesc:"Select a trade at your site to create a QR code for a team.", loginInfo:"Sign-in information", name:"Name", role:"Role", assignedSite:"Assigned site", team:"Assigned team", site:"Site", select:"Select…", trade:"Trade (team)", leaderPolicy:"Team leaders can create a QR code only for their own team. (Security policy)", teamQr:"Team QR", download:"Download QR", copied:"Copied!", copy:"Copy URL", assigned:"When a worker scans this QR code, they are automatically assigned to", to:".", preservation:"The trade changes automatically only when the existing trade is 'general'; an explicit existing trade is preserved.", downloadFailed:"Failed to download QR image." },
    zh: { title:"按团队生成二维码", teamLeaderDesc:"您的现场和工种会自动设置。工人扫描二维码后会自动分配。", globalDesc:"选择现场和工种以生成团队二维码。", siteDesc:"选择本现场的工种以生成团队二维码。", loginInfo:"登录信息", name:"姓名", role:"角色", assignedSite:"所属现场", team:"所属团队", site:"现场", select:"请选择…", trade:"工种（团队）", leaderPolicy:"班组长只能为自己的团队生成二维码。（安全策略）", teamQr:"团队二维码", download:"下载二维码", copied:"已复制！", copy:"复制网址", assigned:"工人扫描此二维码后会自动分配到", to:"。", preservation:"仅当现有工种为“general”时才会自动更改；已有明确工种时会保留。", downloadFailed:"二维码图片下载失败。" },
    vi: { title:"Tạo QR theo nhóm", teamLeaderDesc:"Công trường và công việc của bạn được đặt tự động. Công nhân sẽ được phân nhóm khi quét QR.", globalDesc:"Chọn công trường và công việc để tạo QR cho nhóm.", siteDesc:"Chọn công việc tại công trường của bạn để tạo QR cho nhóm.", loginInfo:"Thông tin đăng nhập", name:"Tên", role:"Vai trò", assignedSite:"Công trường phụ trách", team:"Nhóm phụ trách", site:"Công trường", select:"Chọn…", trade:"Công việc (nhóm)", leaderPolicy:"Trưởng nhóm chỉ có thể tạo QR cho nhóm của mình. (Chính sách bảo mật)", teamQr:"QR nhóm", download:"Tải QR", copied:"Đã sao chép!", copy:"Sao chép URL", assigned:"Khi công nhân quét QR này, họ sẽ tự động được phân vào", to:".", preservation:"Chỉ tự động thay đổi khi công việc hiện tại là 'general'; công việc đã chỉ định sẽ được giữ nguyên.", downloadFailed:"Không thể tải ảnh QR." },
    ru: { title:"Создание QR по бригадам", teamLeaderDesc:"Ваш объект и специальность задаются автоматически. После сканирования QR работник назначается автоматически.", globalDesc:"Выберите объект и специальность, чтобы создать QR для бригады.", siteDesc:"Выберите специальность на вашем объекте, чтобы создать QR для бригады.", loginInfo:"Данные входа", name:"Имя", role:"Роль", assignedSite:"Закреплённый объект", team:"Закреплённая бригада", site:"Объект", select:"Выберите…", trade:"Специальность (бригада)", leaderPolicy:"Руководитель бригады может создать QR только для своей бригады. (Политика безопасности)", teamQr:"QR бригады", download:"Скачать QR", copied:"Скопировано!", copy:"Копировать URL", assigned:"После сканирования этого QR работник автоматически назначается в", to:".", preservation:"Автоматическая смена выполняется только если текущая специальность — 'general'; явно заданная специальность сохраняется.", downloadFailed:"Не удалось скачать изображение QR." },
};

const TRADE_UI: Record<string, Record<TradeType, string>> = {
    ko: TRADE_LABEL,
    en: { rebar:"Rebar", formwork:"Formwork", concrete:"Concrete", scaffold:"Scaffolding", electrical:"Electrical", mep:"MEP", finishing:"Finishing", earthwork:"Earthwork", structural:"Structural", general:"General" },
    zh: { rebar:"钢筋", formwork:"模板", concrete:"混凝土", scaffold:"脚手架", electrical:"电气", mep:"机电", finishing:"装修", earthwork:"土方", structural:"结构", general:"通用" },
    vi: { rebar:"Cốt thép", formwork:"Cốp pha", concrete:"Bê tông", scaffold:"Giàn giáo", electrical:"Điện", mep:"Cơ điện", finishing:"Hoàn thiện", earthwork:"Đào đất", structural:"Kết cấu", general:"Chung" },
    ru: { rebar:"Арматура", formwork:"Опалубка", concrete:"Бетон", scaffold:"Леса", electrical:"Электрика", mep:"Инженерные сети", finishing:"Отделка", earthwork:"Земляные работы", structural:"Конструкции", general:"Общие работы" },
};

// 🆕 2026-06-09 — 사이트+공종 QR 생성 페이지
//
// 흐름:
//   1. /api/auth/me 로 본인 profile 가져옴 (role, site_id, trade)
//   2. TEAM_LEADER → 본인 site_id + trade 자동 박힘 (변경 불가)
//   3. SAFETY_OFFICER/SITE_ADMIN → 본인 site_id 고정 + trade dropdown 선택 가능
//   4. HQ_ADMIN/ROOT/SUPER_ADMIN → site + trade 둘 다 dropdown
    //   5. URL: /qr/site?site_id={spring-site-id}&trade={code}&lang={selected-language}
//   6. QR 이미지 다운로드 / URL 복사 / Native NFC 발급 (Web NFC 지원 시)

type Site = { id: string; name: string; site_code?: string | null };

type Me = {
    user: { id: string; email: string | null };
    profile: {
        role: string;
        site_id: string | null;
        trade?: string | null;
        display_name: string | null;
    } | null;
};

const TRADE_KEYS: TradeType[] = [
    "rebar", "formwork", "concrete", "scaffold", "electrical",
    "mep", "finishing", "earthwork", "structural", "general",
];

export default function TeamQrPage() {
    const router = useRouter();
    const lang = useDisplayLanguage();
    const t = TEAM_QR_UI[lang] || TEAM_QR_UI.en;
    const tradeLabels = TRADE_UI[lang] || TRADE_UI.en;

    const [me, setMe] = useState<Me | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>("");
    const [selectedTrade, setSelectedTrade] = useState<TradeType>("general");
    const [baseUrl, setBaseUrl] = useState<string>("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setBaseUrl(window.location.origin);
        (async () => {
            const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as Me;
            setMe(data);

            const role = (data.profile?.role ?? "").toUpperCase();
            const isGlobal = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"].includes(role);

            // 본인 trade 고정 (TEAM_LEADER)
            if (data.profile?.trade && TRADE_KEYS.includes(data.profile.trade as TradeType)) {
                setSelectedTrade(data.profile.trade as TradeType);
            }

            const sitesRes = await fetch("/api/sites/options", { credentials: "include", cache: "no-store" });
            const siteData = sitesRes.ok
                ? await sitesRes.json() as { sites?: Site[] }
                : { sites: [] };
            const siteRows = siteData.sites ?? [];
            setSites(siteRows);

            const profileSiteId = data.profile?.site_id ?? "";
            if (!isGlobal && profileSiteId) {
                setSelectedSiteId(profileSiteId);
            } else {
                setSelectedSiteId(profileSiteId || siteRows[0]?.id || "");
            }
        })();
    }, []);

    const role = (me?.profile?.role ?? "").toUpperCase();
    const isTeamLeader = role === "TEAM_LEADER";
    const isGlobalAdmin = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"].includes(role);

    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    const qrUrl = selectedSiteId
        ? `${baseUrl}/qr/site?site_id=${encodeURIComponent(selectedSiteId)}&trade=${selectedTrade}&lang=${encodeURIComponent(lang)}`
        : "";
    const handleCopy = async () => {
        if (!qrUrl) return;
        await navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleDownload = async () => {
        if (!qrUrl) return;
        try {
            const canvas = document.getElementById("team-qr-canvas");
            if (!(canvas instanceof HTMLCanvasElement)) throw new Error("qr_canvas_not_found");
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = `qr_${selectedSite?.site_code ?? "site"}_${selectedTrade}.png`;
            a.click();
        } catch {
            alert(t.downloadFailed);
        }
    };

    return (
        <RoleGuard allowedRole="admin">
            <main className="visualization-light min-h-screen p-6 md:p-12 font-sans">
                <div className="max-w-3xl mx-auto flex flex-col gap-8">
                    {/* Header */}
                    <header className="concept-page-header">
                        <button
                            onClick={() => router.back()}
                            className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <span className="text-base font-black tracking-tight text-[#063789]">SQ-LINK</span>
                    </header>

                    <div className="admin-concept-hero relative h-44 w-full overflow-hidden">
                        <picture>
                            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/nfc-qr.webp" />
                            <Image src="/images/mobile-v3/website/nfc-qr.webp" alt={t.title} fill className="object-cover" priority />
                        </picture>
                        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                        <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                            <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ-LINK TEAM ACCESS</p>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
                            <p className="mt-2 text-sm font-bold text-slate-100">
                                {isTeamLeader
                                    ? t.teamLeaderDesc
                                    : isGlobalAdmin
                                      ? t.globalDesc
                                      : t.siteDesc}
                            </p>
                        </div>
                    </div>

                    {/* 본인 정보 */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">{t.loginInfo}</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 text-xs">{t.name}</p>
                                <p className="font-bold">{me?.profile?.display_name ?? "..."}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">{t.role}</p>
                                <p className="font-bold">{role || "..."}</p>
                            </div>
                            {me?.profile?.site_id && (
                                <div>
                                    <p className="text-slate-500 text-xs">{t.assignedSite}</p>
                                    <p className="font-bold">{sites.find((s) => s.id === me.profile?.site_id)?.name ?? "..."}</p>
                                </div>
                            )}
                            {me?.profile?.trade && (
                                <div>
                                    <p className="text-slate-500 text-xs">{t.team}</p>
                                    <p className="font-bold">{tradeLabels[me.profile.trade as TradeType] ?? me.profile.trade}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 현장 선택 — 글로벌 admin 만 변경 가능 */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">{t.site}</h2>
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            disabled={!isGlobalAdmin}
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none disabled:opacity-60"
                        >
                            <option value="">{t.select}</option>
                            {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}{s.site_code ? ` · ${s.site_code}` : ""}
                                </option>
                            ))}
                        </select>
                    </section>

                    {/* 공종 선택 — TEAM_LEADER 만 disabled */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">{t.trade}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {TRADE_KEYS.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => !isTeamLeader && setSelectedTrade(t)}
                                    disabled={isTeamLeader && selectedTrade !== t}
                                    className={`px-4 py-3 rounded-2xl font-bold text-sm transition-all border ${
                                        selectedTrade === t
                                            ? "bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/30"
                                            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                                    } ${isTeamLeader && selectedTrade !== t ? "opacity-30 cursor-not-allowed" : ""}`}
                                >
                                    <Hammer className="w-3.5 h-3.5 inline mr-1.5" />
                                    {tradeLabels[t]}
                                </button>
                            ))}
                        </div>
                        {isTeamLeader && (
                            <p className="text-xs text-amber-400/70">
                                {t.leaderPolicy}
                            </p>
                        )}
                    </section>

                    {/* QR 결과 */}
                    {qrUrl && (
                        <section className="glass rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-6">
                            <h2 className="text-xs font-black tracking-widest text-blue-300 uppercase">{t.teamQr}</h2>
                            <p className="text-center text-lg font-black">
                                {selectedSite?.name} · {tradeLabels[selectedTrade]}
                            </p>
                            <div className="bg-white p-5 rounded-3xl shadow-2xl">
                                <QRCodeCanvas
                                    id="team-qr-canvas"
                                    value={qrUrl}
                                    size={320}
                                    level="M"
                                    marginSize={1}
                                />
                            </div>
                            <div className="w-full bg-slate-950 rounded-xl p-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    QR URL
                                </p>
                                <p className="text-xs font-mono text-cyan-400 break-all">{qrUrl}</p>
                            </div>
                            <div className="flex flex-wrap gap-3 w-full">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all"
                                >
                                    <Download className="w-4 h-4" /> {t.download}
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className={`flex-1 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${
                                        copied ? "bg-green-600" : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    {copied ? t.copied : t.copy}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 text-center max-w-md">
                                {t.assigned} <strong className="text-blue-300">{selectedSite?.name}</strong> ·{" "}
                                <strong className="text-blue-300">{tradeLabels[selectedTrade]}</strong>{t.to}
                                {" "}{t.preservation}
                            </p>
                        </section>
                    )}
                </div>
            </main>
        </RoleGuard>
    );
}
