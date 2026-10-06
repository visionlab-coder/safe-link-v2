"use client";

import { useState, useEffect, useCallback } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { filterRiskLibrary, riskLibraryDraft, type RiskLibraryItem, type RiskLibrarySource } from "@/lib/tbm-risk-library";

interface SafetyLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (text: string) => void;
    lang?: string;
    disabled?: boolean;
}

const UI_TEXT: Record<string, Record<string, string>> = {
    ko: {
        title: "기초교육 라이브러리",
        subtitle: "위험성평가 항목을 선택하여 TBM에 추가",
        allCategories: "전체",
        allSubs: "전체 세부공종",
        criticalOnly: "중점관리만",
        hazard: "위험요인",
        measure: "관리계획 (예방대책)",
        risk: "위험등급",
        freq: "빈도",
        sev: "강도",
        selected: "개 선택됨",
        insert: "TBM에 삽입",
        close: "닫기",
        loading: "불러오는 중...",
        noData: "데이터가 없습니다",
        critical: "중점",
        selectAll: "전체 선택",
        deselectAll: "선택 해제",
    },
    en: {
        title: "Safety Education Library",
        subtitle: "Select risk items to add to TBM",
        allCategories: "All",
        allSubs: "All Subcategories",
        criticalOnly: "Critical Only",
        hazard: "Hazard",
        measure: "Preventive Measure",
        risk: "Risk Level",
        freq: "Freq",
        sev: "Sev",
        selected: "selected",
        insert: "Insert to TBM",
        close: "Close",
        loading: "Loading...",
        noData: "No data available",
        critical: "Critical",
        selectAll: "Select All",
        deselectAll: "Deselect All",
    },
    zh: {
        title: "基础教育资料库",
        subtitle: "选择危险项目添加到TBM",
        allCategories: "全部",
        allSubs: "全部细分工种",
        criticalOnly: "仅重点管理",
        hazard: "危险因素",
        measure: "预防措施",
        risk: "危险等级",
        freq: "频率",
        sev: "强度",
        selected: "个已选",
        insert: "插入TBM",
        close: "关闭",
        loading: "加载中...",
        noData: "暂无数据",
        critical: "重点",
        selectAll: "全选",
        deselectAll: "取消全选",
    },
    vi: {
        title: "Thư viện đào tạo cơ bản", subtitle: "Chọn mục đánh giá rủi ro để thêm vào TBM", allCategories: "Tất cả", allSubs: "Tất cả hạng mục", criticalOnly: "Chỉ mục trọng điểm", hazard: "Yếu tố nguy hiểm", measure: "Biện pháp phòng ngừa", risk: "Mức rủi ro", freq: "Tần suất", sev: "Mức độ", selected: "đã chọn", insert: "Chèn vào TBM", close: "Đóng", loading: "Đang tải...", noData: "Không có dữ liệu", critical: "Trọng điểm", selectAll: "Chọn tất cả", deselectAll: "Bỏ chọn tất cả",
    },
    ru: {
        title: "Библиотека базового обучения", subtitle: "Выберите пункты оценки риска для добавления в TBM", allCategories: "Все", allSubs: "Все подкатегории", criticalOnly: "Только критичные", hazard: "Фактор риска", measure: "Мера профилактики", risk: "Уровень риска", freq: "Частота", sev: "Тяжесть", selected: "выбрано", insert: "Вставить в TBM", close: "Закрыть", loading: "Загрузка...", noData: "Нет данных", critical: "Критично", selectAll: "Выбрать всё", deselectAll: "Снять выбор",
    },
};

