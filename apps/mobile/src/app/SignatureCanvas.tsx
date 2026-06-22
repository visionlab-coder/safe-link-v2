import { useEffect, useRef, useState } from "react";

// ✍️ M-008 — 터치 서명 캔버스 (외부 라이브러리 없이 pointer events).
// 빈 서명 방지(hasInk), DPR 해상도, data URL(PNG) 반환.
export function SignatureCanvas({
    onSubmit,
    onCancel,
    busy,
}: {
    onSubmit: (dataUrl: string) => void;
    onCancel: () => void;
    busy?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = c.getBoundingClientRect();
        c.width = Math.max(1, Math.round(rect.width * dpr));
        c.height = Math.max(1, Math.round(rect.height * dpr));
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
    }, []);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const r = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
        drawing.current = true;
        const ctx = canvasRef.current!.getContext("2d")!;
        const p = point(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        canvasRef.current!.setPointerCapture(e.pointerId);
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current!.getContext("2d")!;
        const p = point(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (!hasInk) setHasInk(true);
    };
    const up = () => { drawing.current = false; };

    const clear = () => {
        const c = canvasRef.current!;
        c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
        setHasInk(false);
    };
    const submit = () => {
        if (!hasInk) return;
        onSubmit(canvasRef.current!.toDataURL("image/png"));
    };

    return (
        <div>
            <canvas ref={canvasRef}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
                style={{ width: "100%", height: 180, background: "#fff", borderRadius: 10, border: "1px solid #ccc", touchAction: "none" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="auth-btn" style={{ flex: 1, background: "#555" }} onClick={clear}>지우기</button>
                <button className="auth-btn" style={{ flex: 1, background: "#888" }} onClick={onCancel}>취소</button>
                <button className="auth-btn" style={{ flex: 2 }} onClick={submit} disabled={!hasInk || busy}>
                    {busy ? "…" : "서명 제출"}
                </button>
            </div>
            {!hasInk && <p className="auth-status">위 영역에 손가락으로 서명해 주세요.</p>}
        </div>
    );
}
