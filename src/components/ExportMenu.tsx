"use client";

import { Download, FileJson, FileSpreadsheet, FileText, Printer } from "lucide-react";
import type { ElementType } from "react";
import type { ExportFormat } from "@/utils/export-files";

type ExportMenuProps = {
  disabled?: boolean;
  onExport: (format: ExportFormat) => void | Promise<void>;
  includeJson?: boolean;
};

const OPTIONS: Array<{ format: ExportFormat; label: string; icon: ElementType }> = [
  { format: "pdf", label: "PDF", icon: Printer },
  { format: "excel", label: "Excel", icon: FileSpreadsheet },
  { format: "word", label: "Word", icon: FileText },
  { format: "hwp", label: "HWP", icon: FileText },
];

export default function ExportMenu({ disabled, onExport, includeJson = false }: ExportMenuProps) {
  const options = includeJson ? [...OPTIONS, { format: "json" as const, label: "JSON", icon: FileJson }] : OPTIONS;

  return (
    <div className="relative group/export">
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-100 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
      >
        <Download className="w-4 h-4" />
        내보내기
      </button>
      {!disabled && (
        <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-[80] overflow-hidden">
          {options.map(({ format, label, icon: Icon }) => (
            <button
              key={format}
              type="button"
              onClick={() => onExport(format)}
              className="w-full px-4 py-3 text-left text-xs font-black hover:bg-white/5 text-slate-200 transition-colors border-b border-white/5 last:border-b-0 flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
