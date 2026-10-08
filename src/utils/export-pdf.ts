"use client";

// Render one A4 page at a time, not a single, unbounded canvas of the entire
// report. This avoids mobile canvas-size limits and preserves browser-shaped
// Korean/other scripts and signature images without uploading report data.
export async function renderExportPdf(html: string, title: string): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"), import("html2canvas"),
  ]);
  const width = 690;
  const maxHeight = 990;
  const frame = document.createElement("iframe");
  frame.title = "PDF export";
  frame.setAttribute("aria-hidden", "true");
  // Only escaped text + validated image data from buildHtml enter this frame.
  // A script-disabled sandbox blocks html2canvas's nested iframe onload in
  // WebKit, leaving file generation pending forever.
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:1123px;border:0;pointer-events:none;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("EXPORT_DOCUMENT_UNAVAILABLE");
    doc.open();
    doc.write(html);
    doc.close();
    doc.body.style.cssText = "margin:0;background:white;color:#111827;";
    // Reuse the app's locally served Noto fonts, without its layout/dark CSS.
    const fontCss: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule.type === CSSRule.FONT_FACE_RULE) fontCss.push(rule.cssText);
        }
      } catch { /* A cross-origin stylesheet may not expose CSS rules. */ }
    }
    const fonts = doc.createElement("style");
    fonts.textContent = fontCss.join("\n");
    doc.head.appendChild(fonts);
    doc.body.style.fontFamily = getComputedStyle(document.body).fontFamily;
    // Trigger layout and font selection before waiting for FontFaceSet.ready.
    void doc.body.offsetHeight;
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(async image => {
      await image.decode();
      if (!image.naturalWidth) throw new Error("EXPORT_IMAGE_UNAVAILABLE");
    }));

    const table = doc.querySelector("table");
    if (!table) throw new Error("EXPORT_TABLE_MISSING");
    const rows = Array.from(table.tBodies[0].rows);
    const header = Array.from(doc.body.children).filter(child => child !== table);
    const viewport = doc.createElement("div");
    viewport.style.cssText = `width:${width}px;overflow:hidden;background:white;`;
    const page = doc.createElement("div");
    page.style.cssText = `width:${width}px;display:flow-root;background:white;`;
    viewport.appendChild(page);
    doc.body.replaceChildren(viewport);
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title, creator: "SQ Link" });
    let pageCount = 0;
    let tbody: HTMLTableSectionElement;
    const newPage = () => {
      page.replaceChildren(...header
        .filter(child => pageCount === 0 || !child.classList.contains("summary"))
        .map(child => child.cloneNode(true)));
      const nextTable = table.cloneNode(false) as HTMLTableElement;
      if (table.tHead) nextTable.appendChild(table.tHead.cloneNode(true));
      tbody = doc.createElement("tbody");
      nextTable.appendChild(tbody);
      page.appendChild(nextTable);
    };
    const capture = async () => {
      const height = page.scrollHeight;
      if (height > maxHeight) throw new Error("EXPORT_PAGE_TOO_LARGE");
      const canvas = await html2canvas(viewport, {
        width, height, scale: 2, backgroundColor: "#ffffff",
        logging: false, allowTaint: false, useCORS: false,
        windowWidth: width, windowHeight: 1123, scrollX: 0, scrollY: 0,
      });
      if (pageCount++) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 14, 14, 182, height * 182 / width);
      canvas.width = canvas.height = 0;
      // Allow busy state/animations to paint between pages on slower phones.
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    const captureLongRow = async (row: HTMLTableRowElement) => {
      const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
      const cells = Array.from(row.cells).map(cell => ({
        template: cell,
        parts: segmenter ? Array.from(segmenter.segment(cell.textContent ?? ""), part => part.segment) : Array.from(cell.textContent ?? ""),
        offset: 0,
      }));
      let first = true;
      do {
        const fragment = row.cloneNode(false) as HTMLTableRowElement;
        const fragmentCells = cells.map(({ template }) => template.cloneNode(false) as HTMLTableCellElement);
        fragment.append(...fragmentCells);
        tbody!.appendChild(fragment);
        for (let index = 0; index < cells.length; index++) {
          const cell = cells[index];
          const target = fragmentCells[index];
          const image = cell.template.querySelector("img");
          if (image && first) target.appendChild(image.cloneNode(true));
          let low = 0, high = cell.parts.length - cell.offset;
          // Fit text into the current page, retaining complete Unicode
          // graphemes. Unlike slicing a screenshot, this never cuts a line
          // in half at a page boundary. Each continuation gets column headers.
          while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            target.textContent = cell.parts.slice(cell.offset, cell.offset + middle).join("");
            if (page.scrollHeight <= maxHeight - 8) low = middle;
            else high = middle - 1;
          }
          if (cell.parts.length > cell.offset) {
            if (!low) throw new Error("EXPORT_ROW_TOO_LARGE");
            const fitted = cell.parts.slice(cell.offset, cell.offset + low).join("");
            // Prefer a space/newline boundary when there is one near the end.
            const boundary = Math.max(fitted.lastIndexOf("\n"), fitted.lastIndexOf(" "));
            if (low < cell.parts.length - cell.offset && boundary > fitted.length * 0.8) {
              low = segmenter ? Array.from(segmenter.segment(fitted.slice(0, boundary + 1))).length : Array.from(fitted.slice(0, boundary + 1)).length;
            }
            target.textContent = cell.parts.slice(cell.offset, cell.offset + low).join("");
            cell.offset += low;
          }
        }
        await capture();
        newPage();
        first = false;
      } while (cells.some(cell => cell.offset < cell.parts.length));
    };
    newPage();
    for (const row of rows) {
      tbody!.appendChild(row);
      if (page.scrollHeight > maxHeight && tbody!.rows.length > 1) {
        row.remove();
        await capture();
        newPage();
        tbody!.appendChild(row);
      }
      if (page.scrollHeight > maxHeight) {
        row.remove();
        await captureLongRow(row);
      }
    }
    if (tbody!.rows.length || pageCount === 0) await capture();
    for (let number = 1; number <= pageCount; number++) {
      pdf.setPage(number);
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`${number} / ${pageCount}`, 105, 287, { align: "center" });
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}
