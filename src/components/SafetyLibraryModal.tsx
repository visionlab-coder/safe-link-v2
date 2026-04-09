"use client";

import { useState, useEffect, useCallback } from "react";

interface LibraryItem {
    id: string;
    category: string;
    subcategory: string;
    hazard_description: string;
    accident_type: string;
    frequency: number;
    severity: number;
    risk_level: number;
    preventive_measure: string;
    is_critical: boolean;
}

interface SafetyLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (text: string) => void;
    lang?: string;
}

const UI_TEXT: Record<string, Record<string, string>> = {
    ko: {
        title: "기초교육 라이브러리",
        subtitle: "위험성평가 항목을 선택하여 TBM에 추가",
        allCategories: "전체",
        allSubs: "전체 세부공종",
        criticalOnly: "중점관리만",
        hazard: "위험요인",
        measure: "예방대책",
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
};

const RISK_COLORS: Record<number, string> = {
    1: "text-green-400 bg-green-500/10 border-green-500/20",
    2: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    3: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    4: "text-red-400 bg-red-500/10 border-red-500/20",
    5: "text-red-500 bg-red-500/20 border-red-500/30",
};

export default function SafetyLibraryModal({ isOpen, onClose, onSelect, lang = "ko" }: SafetyLibraryModalProps) {
    const t = UI_TEXT[lang] || UI_TEXT["ko"];

    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [subcategories, setSubcategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
    const [criticalOnly, setCriticalOnly] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedCategory) params.set("category", selectedCategory);
            if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
            if (criticalOnly) params.set("critical_only", "true");

            const res = await fetch(`/api/tbm/library?${params.toString()}`);
            const json = await res.json();
            const data: LibraryItem[] = json.data || [];
            setItems(data);

            if (!selectedCategory) {
                const cats = [...new Set(data.map((d) => d.category))];
                setCategories(cats);
            }

            if (selectedCategory) {
                const subs = [...new Set(
                    data
                        .filter((d) => d.category === selectedCategory)
                        .map((d) => d.subcategory)
                )];
                setSubcategories(subs);
            } else {
                setSubcategories([]);
            }
        } catch (e) {
            console.error("Library fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, selectedSubcategory, criticalOnly]);

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setSelectedIds(new Set());
        }
    }, [isOpen, fetchData]);

    const handleCategoryChange = (cat: string) => {
        setSelectedCategory(cat);
        setSelectedSubcategory("");
        setSelectedIds(new Set());
    };

    const toggleItem = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map((i) => i.id)));
        }
    };

    const filteredItems = items.filter((item) => {
        if (selectedCategory && item.category !== selectedCategory) return false;
        if (selectedSubcategory && item.subcategory !== selectedSubcategory) return false;
        return true;
    });

    const handleInsert = () => {
        const selected = filteredItems.filter((i) => selectedIds.has(i.id));
        if (selected.length === 0) return;

        const lines = selected.map((item) => {
            const critical = item.is_critical ? " [중점관리]" : "";
            return `[${item.accident_type}] ${item.hazard_description}\n  -> 예방대책: ${item.preventive_measure}${critical}`;
        });

        onSelect(lines.join("\n\n"));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0a0f1a] border border-white/10 rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-float">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">{t.title}</h2>
                            <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">{t.subtitle}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors text-slate-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={() => handleCategoryChange("")}
                            className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                                !selectedCategory
                                    ? "bg-blue-500 text-white shadow-lg"
                                    : "glass border-white/10 text-slate-400 hover:text-white"
                            }`}
                        >
                            {t.allCategories}
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                                    selectedCategory === cat
                                        ? "bg-blue-500 text-white shadow-lg"
                                        : "glass border-white/10 text-slate-400 hover:text-white"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Subcategory + Filters */}
                    <div className="flex gap-2 mt-3 items-center flex-wrap">
                        {selectedCategory && subcategories.length > 0 && (
                            <select
                                value={selectedSubcategory}
                                onChange={(e) => {
                                    setSelectedSubcategory(e.target.value);
                                    setSelectedIds(new Set());
                                }}
                                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 outline-none"
                            >
                                <option value="">{t.allSubs}</option>
                                {subcategories.map((sub) => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={() => setCriticalOnly(!criticalOnly)}
                            className={`px-3 py-2 rounded-full text-xs font-black transition-all ${
                                criticalOnly
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : "glass border-white/10 text-slate-500 hover:text-white"
                            }`}
                        >
                            {t.criticalOnly}
                        </button>
                        {filteredItems.length > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-2 rounded-full text-xs font-black glass border-white/10 text-slate-400 hover:text-white transition-all ml-auto"
                            >
                                {selectedIds.size === filteredItems.length ? t.deselectAll : t.selectAll}
                            </button>
                        )}
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-slate-500 font-bold">
                            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mr-3" />
                            {t.loading}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-20 text-slate-600 font-bold italic">{t.noData}</div>
                    ) : (
                        filteredItems.map((item) => {
                            const isSelected = selectedIds.has(item.id);
                            const riskColor = RISK_COLORS[item.risk_level] || RISK_COLORS[1];

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`w-full text-left p-4 rounded-[24px] transition-all ${
                                        isSelected
                                            ? "bg-blue-500/10 border-2 border-blue-500/30 shadow-lg"
                                            : "glass border border-white/5 hover:border-white/10"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 mt-0.5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                            isSelected ? "bg-blue-500 border-blue-500" : "border-slate-600"
                                        }`}>
                                            {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {/* Top row: accident type + risk badges */}
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase">
                                                    {item.accident_type}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${riskColor}`}>
                                                    {t.risk} {item.risk_level}
                                                </span>
                                                {item.is_critical && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-red-500/20 border border-red-500/30 text-[10px] font-black text-red-400">
                                                        {t.critical}
                                                    </span>
                                                )}
                                                {!selectedCategory && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400">
                                                        {item.category}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Hazard description */}
                                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                                                {item.hazard_description}
                                            </p>

                                            {/* Preventive measure */}
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                {t.measure}: {item.preventive_measure}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {selectedIds.size > 0 && (
                    <div className="p-4 border-t border-white/5 flex items-center gap-3">
                        <span className="text-sm font-black text-blue-400">
                            {selectedIds.size}{t.selected}
                        </span>
                        <button
                            onClick={handleInsert}
                            className="flex-1 py-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-[24px] text-lg font-black text-slate-950 shadow-[0_10px_30px_-10px_rgba(59,130,246,0.4)] tap-effect flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                            {t.insert}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