const EXTRA: Record<string, string[]> = {
    ko: ["자료", "검색", "공종·위험요인·관리계획 검색", "목록을 불러오지 못했습니다.", "다시 시도", "첨부 자료 원문(한국어) · 적용할 항목을 검토한 뒤 선택하세요.", "개 항목", "이전", "다음", "행", "세부공종"],
    en: ["Source", "Search", "Search work, hazards or measures", "Could not load the list.", "Retry", "Original source in Korean. Review items before adding.", "items", "Previous", "Next", "Row", "Subcategory"],
    zh: ["资料", "搜索", "搜索工种、危险因素或措施", "无法加载列表。", "重试", "韩文原始资料。请审核后选择。", "项", "上一页", "下一页", "行", "细分工种"],
    vi: ["Nguồn", "Tìm kiếm", "Tìm công việc, nguy cơ hoặc biện pháp", "Không tải được danh sách.", "Thử lại", "Tài liệu gốc tiếng Hàn. Kiểm tra trước khi thêm.", "mục", "Trước", "Sau", "Dòng", "Hạng mục"],
    ru: ["Источник", "Поиск", "Работы, риски или меры", "Не удалось загрузить список.", "Повторить", "Оригинал на корейском. Проверьте пункты перед добавлением.", "пунктов", "Назад", "Далее", "Строка", "Подкатегория"],
};
export default function SafetyLibraryModal({ isOpen, onClose, onSelect, lang, disabled = false }: SafetyLibraryModalProps) {
    const displayLanguage = useDisplayLanguage();
    const language = lang ?? displayLanguage;
    const t = UI_TEXT[language] || UI_TEXT.en;
    const e = EXTRA[language] || EXTRA.en;
    const [items, setItems] = useState<RiskLibraryItem[]>([]);
    const [sources, setSources] = useState<RiskLibrarySource[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [retry, setRetry] = useState(0);
    const [source, setSource] = useState("seowon-initial-20261006");
    const [category, setCategory] = useState("");
    const [subcategory, setSubcategory] = useState("");
    const [critical, setCritical] = useState(false);
    const [query, setQuery] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) return;
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 15000);
        let active = true;
        setLoading(true); setError(false); setSelected(new Set());
        fetch("/api/tbm/library", { signal: abort.signal, cache: "no-store" })
            .then(async response => {
                if (!response.ok) throw new Error("library_unavailable");
                const body = await response.json();
                if (!Array.isArray(body.data) || !Array.isArray(body.sources)) throw new Error("library_invalid");
                if (active) { setItems(body.data); setSources(body.sources); }
            })
            .catch(() => { if (active) { setError(true); setItems([]); } })
            .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
        return () => { active = false; abort.abort(); clearTimeout(timeout); };
    }, [isOpen, retry]);
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const dialog = document.getElementById("tbm-risk-dialog");
        const first = dialog?.querySelector<HTMLElement>("button");
        first?.focus();
        const key = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            if (event.key !== "Tab" || !dialog) return;
            const nodes = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")].filter(node => node.getClientRects().length > 0);
            const start = nodes[0], end = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end?.focus(); }
            else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start?.focus(); }
        };
        document.addEventListener("keydown", key);
        return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
    }, [isOpen, onClose]);

    const categories = [...new Set(items.filter(i => i.source_id === source).map(i => i.category))];
    const subs = [...new Set(items.filter(i => i.source_id === source && (!category || i.category === category)).map(i => i.subcategory))];
    const filtered = filterRiskLibrary(items, {source, category, subcategory, critical, query});
    const changeCategory = (next: string) => {
        setCategory(next); setSubcategory(""); setQuery(""); setCritical(false);
        document.getElementById("tbm-risk-items")?.scrollTo({ top: 0 });
    };
    const allVisibleSelected = filtered.length > 0 && filtered.every(item => selected.has(item.id));
    const sourceInfo = sources.find(s => s.id === source);
    const toggle = useCallback((id: string) => setSelected(prev => {
        const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
    }), []);
    if (!isOpen) return null;
    const fieldClass = "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
    return <div className="safe-area-overlay fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/35 p-2 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
        <section id="tbm-risk-dialog" role="dialog" aria-modal="true" aria-labelledby="tbm-risk-title"
            onClick={event => event.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-slate-50 text-slate-900 shadow-2xl sm:rounded-[40px]">
            <header className="shrink-0 space-y-4 border-b border-slate-200 bg-white p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div><h2 id="tbm-risk-title" className="text-2xl font-black text-slate-900">{t.title}</h2><p className="mt-1 text-sm font-medium text-slate-600">{t.subtitle}</p></div>
                    <button type="button" onClick={onClose} aria-label={t.close} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                    </button>
                </div>
                <div role="group" aria-label={t.allCategories} className="flex gap-2 overflow-x-auto pb-1">
                    {["", ...categories].map(cat => <button key={cat} type="button" aria-pressed={category === cat}
                        onClick={() => changeCategory(cat)}
                        className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors ${category === cat ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"}`}>
                        {cat || t.allCategories}
                    </button>)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button type="button" aria-pressed={critical} onClick={() => setCritical(value => !value)}
                        className={`rounded-full border px-4 py-2.5 font-bold transition-colors ${critical ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>{t.criticalOnly}</button>
                    <button type="button" disabled={!filtered.length || loading || error} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-600 hover:bg-blue-50 disabled:opacity-40"
                        onClick={() => setSelected(prev => {const next = new Set(prev); for (const item of filtered) {if (allVisibleSelected) next.delete(item.id); else next.add(item.id);} return next;})}>
                        {allVisibleSelected ? t.deselectAll : t.selectAll}
                    </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span aria-live="polite">{filtered.length} {e[6]}</span>
                    <button type="button" aria-expanded={filtersOpen} aria-controls="tbm-risk-filters" onClick={() => setFiltersOpen(open => !open)} className="rounded px-1 py-1 font-semibold text-slate-600 hover:text-blue-700">{e[0]} · {e[1]} <span aria-hidden="true">{filtersOpen ? "▴" : "▾"}</span></button>
                </div>
                {filtersOpen && <div id="tbm-risk-filters" className="max-h-[25dvh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-bold">{e[0]}
                        <select value={source} onChange={ev => {setSource(ev.target.value);changeCategory("");}} className={fieldClass}>
                            {sources.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
                        </select>
                    </label>
                    {category && <select aria-label={e[10]} value={subcategory} onChange={ev => setSubcategory(ev.target.value)} className={fieldClass}>
                        <option value="">{t.allSubs}</option>{subs.map(s => <option key={s}>{s}</option>)}
                    </select>}
                    <input type="search" aria-label={e[1]} placeholder={e[2]} value={query} onChange={ev => setQuery(ev.target.value)} className={fieldClass} />
                    <p className="text-xs leading-relaxed text-slate-600">{e[5]}{sourceInfo && <span className="mt-1 block">{sourceInfo.sheet || sourceInfo.name}</span>}</p>
                </div>}
            </header>
            <div id="tbm-risk-items" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {loading ? <p role="status" className="py-10 text-center">{t.loading}</p>
                    : error ? <div role="alert" className="space-y-3 p-6 text-center text-red-800"><p>{e[3]}</p><button type="button" onClick={() => setRetry(n=>n+1)} className="rounded-xl border px-4 py-2">{e[4]}</button></div>
                    : filtered.length === 0 ? <p className="py-10 text-center text-slate-600">{t.noData}</p>
                    : <div className="space-y-2">{filtered.map(item => <label key={item.id} className={`block cursor-pointer rounded-[24px] border p-4 transition-colors sm:p-5 ${selected.has(item.id) ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                        <div className="flex items-start gap-3">
                            <span className="relative mt-0.5 h-5 w-5 shrink-0">
                                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={item.hazard_description} className="peer m-0 h-5 w-5 cursor-pointer appearance-none rounded-[7px] border-2 border-slate-500 bg-white checked:border-blue-600 checked:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
                                <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-5 w-5 peer-checked:block"><path d="m5 10 3 3 7-7" /></svg>
                            </span>
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap gap-2 text-xs font-bold">
                                    <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-slate-600">{item.accident_type}</span>
                                    <span title={`${t.freq} ${item.frequency} · ${t.sev} ${item.severity}`} className={`rounded-lg border px-2 py-0.5 ${item.is_critical ? "border-rose-200 bg-rose-50 text-rose-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}>{t.risk} {item.risk_level}</span>
                                    {item.is_critical && <span className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">{t.critical}</span>}
                                    <span title={item.subcategory} className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">{item.category}</span>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-base font-bold leading-relaxed">{item.hazard_description}</p>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{t.measure}: {item.preventive_measure}</p>
                            </div>
                        </div>
                    </label>)}</div>}
            </div>
            {selected.size > 0 && <footer className="shrink-0 border-t border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={()=>setSelected(new Set())} disabled={selected.size === 0} className="text-sm font-bold text-slate-600 disabled:opacity-40">{t.deselectAll} ({selected.size})</button>
                    <button type="button" disabled={disabled || loading || error || selected.size === 0} onClick={()=>{
                        const text = riskLibraryDraft(items, selected); if (!text || disabled) return; onSelect(text); onClose();
                    }} className="ml-auto rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">{t.insert}</button>
                </div>
            </footer>}
        </section>
    </div>;
}
