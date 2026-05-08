"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, Suspense, useCallback } from "react";
import { Shield } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

type WorkerStatus = {
    id: string;
    display_name: string;
    preferred_lang: string;
    signed: boolean;
    signed_at?: string;
    signature_data?: string;
};

const ui: Record<string, any> = {
    ko: {
        title: "TBM 서명 현황",
        signed: "서명 완료",
        unsigned: "미서명",
        total: "전체",
        back: "돌아가기",
        noTBM: "발송된 TBM이 없습니다.",
        noWorker: "등록된 근로자가 없습니다.",
        signedAt: "서명 시각",
        refreshBtn: "새로고침",
        status: "실시간 모니터링",
        totalAttendance: "전체 출근 인원",
        signedRate: "서명 완료율",
        activeDispatch: "최근 발송 내용",
        registry: "근로자 명부",
        members: "명",
        historyTitle: "TBM 이력",
        today: "오늘",
        prev: "이전",
        next: "다음",
        noHistoryDate: "해당 날짜에 TBM이 없습니다.",
    },
    en: {
        title: "TBM Status",
        signed: "Signed",
        unsigned: "Unsigned",
        total: "Total",
        back: "Back",
        noTBM: "No TBM sent yet.",
        noWorker: "No workers registered.",
        signedAt: "Signed at",
        refreshBtn: "Refresh",
        status: "Live Monitoring",
        totalAttendance: "Total Attendance",
        signedRate: "Signed Rate",
        activeDispatch: "Active Dispatch",
        registry: "Worker Registry",
        members: "Members",
        historyTitle: "TBM History",
        today: "Today",
        prev: "Prev",
        next: "Next",
        noHistoryDate: "No TBM on this date.",
    },
    zh: {
        title: "TBM签名状态",
        signed: "已签名",
        unsigned: "未签名",
        total: "全部",
        back: "返回",
        noTBM: "尚未发送TBM。",
        noWorker: "没有注册的工人。",
        signedAt: "签名时间",
        refreshBtn: "刷新",
        status: "实时监控",
        totalAttendance: "总参勤人数",
        signedRate: "签名率",
        activeDispatch: "当前发布",
        registry: "工人名单",
        members: "人",
        historyTitle: "TBM历史",
        today: "今天",
        prev: "上一天",
        next: "下一天",
        noHistoryDate: "该日期没有TBM。",
    },
};

const getUI = (lang: string) => ui[lang] || ui["en"];

function toDateStr(d: Date): string {
    return d.toISOString().split("T")[0];
}

function TBMStatusPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [workers, setWorkers] = useState<WorkerStatus[]>([]);
    const [latestTBM, setLatestTBM] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [adminLang, setAdminLang] = useState("ko");
    const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
    const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
    const [tbmList, setTbmList] = useState<any[]>([]);

    const urlLang = searchParams.get("lang");

    const handleDownload = (data: string, name: string) => {
        const link = document.createElement("a");
        link.href = data;
        link.download = `signature_${name}_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
    };

    const uploadToGoogleSheets = async (token: string, data: any[][]) => {
        try {
            const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    properties: {
                        title: `TBM_Report_${latestTBM.site_name || "Field"}_${new Date().toISOString().split('T')[0]}`,
                    },
                    sheets: [
                        {
                            data: [
                                {
                                    startRow: 0,
                                    startColumn: 0,
                                    rowData: data.map(row => ({
                                        values: row.map(cell => ({ userEnteredValue: { stringValue: String(cell) } }))
                                    }))
                                }
                            ]
                        }
                    ]
                }),
            });
            const result = await response.json();
            if (response.ok) {
                window.open(`https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`, '_blank');
                alert("구글 스프레드시트에 성공적으로 생성되었습니다!");
            } else {
                throw new Error(result.error?.message || "Sheets API Error");
            }
        } catch (err: any) {
            console.error(err);
            alert("스프레드시트 전송 실패: " + err.message);
        }
    };

    const uploadToGoogleDrive = async (token: string, csvContent: string) => {
        try {
            const metadata = {
                name: `TBM_Report_${latestTBM.site_name || "Field"}_${new Date().toISOString().split('T')[0]}.csv`,
                mimeType: 'text/csv',
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([csvContent], { type: 'text/csv' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: form,
            });

            if (response.ok) {
                alert("구글 드라이브에 성공적으로 업로드되었습니다!");
            } else {
                const result = await response.json();
                throw new Error(result.error?.message || "Drive API Error");
            }
        } catch (err: any) {
            console.error(err);
            alert("드라이브 전송 실패: " + err.message);
        }
    };

    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const handleExport = async (mode: 'print' | 'sheets' | 'drive' = 'print') => {
        if (!latestTBM) return;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const providerToken = (session as any)?.provider_token;

        if (mode === 'print') {
            const tbmDate = new Date(latestTBM.created_at);
            const dateStr = tbmDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
            const timeStr = tbmDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
            const signedWorkers = workers.filter(w => w.signed);
            const unsignedWorkers = workers.filter(w => !w.signed);
            const sRate = workers.length > 0 ? Math.round((signedWorkers.length / workers.length) * 100) : 0;

            const printContent = `
                <html>
                <head>
                    <title>안전보건일지 (TBM) - ${dateStr}</title>
                    <style>
                        @page { size: A4; margin: 15mm; }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #111; font-size: 11pt; line-height: 1.6; }
                        .doc-header { text-align: center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 16px; }
                        .doc-header h1 { font-size: 20pt; font-weight: 900; letter-spacing: 8px; margin-bottom: 4px; }
                        .doc-header .subtitle { font-size: 9pt; color: #666; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #333; margin-bottom: 16px; }
                        .info-cell { padding: 8px 12px; border: 1px solid #ccc; }
                        .info-cell .label { font-size: 8pt; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
                        .info-cell .value { font-size: 11pt; font-weight: bold; margin-top: 2px; }
                        .content-box { border: 2px solid #333; padding: 16px; margin-bottom: 16px; min-height: 120px; }
                        .content-box h3 { font-size: 10pt; font-weight: 900; background: #333; color: #fff; display: inline-block; padding: 2px 12px; margin-bottom: 10px; letter-spacing: 3px; }
                        .content-box p { font-size: 11pt; line-height: 1.8; white-space: pre-wrap; }
                        .summary-bar { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; border: 1px solid #ddd; padding: 8px 16px; margin-bottom: 12px; font-size: 10pt; }
                        .summary-bar .rate { font-size: 14pt; font-weight: 900; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                        th, td { border: 1px solid #999; padding: 6px 10px; text-align: center; font-size: 9pt; }
                        th { background: #e8e8e8; font-weight: 900; font-size: 8pt; letter-spacing: 2px; }
                        td.name { text-align: left; font-weight: bold; }
                        .signature-img { height: 32px; max-width: 100px; }
                        .unsigned { color: #c00; font-weight: bold; }
                        .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 12px; }
                        .footer .stamp-area { text-align: center; width: 140px; }
                        .footer .stamp-area .line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 4px; }
                        .footer .stamp-area .label { font-size: 8pt; color: #666; }
                        .footer .system { font-size: 7pt; color: #aaa; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    </style>
                </head>
                <body>
                    <div class="doc-header">
                        <h1>안 전 보 건 일 지</h1>
                        <div class="subtitle">Toolbox Meeting (TBM) Record — Safe-Link System</div>
                    </div>

                    <div class="info-grid">
                        <div class="info-cell">
                            <div class="label">현장명</div>
                            <div class="value">${escapeHtml(latestTBM.site_name || "현장")}</div>
                        </div>
                        <div class="info-cell">
                            <div class="label">일시</div>
                            <div class="value">${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</div>
                        </div>
                        <div class="info-cell">
                            <div class="label">참석 인원</div>
                            <div class="value">${signedWorkers.length} / ${workers.length}명</div>
                        </div>
                        <div class="info-cell">
                            <div class="label">서명 완료율</div>
                            <div class="value">${sRate}%</div>
                        </div>
                    </div>

                    <div class="content-box">
                        <h3>안전 지시 사항</h3>
                        <p>${escapeHtml(latestTBM.content_ko)}</p>
                    </div>

                    <div class="summary-bar">
                        <span>서명 완료: <strong>${signedWorkers.length}명</strong> / 미서명: <strong class="unsigned">${unsignedWorkers.length}명</strong></span>
                        <span class="rate">${sRate}%</span>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width:5%">NO</th>
                                <th style="width:22%">성명</th>
                                <th style="width:10%">언어</th>
                                <th style="width:25%">서명 시각</th>
                                <th style="width:20%">서명</th>
                                <th style="width:18%">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workers.map((w, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td class="name">${escapeHtml(w.display_name)}</td>
                                    <td>${escapeHtml(w.preferred_lang.toUpperCase())}</td>
                                    <td>${w.signed ? escapeHtml(new Date(w.signed_at!).toLocaleString("ko-KR")) : '<span class="unsigned">미서명</span>'}</td>
                                    <td>${w.signed && w.signature_data ? `<img src="${w.signature_data}" class="signature-img" />` : '-'}</td>
                                    <td></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        <div class="system">Safe-Link V2 자동 생성 문서 | ${new Date().toLocaleString("ko-KR")}</div>
                        <div style="display:flex;gap:24px;">
                            <div class="stamp-area">
                                <div class="line"></div>
                                <div class="label">관리감독자</div>
                            </div>
                            <div class="stamp-area">
                                <div class="line"></div>
                                <div class="label">안전관리자</div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(printContent);
                win.document.close();
                win.print();
            }
        } else if (mode === 'sheets' || mode === 'drive') {
            const csvRows = [
                ["성명", "언어", "서명여부", "서명시각"],
                ...workers.map(w => [w.display_name, w.preferred_lang, w.signed ? "완료" : "미달", w.signed_at || ""])
            ];
            const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");

            if (providerToken) {
                if (mode === 'sheets') {
                    await uploadToGoogleSheets(providerToken, csvRows);
                } else {
                    await uploadToGoogleDrive(providerToken, csvContent);
                }
            } else {
                // provider_token이 없으면 수동 다운로드 진행 및 안내
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `TBM_Report_${latestTBM.site_name || "Field"}_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert("구글 계정으로 로그인되어 있지 않아 수동 다운로드를 진행했습니다. 자동 연동을 원하시면 로그아웃 후 '구글로 로그인'을 이용해 주세요.");
            }
        }
    };

    const load = useCallback(async (dateStr?: string) => {
        setLoading(true);
        const targetDate = dateStr || selectedDate;
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        let adminSiteId: string | null = null;
        if (session) {
            const { data: adminProfile } = await supabase.from("profiles").select("preferred_lang, site_id").eq("id", session.user.id).single();
            let finalLang = adminProfile?.preferred_lang || "ko";

            if (urlLang && urlLang !== adminProfile?.preferred_lang) {
                await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
                finalLang = urlLang;
            }
            setAdminLang(finalLang);
            adminSiteId = adminProfile?.site_id || null;
        }

        // 선택한 날짜의 TBM 목록 조회
        const dayStart = `${targetDate}T00:00:00+09:00`;
        const dayEnd = `${targetDate}T23:59:59+09:00`;
        let tbmQuery = supabase.from("tbm_notices").select("*")
            .gte("created_at", dayStart)
            .lte("created_at", dayEnd)
            .order("created_at", { ascending: false });
        if (adminSiteId) tbmQuery = tbmQuery.eq("site_id", adminSiteId);
        const { data: tbmRows } = await tbmQuery;
        const allTbms = tbmRows || [];
        setTbmList(allTbms);

        // 가장 최근 TBM을 기본 선택
        const tbm = allTbms[0] || null;
        setLatestTBM(tbm);

        let workerQuery = supabase.from("profiles").select("id, display_name, preferred_lang").eq("role", "WORKER");
        if (adminSiteId) workerQuery = workerQuery.eq("site_id", adminSiteId);
        const { data: workerProfiles } = await workerQuery;
        if (!tbm || !workerProfiles) {
            setWorkers(workerProfiles?.map(w => ({ ...w, signed: false })) || []);
            setLoading(false);
            return;
        }
        const { data: ackData } = await supabase.from("tbm_ack").select("worker_id, ack_at, signature_data").eq("tbm_id", tbm.id);
        const ackMap = new Map((ackData || []).map(a => [a.worker_id, { at: a.ack_at, sig: a.signature_data }]));
        const statusList: WorkerStatus[] = workerProfiles.map(w => ({
            id: w.id,
            display_name: w.display_name || "Anonymous",
            preferred_lang: w.preferred_lang || "ko",
            signed: ackMap.has(w.id),
            signed_at: ackMap.get(w.id)?.at,
            signature_data: ackMap.get(w.id)?.sig,
        }));
        statusList.sort((a, b) => Number(a.signed) - Number(b.signed));
        setWorkers(statusList);
        setLoading(false);
    }, [urlLang, selectedDate]);

    /** 특정 TBM 선택 시 해당 서명 현황 로드 */
    const selectTBM = useCallback(async (tbm: any) => {
        setLatestTBM(tbm);
        setLoading(true);
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        let adminSiteId: string | null = null;
        if (session) {
            const { data: p } = await supabase.from("profiles").select("site_id").eq("id", session.user.id).single();
            adminSiteId = p?.site_id || null;
        }
        let workerQuery = supabase.from("profiles").select("id, display_name, preferred_lang").eq("role", "WORKER");
        if (adminSiteId) workerQuery = workerQuery.eq("site_id", adminSiteId);
        const { data: workerProfiles } = await workerQuery;
        if (!workerProfiles) { setLoading(false); return; }
        const { data: ackData } = await supabase.from("tbm_ack").select("worker_id, ack_at, signature_data").eq("tbm_id", tbm.id);
        const ackMap = new Map((ackData || []).map(a => [a.worker_id, { at: a.ack_at, sig: a.signature_data }]));
        const statusList: WorkerStatus[] = workerProfiles.map(w => ({
            id: w.id,
            display_name: w.display_name || "Anonymous",
            preferred_lang: w.preferred_lang || "ko",
            signed: ackMap.has(w.id),
            signed_at: ackMap.get(w.id)?.at,
            signature_data: ackMap.get(w.id)?.sig,
        }));
        statusList.sort((a, b) => Number(a.signed) - Number(b.signed));
        setWorkers(statusList);
        setLoading(false);
    }, []);

    const changeDate = useCallback((offset: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + offset);
        // 미래 날짜 방지
        if (d > new Date()) return;
        const newDate = toDateStr(d);
        setSelectedDate(newDate);
        load(newDate);
    }, [selectedDate, load]);

    const goToday = useCallback(() => {
        const today = toDateStr(new Date());
        setSelectedDate(today);
        load(today);
    }, [load]);

    useEffect(() => { load(); }, [load]);

    const signedCount = workers.filter(w => w.signed).length;
    const totalCount = workers.length;
    const signRate = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
    const t = getUI(adminLang);

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">Safe-Link</span>
                                <span className="px-2 py-0.5 bg-blue-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Admin</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* 내보내기 드롭다운 스타일 버튼 */}
                        <div className="relative group/export">
                            <button className="glass px-5 py-2 rounded-full text-xs font-black text-blue-400 hover:bg-blue-500/10 transition-all tap-effect uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2H7a2 2 0 00-2 2v4h12z" /></svg>
                                내보내기
                            </button>
                            <div className="absolute right-0 mt-2 w-48 glass rounded-2xl border border-white/10 shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-[60] overflow-hidden">
                                <button onClick={() => handleExport('print')} className="w-full px-4 py-3 text-left text-[10px] font-black hover:bg-white/5 text-slate-300 transition-colors border-b border-white/5 uppercase tracking-widest">🖨️ 인쇄 / PDF 저장</button>
                                <button onClick={() => handleExport('sheets')} className="w-full px-4 py-3 text-left text-[10px] font-black hover:bg-white/5 text-slate-300 transition-colors border-b border-white/5 uppercase tracking-widest">📊 구글 스프레드시트 (CSV)</button>
                                <button onClick={() => handleExport('drive')} className="w-full px-4 py-3 text-left text-[10px] font-black hover:bg-white/5 text-slate-300 transition-colors uppercase tracking-widest">☁️ 구글 드라이브 보관</button>
                            </div>
                        </div>
                        <button onClick={() => load()} className="glass px-5 py-2 rounded-full text-xs font-black text-slate-400 hover:text-white transition-all tap-effect uppercase tracking-widest">
                            {t.refreshBtn}
                        </button>
                    </div>
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-3xl mx-auto w-full pb-20">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-4xl font-black text-white text-gradient tracking-tighter uppercase">{t.title}</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{t.status}</p>
                        </div>
                    </div>

                    {!loading && totalCount > 0 && (
                        <section className="glass rounded-[48px] p-8 md:p-10 border-white/10 shadow-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />
                            <div className="flex justify-between items-end mb-8 relative">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t.totalAttendance}</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-black text-white">{signedCount}</span>
                                        <span className="text-2xl font-black text-slate-700 italic">/ {totalCount}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-5xl font-black italic text-gradient tracking-tighter">{signRate}%</span>
                                    <span className="text-[10px] font-black text-green-500/50 uppercase tracking-widest">{t.signedRate}</span>
                                </div>
                            </div>
                            <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] ${signRate === 100 ? "bg-green-500" : signRate >= 50 ? "bg-blue-500" : "bg-red-500"}`} style={{ width: `${signRate}%` }} />
                            </div>
                        </section>
                    )}

                    {/* 날짜 네비게이션 */}
                    <div className="glass rounded-[32px] p-4 border-white/5 flex items-center justify-between">
                        <button onClick={() => changeDate(-1)} className="px-4 py-2 rounded-2xl glass border-white/10 text-slate-400 hover:text-white text-xs font-black tap-effect">
                            {t.prev}
                        </button>
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                value={selectedDate}
                                max={toDateStr(new Date())}
                                onChange={(e) => { setSelectedDate(e.target.value); load(e.target.value); }}
                                className="bg-transparent text-white font-black text-lg tracking-tight border-none outline-none text-center [color-scheme:dark]"
                            />
                            {selectedDate !== toDateStr(new Date()) && (
                                <button onClick={goToday} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black tap-effect">
                                    {t.today}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => changeDate(1)}
                            disabled={selectedDate >= toDateStr(new Date())}
                            className="px-4 py-2 rounded-2xl glass border-white/10 text-slate-400 hover:text-white text-xs font-black tap-effect disabled:opacity-20"
                        >
                            {t.next}
                        </button>
                    </div>

                    {/* TBM 목록 (해당 날짜에 여러 건이 있을 수 있음) */}
                    {tbmList.length > 1 && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] px-4">{t.historyTitle} ({tbmList.length})</h3>
                            <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                                {tbmList.map((tbm, idx) => (
                                    <button
                                        key={tbm.id}
                                        onClick={() => selectTBM(tbm)}
                                        className={`flex-shrink-0 px-4 py-3 rounded-2xl text-xs font-bold tap-effect transition-all ${latestTBM?.id === tbm.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "glass border-white/5 text-slate-500 hover:text-white"}`}
                                    >
                                        <span className="font-black">#{idx + 1}</span>
                                        <span className="ml-2">{new Date(tbm.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {tbmList.length === 0 && !loading && (
                        <div className="glass rounded-[32px] p-8 border-white/5 text-center text-slate-600 font-bold italic">
                            {t.noHistoryDate}
                        </div>
                    )}

                    {latestTBM && (
                        <div className="glass rounded-[32px] p-6 border-white/5 flex flex-col gap-3 group animate-float">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.activeDispatch}</h3>
                                <span className="text-[10px] text-slate-700 font-bold">{new Date(latestTBM.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-400 font-bold leading-relaxed italic">&quot;{latestTBM.content_ko}&quot;</p>
                        </div>
                    )}

                    <section className="flex flex-col gap-4">
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.4em]">{t.registry}</h3>
                            <span className="text-[10px] text-slate-700 font-bold uppercase">{workers.length} {t.members}</span>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" /></div>
                        ) : workers.length === 0 ? (
                            <div className="glass rounded-[40px] p-16 text-center text-slate-600 font-bold italic border-dashed border-white/5">{latestTBM ? t.noWorker : t.noTBM}</div>
                        ) : (
                            <div className="grid gap-3">
                                {workers.map(worker => (
                                    <div key={worker.id} className={`glass p-5 rounded-[32px] border-white/5 transition-all tap-effect flex items-center justify-between group ${!worker.signed ? "hover:border-red-500/20" : "hover:border-green-500/20"}`}>
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <Image
                                                    src={`https://flagcdn.com/w80/${isoMap[worker.preferred_lang] || "un"}.png`}
                                                    alt={worker.preferred_lang}
                                                    width={80}
                                                    height={56}
                                                    className="w-12 h-8.5 object-cover rounded-xl shadow-lg border border-white/10"
                                                    unoptimized
                                                />
                                                {!worker.signed && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-white tracking-tight">{worker.display_name}</span>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                    <span>{worker.preferred_lang}</span>
                                                    {worker.signed && <span>• {new Date(worker.signed_at!).toLocaleTimeString()}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {worker.signed && worker.signature_data && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedSignature(worker.signature_data!);
                                                        setSelectedWorker(worker.display_name);
                                                    }}
                                                    className="h-14 px-3 rounded-xl bg-white border border-white/10 flex items-center justify-center hover:bg-white/95 hover:border-blue-400/40 transition-all shadow-lg group/sig"
                                                    title="클릭하여 크게 보기"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={worker.signature_data}
                                                        alt={`${worker.display_name} 서명`}
                                                        className="h-full w-auto max-w-[120px] object-contain"
                                                    />
                                                </button>
                                            )}
                                            <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${worker.signed ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${worker.signed ? "bg-green-500" : "bg-red-500"}`} />
                                                {worker.signed ? t.signed : t.unsigned}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>

                {/* ✍️ Signature Preview Modal */}
                {selectedSignature && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl transition-all" onClick={() => setSelectedSignature(null)}>
                        <div className="relative glass p-1 rounded-[40px] border border-white/20 shadow-2xl animate-float max-w-lg w-full" onClick={e => e.stopPropagation()}>
                            <div className="bg-white rounded-[38px] overflow-hidden p-8 flex flex-col gap-6 items-center">
                                <div className="flex justify-between w-full items-center">
                                    <h3 className="text-slate-950 font-black italic tracking-tighter uppercase">Worker Digital Signature</h3>
                                    <button onClick={() => setSelectedSignature(null)} className="text-slate-400 hover:text-slate-950 transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                {/* base64 data URL — Next.js Image 대신 plain img 사용 */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={selectedSignature}
                                    alt="Signature"
                                    className="w-full h-auto object-contain border-y border-slate-100 py-4"
                                />
                                <div className="flex justify-between w-full items-center">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <Shield className="w-3 h-3" />
                                        Verified & Legally Binding
                                    </div>
                                    <button
                                        onClick={() => handleDownload(selectedSignature, selectedWorker || "worker")}
                                        className="bg-slate-950 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Download Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}

export default function TBMStatusPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <TBMStatusPageContent />
        </Suspense>
    );
}
