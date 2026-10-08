"use client";

import { useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import { exportData } from "@/utils/export-files";

// Copied only into the test's isolated Next app, never exposed by production.
export default function ExportDownloadFixture() {
  const [fail, setFail] = useState(false);
  const [delay, setDelay] = useState(false);
  return <main style={{ padding: 24, background: "white", color: "black" }}>
    <button onClick={() => setFail(!fail)}>Simulate error</button>
    <button onClick={() => setDelay(!delay)}>Delay export</button>
    <ExportMenu includeJson onExport={async format => {
      if (fail) throw new Error("fixture failure");
      if (delay) await new Promise(resolve => setTimeout(resolve, 1500));
      const canvas = document.createElement("canvas");
      canvas.width = 150; canvas.height = 45;
      const pen = canvas.getContext("2d")!;
      pen.strokeStyle = "#172554"; pen.lineWidth = 3;
      pen.beginPath(); pen.moveTo(5, 35); pen.lineTo(40, 10); pen.lineTo(28, 38); pen.lineTo(85, 15); pen.lineTo(140, 35); pen.stroke();
      return exportData(format, {
        title: "모바일 다운로드 검증 · TBM 서명",
        subtitle: "Korean · Tiếng Việt · 中文 · English / LOCAL FIXTURES ONLY",
        filename: "sq_export_fixture",
        summary: [{ label: "확인 대상", value: 86 }, { label: "서명", value: 86 }],
        columns: [
          { key: "id", label: "번호" },
          { key: "text", label: "현장 표현 / 표준 표현" },
          { key: "signature", label: "서명", value: () => "완료", html: row => `<img src="${row.id % 2 ? canvas.toDataURL() : '/api/tbm/signature/1'}" />` },
        ],
        rows: [...Array.from({ length: 85 }, (_, i) => ({ id: i + 1, text: `겐바 → 공사현장 / 공구리 → 콘크리트 (ROW ${i + 1})` })),
          { id: 86, text: Array.from({ length: 100 }, (_, i) => `긴 문장 이어쓰기 ${i + 1}`).join("\n") + "\nLAST ROW END" }],
      });
    }} />
  </main>;
}
