"use client";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
  /** PDF/Word 등에서 검증된 서명 이미지를 포함. 그 외 HTML은 허용하지 않으며 excel/json은 value 사용. */
  html?: (row: T) => string;
};

export type ExportFormat = "pdf" | "excel" | "word" | "hwp" | "json";

/** Kept in memory until the preview closes; never uploaded or persisted. */
export type ExportFile = { blob: Blob; filename: string; previewHtml: string };

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

async function cellHtml<T>(row: T, column: ExportColumn<T>, images: Map<string, Promise<string>>) {
  if (!column.html) return escapeHtml(cellValue(row, column));
  // The only rich export content is a signature image. Never execute HTML
  // returned by a row callback in the document used to render the PDF.
  const parsed = new DOMParser().parseFromString(column.html(row), "text/html");
  const image = parsed.querySelector("img");
  const source = image?.getAttribute("src") ?? "";
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) {
    return `<img src="${escapeHtml(source)}" style="height:34px;max-width:130px;object-fit:contain" />`;
  }
  // V3 signatures are authenticated same-origin URLs, not inline data. Embed
  // their bytes so downloaded reports remain readable outside the session.
  const url = new URL(source || "/", window.location.origin);
  if (url.origin === window.location.origin && /^\/api\/tbm\/signature\/\d+$/.test(url.pathname)) {
    if (!images.has(url.href)) images.set(url.href, (async () => {
      const response = await fetch(url.href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("EXPORT_SIGNATURE_UNAVAILABLE");
      const blob = await response.blob();
      if (!/^image\/(png|jpeg|webp)$/.test(blob.type) || blob.size > 5 * 1024 * 1024) throw new Error("EXPORT_SIGNATURE_INVALID");
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("EXPORT_SIGNATURE_READ_FAILED"));
        reader.readAsDataURL(blob);
      });
    })());
    return `<img src="${escapeHtml(await images.get(url.href))}" style="height:34px;max-width:130px;object-fit:contain" />`;
  }
  return escapeHtml(cellValue(row, column));
}

async function buildHtml<T>(payload: ExportPayload<T>) {
  const images = new Map<string, Promise<string>>();
  // Sequential rows bound authenticated image requests on large worker lists.
  const rows: string[] = [];
  for (const row of payload.rows) {
    const cells = await Promise.all(payload.columns.map(async column => `<td>${await cellHtml(row, column, images)}</td>`));
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
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
    body { font-family: "Malgun Gothic", Arial, sans-serif; color: #111827; line-height: 1.5; background: white; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .subtitle { color: #4b5563; font-size: 12px; margin-bottom: 18px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 18px; }
    .summary div { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; background: #f9fafb; }
    .summary b { display: block; font-size: 20px; }
    .summary span { color: #6b7280; font-size: 11px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 18px; }
    th { background: #111827; color: white; text-align: left; padding: 8px; }
    td { border: 1px solid #d1d5db; padding: 7px; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
    th { overflow-wrap: anywhere; }
    img { max-width: 100%; }
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
      ${rows.join("")}
    </tbody>
  </table>
</body>
</html>`;
}

// Prepare once. ExportMenu owns the visible preview, automatic download request,
// and direct user-gesture retry/share. A hidden click alone cannot confirm that
// Safari saved a file, and regenerating it on retry loses user activation again.
export async function exportData<T>(format: ExportFormat, payload: ExportPayload<T>): Promise<ExportFile> {
  if (format === "json") {
    const json = JSON.stringify(payload.raw ?? { summary: payload.summary, rows: payload.rows }, null, 2);
    return {
      blob: new Blob([json], { type: "application/json;charset=utf-8" }),
      filename: `${payload.filename}.json`,
      previewHtml: `<!doctype html><html><head><meta charset="utf-8"><style>body{color:#111827;background:white}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre>${escapeHtml(json)}</pre></body></html>`,
    };
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
    const bytes = xlsx.write(workbook, { type: "array", bookType: "xlsx" });
    return {
      blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename: `${payload.filename}.xlsx`,
      // Excel contains text values, not signature images. Preview the same
      // values and avoid unnecessary authenticated signature requests.
      previewHtml: await buildHtml({ ...payload, columns: payload.columns.map(column => ({ ...column, html: undefined })) }),
    };
  }

  const html = await buildHtml(payload);
  if (format === "pdf") {
    const { renderExportPdf } = await import("./export-pdf");
    return { blob: await renderExportPdf(html, payload.title), filename: `${payload.filename}.pdf`, previewHtml: html };
  }

  const extension = format === "word" ? "doc" : "hwp";
  const mime = format === "word" ? "application/msword;charset=utf-8" : "application/x-hwp;charset=utf-8";
  return { blob: new Blob(["\ufeff", html], { type: mime }), filename: `${payload.filename}.${extension}`, previewHtml: html };
}
