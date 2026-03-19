"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { normalizeKoAsync, clearGlossaryCache } from "@/utils/normalize";
import { motion, AnimatePresence } from "framer-motion";

type GlossaryTerm = {
    id: number;
    slang: string;
    standard: string;
    category: string;
    is_active: boolean;
};

export default function GlossaryPage() {
    const router = useRouter();
    const [terms, setTerms] = useState<GlossaryTerm[]>([]);
    const [loading, setLoading] = useState(true);

    // Add new term form state
    const [newSlang, setNewSlang] = useState("");
    const [newStandard, setNewStandard] = useState("");
    const [newCategory, setNewCategory] = useState("기타");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tester state
    const [testInput, setTestInput] = useState("");
    const [testResult, setTestResult] = useState("");

    const fetchTerms = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from("construction_glossary")
            .select("id, slang, standard, category, is_active")
            .order("category", { ascending: true })
            .order("slang", { ascending: true });

        if (data && !error) {
            setTerms(data);
        } else {
            console.error("Failed to fetch terms", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTerms();
    }, []);

    const handleAddTerm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSlang.trim() || !newStandard.trim()) return;

        setIsSubmitting(true);
        const supabase = createClient();

        // Upsert logic based on slang being unique
        const { error } = await supabase
            .from("construction_glossary")
            .upsert({
                slang: newSlang.trim(),
                standard: newStandard.trim(),
                category: newCategory,
                is_active: true
            }, { onConflict: 'slang' });

        if (!error) {
            setNewSlang("");
            setNewStandard("");
            clearGlossaryCache(); // Refresh normalization cache
            await fetchTerms();
        } else {
            alert("Error adding term: " + error.message);
        }
        setIsSubmitting(false);
    };

    const handleToggleActive = async (id: number, currentActive: boolean) => {
        const supabase = createClient();
        const { error } = await supabase
            .from("construction_glossary")
            .update({ is_active: !currentActive })
            .eq("id", id);

        if (!error) {
            clearGlossaryCache();
            setTerms(terms.map(t => t.id === id ? { ...t, is_active: !currentActive } : t));
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 이 단어를 완전히 삭제하시겠습니까? 관련 번역 데이터도 삭제될 수 있습니다.")) return;
        const supabase = createClient();
        const { error } = await supabase
            .from("construction_glossary")
            .delete()
            .eq("id", id);

        if (!error) {
            clearGlossaryCache();
            setTerms(terms.filter(t => t.id !== id));
        }
    };

    const handleTestNormalize = async () => {
        if (!testInput.trim()) return;
        // The API might be slow due to cache clear on the client, but it will fetch new DB
        const result = await normalizeKoAsync(testInput);
        setTestResult(result.normalized);
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
                        title: `SafeLink_Glossary_${new Date().toISOString().split('T')[0]}`,
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
                name: `SafeLink_Glossary_${new Date().toISOString().split('T')[0]}.csv`,
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
        if (terms.length === 0) return;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const providerToken = (session as any)?.provider_token;

        if (mode === 'print') {
            const printContent = `
                <html>
                <head>
                    <title>현장 용어 사전 리포트 - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                        th { background: #f1f5f9; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>Safe-Link 현장 용어 사전 (Glossary)</h1>
                    <p><strong>생성일:</strong> ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>카테고리</th>
                                <th>은어 (현장 용어)</th>
                                <th>표준어</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${terms.map(t => `
                                <tr>
                                    <td>${escapeHtml(t.category)}</td>
                                    <td style="font-weight: bold;">${escapeHtml(t.slang)}</td>
                                    <td>${escapeHtml(t.standard)}</td>
                                    <td>${t.is_active ? '활성' : '비활성'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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
                ["카테고리", "은어", "표준어", "활성상태"],
                ...terms.map(t => [t.category, t.slang, t.standard, t.is_active ? "활성" : "비활성"])
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
                link.setAttribute("download", `Glossary_Export_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert("구글 계정으로 로그인되어 있지 않아 수동 다운로드를 진행했습니다. 자동 연동을 원하시면 로그아웃 후 '구글로 로그인'을 이용해 주세요.");
            }
        }
    };

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-8 pb-12 font-sans selection:bg-blue-500/30">
                <header className="flex flex-wrap items-center justify-between gap-4 animate-float">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/admin')} className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all hover:-translate-x-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase text-gradient">Glossary</h1>
                            <p className="text-slate-400 font-bold tracking-tight uppercase text-sm">현장 용어 및 표준어 관리</p>
                        </div>
                    </div>
                    <div className="relative group/export">
                        <button className="glass px-6 py-3 rounded-full text-xs font-black text-blue-400 hover:bg-blue-500/10 transition-all tap-effect uppercase tracking-widest flex items-center gap-2 shadow-xl">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2H7a2 2 0 00-2 2v4h12z" /></svg>
                            내보내기
                        </button>
                        <div className="absolute right-0 mt-2 w-56 glass rounded-2xl border border-white/10 shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-[60] overflow-hidden">
                            <button onClick={() => handleExport('print')} className="w-full px-4 py-4 text-left text-[11px] font-black hover:bg-white/5 text-slate-300 transition-colors border-b border-white/5 uppercase tracking-widest flex items-center gap-2">🖨️ 인쇄 / PDF 저장</button>
                            <button onClick={() => handleExport('sheets')} className="w-full px-4 py-4 text-left text-[11px] font-black hover:bg-white/5 text-slate-300 transition-colors border-b border-white/5 uppercase tracking-widest flex items-center gap-2">📊 구글 스프레드시트 (CSV)</button>
                            <button onClick={() => handleExport('drive')} className="w-full px-4 py-4 text-left text-[11px] font-black hover:bg-white/5 text-slate-300 transition-colors uppercase tracking-widest flex items-center gap-2">☁️ 구글 드라이브 보관</button>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Form & Testing */}
                    <div className="flex flex-col gap-8">
                        {/* Add Term Form */}
                        <section className="glass rounded-[32px] p-6 border-white/10 shadow-3xl flex flex-col gap-6">
                            <h2 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                새 용어 추가
                            </h2>
                            <form onSubmit={handleAddTerm} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">은어 (현장 용어)</label>
                                    <input
                                        type="text"
                                        value={newSlang}
                                        onChange={e => setNewSlang(e.target.value)}
                                        placeholder="예: 공구리"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-medium"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">표준어</label>
                                    <input
                                        type="text"
                                        value={newStandard}
                                        onChange={e => setNewStandard(e.target.value)}
                                        placeholder="예: 콘크리트"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-medium"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">카테고리</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 font-bold appearance-none"
                                    >
                                        <option value="시설">시설</option>
                                        <option value="자재">자재</option>
                                        <option value="도구">도구</option>
                                        <option value="장비">장비</option>
                                        <option value="작업">작업</option>
                                        <option value="검사">검사</option>
                                        <option value="설비">설비</option>
                                        <option value="구조">구조</option>
                                        <option value="안전">안전</option>
                                        <option value="인원">인원</option>
                                        <option value="상태">상태</option>
                                        <option value="단위">단위</option>
                                        <option value="행정">행정</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-5 bg-gradient-to-br from-blue-500 to-blue-700 text-white font-black rounded-2xl shadow-lg mt-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                >
                                    {isSubmitting ? "저장 중..." : "추가/수정하기"}
                                </button>
                            </form>
                        </section>

                        {/* Test Normalizer */}
                        <section className="glass rounded-[32px] p-6 border-white/10 shadow-3xl flex flex-col gap-4">
                            <h2 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <div className="w-1 h-6 bg-purple-500 rounded-full" />
                                표준어 변환 테스트
                            </h2>
                            <p className="text-sm font-bold text-slate-400">새로 추가한 단어가 잘 변환되는지 테스트해 보세요.</p>
                            <div className="flex flex-col gap-3">
                                <textarea
                                    value={testInput}
                                    onChange={e => setTestInput(e.target.value)}
                                    placeholder="여기다가 야리끼리로 철근 공구리 치고 시마이 합시다 쳐보세요"
                                    className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 resize-none font-medium"
                                />
                                <button
                                    onClick={handleTestNormalize}
                                    className="py-3 bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 font-black rounded-xl transition-colors tracking-wider"
                                >
                                    변환 테스트
                                </button>
                            </div>
                            {testResult && (
                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-200 font-black tracking-wide">
                                    {testResult}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column: Term List */}
                    <div className="lg:col-span-2 glass rounded-[32px] p-6 border-white/10 shadow-3xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center px-2 flex-shrink-0 mb-2">
                            <h2 className="text-2xl font-black text-white italic tracking-tight uppercase flex items-center gap-3">
                                <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                                등록된 용어 목록
                                <span className="text-xs max-w-min px-3 py-1 bg-white/10 rounded-full font-bold ml-2">{terms.length}개</span>
                            </h2>
                            <button onClick={fetchTerms} className="p-2 text-slate-400 hover:text-white transition-colors" title="새로고침">
                                <svg className={`w-6 h-6 ${loading ? 'animate-spin text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 flex flex-col gap-2">
                            {loading && terms.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 font-bold animate-pulse uppercase tracking-widest">
                                    데이터를 불러오는 중입니다...
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {terms.map(term => (
                                        <motion.div
                                            key={term.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                            layout
                                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border transition-all ${term.is_active ? 'bg-slate-800/50 border-white/5 hover:border-white/20' : 'bg-slate-900/50 border-red-500/20 opacity-50'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="w-14 text-center px-2 py-1 bg-white/5 rounded-lg text-xs font-black text-slate-400 tracking-wider">
                                                    {term.category}
                                                </span>
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                                                    <span className={`text-xl font-black ${term.is_active ? 'text-amber-400' : 'text-slate-500 line-through'}`}>
                                                        {term.slang}
                                                    </span>
                                                    <span className="text-slate-500 hidden sm:inline">→</span>
                                                    <span className={`text-lg font-bold ${term.is_active ? 'text-white' : 'text-slate-600'}`}>
                                                        {term.standard}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setNewSlang(term.slang);
                                                        setNewStandard(term.standard);
                                                        setNewCategory(term.category);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg border border-slate-600/50 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors hidden md:block"
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(term.id, term.is_active)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${term.is_active ? 'bg-white/10 text-slate-300 hover:bg-slate-700' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                                                >
                                                    {term.is_active ? '비활성화' : '활성화'}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(term.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="완전 삭제"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                            {terms.length === 0 && !loading && (
                                <div className="text-center py-10 text-slate-500 font-bold uppercase tracking-widest">
                                    등록된 용어가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
