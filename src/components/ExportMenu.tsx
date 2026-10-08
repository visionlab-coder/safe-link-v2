"use client";

import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ElementType } from "react";
import type { ExportFile, ExportFormat } from "@/utils/export-files";
import ExportPreview from "@/components/ExportPreview";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
const EXPORT_TEXT: Record<string, [string, string, string]> = {
  ko: ["내보내기", "파일 생성 중…", "파일을 만들지 못했습니다. 다시 시도해 주세요."],
  en: ["Export", "Preparing file…", "Could not create the file. Please try again."],
  zh: ["导出", "正在生成文件…", "无法生成文件，请重试。"],
  vi: ["Xuất", "Đang tạo tệp…", "Không thể tạo tệp. Vui lòng thử lại."],
  ru: ["Экспорт", "Подготовка файла…", "Не удалось создать файл. Повторите попытку."],
  th: ["ส่งออก", "กำลังสร้างไฟล์…", "สร้างไฟล์ไม่สำเร็จ โปรดลองอีกครั้ง"],
  uz: ["Eksport", "Fayl tayyorlanmoqda…", "Fayl yaratilmadi. Qayta urinib ko‘ring."],
  ph: ["I-export", "Ginagawa ang file…", "Hindi magawa ang file. Pakisubukang muli."],
  km: ["នាំចេញ", "កំពុងបង្កើតឯកសារ…", "មិនអាចបង្កើតឯកសារបានទេ។ សូមព្យាយាមម្តងទៀត។"],
  id: ["Ekspor", "Menyiapkan berkas…", "Berkas tidak dapat dibuat. Silakan coba lagi."],
  mn: ["Экспортлох", "Файл үүсгэж байна…", "Файл үүсгэж чадсангүй. Дахин оролдоно уу."],
  my: ["ထုတ်ယူရန်", "ဖိုင်ဖန်တီးနေသည်…", "ဖိုင်မဖန်တီးနိုင်ပါ။ ထပ်မံကြိုးစားပါ။"],
  ne: ["निर्यात", "फाइल तयार हुँदैछ…", "फाइल बनाउन सकिएन। फेरि प्रयास गर्नुहोस्।"],
  bn: ["রপ্তানি", "ফাইল তৈরি হচ্ছে…", "ফাইল তৈরি করা যায়নি। আবার চেষ্টা করুন।"],
  kk: ["Экспорттау", "Файл дайындалуда…", "Файл жасалмады. Қайталап көріңіз."],
  jp: ["エクスポート", "ファイルを作成中…", "ファイルを作成できませんでした。もう一度お試しください。"],
  fr: ["Exporter", "Création du fichier…", "Impossible de créer le fichier. Réessayez."],
  es: ["Exportar", "Creando archivo…", "No se pudo crear el archivo. Inténtelo de nuevo."],
  ar: ["تصدير", "جارٍ إنشاء الملف…", "تعذر إنشاء الملف. يرجى المحاولة مرة أخرى."],
  hi: ["निर्यात", "फ़ाइल तैयार हो रही है…", "फ़ाइल नहीं बन सकी। कृपया फिर से प्रयास करें।"],
};

type ExportMenuProps = {
  disabled?: boolean;
  onExport: (format: ExportFormat) => Promise<ExportFile | undefined>;
  includeJson?: boolean;
};

const OPTIONS: Array<{ format: ExportFormat; label: string; icon: ElementType }> = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "excel", label: "Excel", icon: FileSpreadsheet },
  { format: "word", label: "Word", icon: FileText },
  { format: "hwp", label: "HWP", icon: FileText },
];

export default function ExportMenu({ disabled, onExport, includeJson = false }: ExportMenuProps) {
  const language = useDisplayLanguage();
  const [exportLabel, preparingLabel, errorLabel] = EXPORT_TEXT[language] ?? EXPORT_TEXT.en;
  const options = includeJson ? [...OPTIONS, { format: "json" as const, label: "JSON", icon: FileJson }] : OPTIONS;
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [file, setFile] = useState<ExportFile>();
  const exportingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusLastRef = useRef(false);
  const menuId = useId();
  const triggerId = `${menuId}-trigger`;
  const open = isOpen && !disabled && !busy;

  const handleExport = async (format: ExportFormat) => {
    if (exportingRef.current || disabled) return;
    exportingRef.current = true;
    setIsOpen(false);
    setFailed(false);
    setBusy(true);
    triggerRef.current?.focus();
    try {
      setFile(await onExport(format));
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.warn("Export failed:", error instanceof Error ? error.message : "unknown");
      setFailed(true);
    } finally {
      exportingRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const items = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[focusLastRef.current ? items.length - 1 : 0]?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onBlur={(event) => {
        // Safari does not focus buttons on pointer clicks: relatedTarget may
        // be null even when tapping our trigger. Outside taps are handled by
        // pointerdown; only close on an actual focus move to another element.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled || busy}
        aria-busy={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setFailed(false);
          focusLastRef.current = false;
          setIsOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          focusLastRef.current = event.key === "ArrowUp";
          setIsOpen(true);
        }}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-100 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        <span aria-live="polite">{busy ? preparingLabel : exportLabel}</span>
      </button>
      {failed && <p role="alert" className="absolute right-0 top-full z-[80] mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-red-200 bg-white p-3 text-sm text-red-700 shadow-lg">{errorLabel}</p>}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-[80] overflow-hidden"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
              (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          {options.map(({ format, label, icon: Icon }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => void handleExport(format)}
              className="w-full px-4 py-3 text-left text-xs font-black hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 text-slate-200 transition-colors border-b border-white/5 last:border-b-0 flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
      {file && <ExportPreview file={file} language={language} onClose={() => {
        setFile(undefined);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }} />}
    </div>
  );
}
