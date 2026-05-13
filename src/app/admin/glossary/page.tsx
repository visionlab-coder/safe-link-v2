"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from "react";
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

type PreviewRow = {
    slang: string;
    standard: string;
    category: string;
    valid: boolean;
    duplicate: boolean;
    source?: string;
};

const VALID_CATEGORIES = ["시설", "자재", "도구", "장비", "작업", "검사", "설비", "구조", "안전", "인원", "상태", "단위", "행정", "기타"];

const HEADER_KEYWORDS = ["용어", "은어", "현장용어", "표준어", "standard", "slang", "category", "분류", "카테고리"];

function splitDelimitedLine(line: string) {
    if (line.includes("\t")) return line.split("\t");

    const commaParts = line.split(",");
    if (commaParts.length >= 2) return commaParts;

    const arrowParts = line.split(/\s*(?:=>|->|→|:|=|\|)\s*/);
    if (arrowParts.length >= 2) return arrowParts;

    return [line];
}

function normalizeCategory(rawCategory: string) {
    const category = rawCategory.trim();
    return VALID_CATEGORIES.includes(category) ? category : "기타";
}

function rowsFromText(text: string, source: string): PreviewRow[] {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    return lines
        .map<PreviewRow | null>((line, index) => {
            const parts = splitDelimitedLine(line).map(part => part.trim()).filter(Boolean);
            const isHeader = index === 0 && parts.some(part => HEADER_KEYWORDS.some(keyword => part.toLowerCase().includes(keyword.toLowerCase())));

            if (isHeader || parts.length < 2) return null;

            const slang = parts[0] || "";
            const standard = parts[1] || "";
            const category = normalizeCategory(parts[2] || "");

            return {
                slang,
                standard,
                category,
                valid: Boolean(slang && standard),
                duplicate: false,
                source,
            };
        })
        .filter((row): row is PreviewRow => row !== null);
}

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

    // ── Excel Import ──────────────────────────────────────────────
    type PreviewRow = {
        slang: string;
        standard: string;
        category: string;
        valid: boolean;      // 은어·표준어 모두 있음
        duplicate: boolean;  // DB에 이미 존재하는 은어
    };

    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [importStatus, setImportStatus] = useState<{ ok: number; dup: number; invalid: number } | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [webUrl, setWebUrl] = useState("");
    const [pasteText, setPasteText] = useState("");
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
    const [importError, setImportError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseExcelFile = useCallback(async (file: File) => {
        const xlsx = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = xlsx.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (rows.length === 0) { setPreview([]); return; }

        // 헤더 행에서 각 컬럼 의미 자동 감지 (어느 열에 있어도 OK)
        const SLANG_KW    = ["은어", "슬랭", "현장용어", "속어", "slang"];
        const STANDARD_KW = ["표준어", "표준", "standard", "정식", "정식명칭"];
        const CATEGORY_KW = ["카테고리", "소분류", "분류", "category"];

        const headerRow = rows[0].map(c => String(c ?? "").toLowerCase().trim());
        let slangIdx = -1, standardIdx = -1, categoryIdx = -1;
        headerRow.forEach((cell, i) => {
            if (SLANG_KW.some(k => cell.includes(k)))    slangIdx    = i;
            if (STANDARD_KW.some(k => cell.includes(k))) standardIdx = i;
            if (CATEGORY_KW.some(k => cell.includes(k))) categoryIdx = i;
        });

        // 헤더를 찾으면 1행부터, 못 찾으면 0열=은어·1열=표준어로 가정
        const hasHeader = slangIdx >= 0 && standardIdx >= 0;
        const startIdx  = hasHeader ? 1 : 0;
        const sIdx      = hasHeader ? slangIdx    : 0;
        const tIdx      = hasHeader ? standardIdx : 1;
        const cIdx      = hasHeader ? (categoryIdx >= 0 ? categoryIdx : -1) : 2;

        const parsed = rows.slice(startIdx).map(row => {
            const slang    = String(row[sIdx] ?? "").trim();
            const standard = String(row[tIdx] ?? "").trim();
            const rawCat   = cIdx >= 0 ? String(row[cIdx] ?? "").trim() : "";
            const category = normalizeCategory(rawCat);
            return { slang, standard, category, valid: Boolean(slang && standard), duplicate: false };
        }).filter(r => r.slang || r.standard);

        if (parsed.length === 0) { setPreview([]); return; }

        // DB에서 기존 은어 목록 조회 → 중복 표시
        const supabase = createClient();
        const slugs = parsed.filter(r => r.slang).map(r => r.slang);
        const { data: existing } = await supabase
            .from("construction_glossary")
            .select("slang")
            .in("slang", slugs);

        const existingSet = new Set((existing ?? []).map((e: { slang: string }) => e.slang));

        // 엑셀 내부 중복도 체크 (같은 은어가 여러 행에 있을 때 첫 번째만 유효)
        const seenInFile = new Set<string>();
        const withDup = parsed.map(r => {
            const dup = existingSet.has(r.slang) || seenInFile.has(r.slang);
            if (r.slang) seenInFile.add(r.slang);
            return { ...r, duplicate: dup };
        });

        setPreview(withDup);
        setImportStatus(null);
    }, []);

    const annotateImportedRows = useCallback(async (rows: PreviewRow[]) => {
        const parsed = rows.filter(row => row.slang || row.standard);

        if (parsed.length === 0) {
            setPreview([]);
            setImportStatus(null);
            setImportError("가져올 수 있는 용어가 없습니다. 한 줄에 '현장용어, 표준어, 분류' 형식으로 입력해 주세요.");
            return;
        }

        const supabase = createClient();
        const slangs = Array.from(new Set(parsed.filter(row => row.slang).map(row => row.slang)));
        const { data: existing, error } = await supabase
            .from("construction_glossary")
            .select("slang")
            .in("slang", slangs);

        if (error) {
            setImportError("기존 용어 확인 실패: " + error.message);
            return;
        }

        const existingSet = new Set((existing ?? []).map((row: { slang: string }) => row.slang));
        const seenInInput = new Set<string>();
        const withDup = parsed.map(row => {
            const duplicate = Boolean(row.slang && (existingSet.has(row.slang) || seenInInput.has(row.slang)));
            if (row.slang) seenInInput.add(row.slang);
            return { ...row, duplicate };
        });

        setPreview(withDup);
        setImportStatus(null);
        setImportError("");
    }, []);

    const parseDocumentFile = useCallback(async (file: File) => {
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
            await parseExcelFile(file);
            return;
        }

        if (lowerName.endsWith(".docx")) {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            await annotateImportedRows(rowsFromText(result.value, file.name));
            return;
        }

        if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
            await annotateImportedRows(rowsFromText(await file.text(), file.name));
            return;
        }

        setImportError("지원하지 않는 파일입니다. xlsx, xls, docx, csv, tsv, txt, md, html 파일을 사용해 주세요.");
    }, [annotateImportedRows, parseExcelFile]);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) parseDocumentFile(file);
    }, [parseDocumentFile]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseDocumentFile(file);
        e.target.value = "";
    }, [parseDocumentFile]);

    const handlePastePreview = async () => {
        await annotateImportedRows(rowsFromText(pasteText, "직접 입력"));
    };

    const handleFetchWebPage = async () => {
        if (!webUrl.trim()) return;

        setIsFetchingUrl(true);
        setImportError("");

        try {
            const response = await fetch("/api/glossary/fetch-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: webUrl.trim() }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || "웹 페이지를 가져오지 못했습니다.");
            }

            await annotateImportedRows(rowsFromText(result.text || "", result.title || webUrl));
        } catch (error: any) {
            setImportError(error.message || "웹 페이지를 가져오지 못했습니다.");
        } finally {
            setIsFetchingUrl(false);
        }
    };

    const handleImport = async () => {
        const validRows = preview.filter(r => r.valid);
        if (validRows.length === 0) {
            setImportError("유효한 행이 없습니다. 은어와 표준어 컬럼을 확인해주세요.");
            return;
        }
        setIsImporting(true);
        setImportError("");

        // 서버 API 경유 — 서비스 롤로 RLS 우회하여 안정적 저장
        const res = await fetch("/api/glossary/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validRows.map(r => ({ slang: r.slang, standard: r.standard, category: r.category }))),
        });
        const result = await res.json();

        if (!res.ok) {
            setImportError("저장 실패: " + (result.error ?? res.statusText));
        } else {
            clearGlossaryCache();
            const invalid = preview.filter(r => !r.valid).length;
            setImportStatus({ ok: result.ok, dup: result.dup, invalid });
            if (result.ok === 0) {
                setImportError(result.message ?? "저장된 항목이 없습니다. 모두 이미 등록된 항목이거나 중복입니다.");
            } else {
                setPreview([]);
                await fetchTerms();
            }
        }
        setIsImporting(false);
    };
    // ──────────────────────────────────────────────────────────────

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

                        {/* Excel Import */}
                        <section className="glass rounded-[32px] p-6 border-white/10 shadow-3xl flex flex-col gap-5">
                            <h2 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <div className="w-1 h-6 bg-green-500 rounded-full" />
                                일괄 가져오기
                            </h2>

                            {/* 파일 첨부 버튼 — 가장 눈에 띄게 상단 배치 */}
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-7 flex flex-col items-center gap-3 transition-all
                                    ${isDragging ? "border-green-400 bg-green-500/15" : "border-green-500/40 bg-green-500/5 hover:border-green-400 hover:bg-green-500/10"}`}
                            >
                                <svg className={`w-10 h-10 ${isDragging ? "text-green-300" : "text-green-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <div className="text-center">
                                    <p className="text-sm font-black text-green-300">
                                        {isDragging ? "여기에 놓으세요!" : "📎 엑셀 파일 첨부"}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">클릭하거나 파일을 끌어다 놓으세요</p>
                                    <p className="text-[10px] text-slate-600 mt-1">.xlsx · .xls · .csv · .docx</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.docx,.csv,.tsv,.txt,.md,.html,.htm"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <p className="text-xs text-slate-600 font-bold leading-relaxed text-center">
                                A열: 은어 &nbsp;|&nbsp; B열: 표준어 &nbsp;|&nbsp; C열: 카테고리(선택) · 헤더 행 자동 건너뜀
                            </p>

                            {/* 다른 방법: 웹 URL / 텍스트 붙여넣기 */}
                            <details className="group">
                                <summary className="cursor-pointer text-xs font-black text-slate-500 hover:text-slate-300 transition-colors list-none flex items-center gap-2">
                                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                    다른 방법으로 가져오기 (웹 URL · 텍스트 붙여넣기)
                                </summary>
                                <div className="flex flex-col gap-3 mt-3">
                                    <div className="flex gap-2">
                                        <input
                                            value={webUrl}
                                            onChange={e => setWebUrl(e.target.value)}
                                            placeholder="https://example.com/glossary"
                                            className="min-w-0 flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-green-500/50"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleFetchWebPage}
                                            disabled={isFetchingUrl || !webUrl.trim()}
                                            className="shrink-0 px-4 py-3 bg-green-600/20 text-green-300 hover:bg-green-600/35 disabled:opacity-40 rounded-xl text-xs font-black transition-colors"
                                        >
                                            {isFetchingUrl ? "가져오는 중" : "웹 가져오기"}
                                        </button>
                                    </div>
                                    <textarea
                                        value={pasteText}
                                        onChange={e => setPasteText(e.target.value)}
                                        placeholder={"현장용어, 표준어, 분류\n오함마, 대형 망치, 도구"}
                                        className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-green-500/50 resize-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handlePastePreview}
                                        disabled={!pasteText.trim()}
                                        className="w-full py-3 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40 rounded-xl text-xs font-black transition-colors"
                                    >
                                        붙여넣은 내용 미리보기
                                    </button>
                                </div>
                            </details>

                            {/* 완료 메시지 */}
                            {importError && (
                                <div className="bg-red-900/25 border border-red-700/40 rounded-xl px-4 py-3 text-sm font-bold text-red-300">
                                    {importError}
                                </div>
                            )}

                            {importStatus && (
                                <div className="bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-3 text-sm font-bold space-y-1">
                                    <p className="text-green-300">✅ {importStatus.ok}개 신규 추가 완료</p>
                                    {importStatus.dup > 0 && (
                                        <p className="text-yellow-400">⏭ {importStatus.dup}개 중복 — 자동 제외됨</p>
                                    )}
                                    {importStatus.invalid > 0 && (
                                        <p className="text-red-400">❌ {importStatus.invalid}개 누락 — 건너뜀</p>
                                    )}
                                </div>
                            )}

                            {/* 미리보기 */}
                            {preview.length > 0 && (() => {
                                const newCount  = preview.filter(r => r.valid && !r.duplicate).length;
                                const dupCount  = preview.filter(r => r.duplicate).length;
                                const badCount  = preview.filter(r => !r.valid).length;
                                return (
                                    <div className="flex flex-col gap-3">
                                        {/* 요약 뱃지 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2 flex-wrap">
                                                <span className="text-[11px] bg-green-900/40 text-green-400 border border-green-700/40 px-2 py-0.5 rounded-full font-bold">
                                                    🟢 신규 {newCount}
                                                </span>
                                                {dupCount > 0 && (
                                                    <span className="text-[11px] bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 px-2 py-0.5 rounded-full font-bold">
                                                        🟡 중복 {dupCount}
                                                    </span>
                                                )}
                                                {badCount > 0 && (
                                                    <span className="text-[11px] bg-red-900/40 text-red-400 border border-red-700/40 px-2 py-0.5 rounded-full font-bold">
                                                        🔴 누락 {badCount}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setPreview([])}
                                                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                취소
                                            </button>
                                        </div>

                                        {/* 행별 미리보기 */}
                                        <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                                            {preview.map((row, i) => {
                                                const isNew = row.valid && !row.duplicate;
                                                const isDup = row.duplicate;
                                                const isBad = !row.valid;
                                                return (
                                                    <div key={i} className={`flex items-center gap-2 px-3 py-2 text-xs
                                                        ${isNew ? "bg-slate-800/50"
                                                        : isDup ? "bg-yellow-900/10"
                                                        : "bg-red-900/10"}`}>
                                                        <span className={`w-2 h-2 rounded-full shrink-0
                                                            ${isNew ? "bg-green-500"
                                                            : isDup ? "bg-yellow-500"
                                                            : "bg-red-500"}`}
                                                        />
                                                        <span className={`font-bold w-20 truncate ${isDup ? "text-yellow-600 line-through" : isBad ? "text-red-500" : "text-amber-400"}`}>
                                                            {row.slang || "—"}
                                                        </span>
                                                        <span className="text-slate-600">→</span>
                                                        <span className={`flex-1 truncate ${isDup || isBad ? "text-slate-600" : "text-white"}`}>
                                                            {row.standard || "—"}
                                                        </span>
                                                        <span className="text-slate-700 w-12 text-right shrink-0">{row.category}</span>
                                                        {isDup && <span className="text-[10px] text-yellow-600 shrink-0">중복</span>}
                                                        {isBad && <span className="text-[10px] text-red-600 shrink-0">누락</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={handleImport}
                                            disabled={isImporting || newCount === 0}
                                            className="w-full py-4 bg-gradient-to-br from-green-500 to-green-700 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                        >
                                            {isImporting ? "저장 중..." : `신규 ${newCount}개 추가 (중복 ${dupCount}개 제외)`}
                                        </button>
                                    </div>
                                );
                            })()}
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
