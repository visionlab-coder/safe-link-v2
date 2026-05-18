"use client";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
};

export type ExportFormat = "pdf" | "excel" | "word" | "hwp" | "json";

type ExportPayload<T> = {
  title: string;
  subtitle?: string;
  summary?: Array<{ label: string; value: string | number }>;
  columns: ExportColumn<T>[];
  rows: T[];
  filename: string;
  raw?: unknown;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellValue<T>(row: T, column: ExportColumn<T>) {
  if (column.value) return column.value(row);
  return (row as Record<string, unknown>)[String(column.key)] as string | number | null | undefined;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildHtml<T>(payload: ExportPayload<T>) {
  const summary = payload.summary?.length
    ? `<section class="summary">${payload.summary.map((item) => `
        <div><b>${escapeHtml(item.value)}</b><span>${escapeHtml(item.label)}</span></div>
      `).join("")}</section>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: "Malgun Gothic", Arial, sans-serif; color: #111827; line-height: 1.5; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .subtitle { color: #4b5563; font-size: 12px; margin-bottom: 18px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 18px; }
    .summary div { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; background: #f9fafb; }
    .summary b { display: block; font-size: 20px; }
    .summary span { color: #6b7280; font-size: 11px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #111827; color: white; text-align: left; padding: 8px; }
    td { border: 1px solid #d1d5db; padding: 7px; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>${escapeHtml(payload.title)}</h1>
  <div class="subtitle">${escapeHtml(payload.subtitle ?? new Date().toLocaleString("ko-KR"))}</div>
  ${summary}
  <table>
    <thead><tr>${payload.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>
      ${payload.rows.map((row) => `<tr>${payload.columns.map((column) => `<td>${escapeHtml(cellValue(row, column))}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

export async function exportData<T>(format: ExportFormat, payload: ExportPayload<T>) {
  if (format === "json") {
    downloadBlob(
      new Blob([JSON.stringify(payload.raw ?? { summary: payload.summary, rows: payload.rows }, null, 2)], { type: "application/json;charset=utf-8" }),
      `${payload.filename}.json`,
    );
    return;
  }

  if (format === "excel") {
    const xlsx = await import("xlsx");
    const rows = payload.rows.map((row) =>
      Object.fromEntries(payload.columns.map((column) => [column.label, cellValue(row, column) ?? ""])),
    );
    const workbook = xlsx.utils.book_new();
    if (payload.summary?.length) {
      const summarySheet = xlsx.utils.json_to_sheet(payload.summary);
      xlsx.utils.book_append_sheet(workbook, summarySheet, "summary");
    }
    const sheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, "data");
    xlsx.writeFile(workbook, `${payload.filename}.xlsx`);
    return;
  }

  const html = buildHtml(payload);
  if (format === "pdf") {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
    return;
  }

  const extension = format === "word" ? "doc" : "hwp";
  const mime = format === "word" ? "application/msword;charset=utf-8" : "application/x-hwp;charset=utf-8";
  downloadBlob(new Blob(["\ufeff", html], { type: mime }), `${payload.filename}.${extension}`);
}
